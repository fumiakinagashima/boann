import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { eq } from 'drizzle-orm';
import { buildSystemPrompt, type AppContext } from './prompt';
import { tools as allTools, dispatchTool } from '$lib/server/mcp';
import { entityTypes } from '$lib/server/db/schema';

// メインチャットはSELECTのみ。create_* / update_* / delete_* はダイアログ経由でユーザーが実行する。
const WRITE_TOOL_PREFIX = ['create_', 'update_', 'delete_'];
const mainChatTools = allTools.filter(
	(t) => !WRITE_TOOL_PREFIX.some((prefix) => t.name.startsWith(prefix))
);

// アプリビルダーモード: スキーマ生成（create_table, create_page, add_entity_field）を許可し、レコード操作のみ禁止
const APP_BUILDER_BLOCKED = new Set([
	'create_entity', 'update_entity',
	'create_app', 'create_entity_type',
	'create_reminder', 'create_reminders_bulk',
	'delete_sent_reminders', 'delete_read_notifications'
]);
const appBuilderTools = allTools.filter((t) => !APP_BUILDER_BLOCKED.has(t.name));
import { DEFAULT_AI_MODEL } from './settings';
import type { Db } from '$lib/server/db';
import type { MessageContent, WorkflowStep } from '$lib/types/chat';
import type { ToolEnv } from '$lib/server/mcp';

export type StreamEvent =
	| { type: 'delta'; text: string }
	| { type: 'ui'; content: MessageContent }
	| { type: 'done' }
	| { type: 'error'; message: string };

// テキストストリームを処理し、<ui>ブロックをバッファリングしてdeltaとuiイベントに分離
export class TextStreamProcessor {
	private buf = '';
	private inUi = false;

	process(chunk: string): StreamEvent[] {
		this.buf += chunk;
		const events: StreamEvent[] = [];

		while (this.buf.length > 0) {
			if (!this.inUi) {
				const start = this.buf.indexOf('<ui');
				if (start === -1) {
					events.push({ type: 'delta', text: this.buf });
					this.buf = '';
					break;
				}
				if (start > 0) {
					events.push({ type: 'delta', text: this.buf.slice(0, start) });
				}
				this.buf = this.buf.slice(start);
				this.inUi = true;
			} else {
				const end = this.buf.indexOf('</ui>');
				if (end === -1) break;
				const tag = this.buf.slice(0, end + 5);
				this.buf = this.buf.slice(end + 5);
				this.inUi = false;
				const parsed = parseUITag(tag);
				if (parsed) events.push({ type: 'ui', content: parsed });
			}
		}

		return events;
	}

	flush(): StreamEvent[] {
		if (!this.inUi && this.buf) {
			const ev: StreamEvent = { type: 'delta', text: this.buf };
			this.buf = '';
			return [ev];
		}
		this.buf = '';
		this.inUi = false;
		return [];
	}
}

// AIが steps の params/left/right に数値・真偽値をそのまま出力することがあるが、
// 型上は常に文字列（WorkflowOperand）のため、後段の parseStepRef 等が壊れないよう文字列化する。
function sanitizeWorkflowSteps(steps: unknown): WorkflowStep[] {
	if (!Array.isArray(steps)) return steps as WorkflowStep[];
	return steps.map((s) => {
		if (!s || typeof s !== 'object') return s;
		const step = s as Record<string, unknown>;
		if (step.kind === 'action') {
			const params = step.params;
			if (params && typeof params === 'object') {
				const fixed: Record<string, string> = {};
				for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
					fixed[k] = typeof v === 'string' ? v : String(v);
				}
				return { ...step, params: fixed };
			}
			return step;
		}
		if (step.kind === 'condition') {
			return {
				...step,
				left: typeof step.left === 'string' ? step.left : String(step.left ?? ''),
				right: typeof step.right === 'string' ? step.right : String(step.right ?? ''),
				then: sanitizeWorkflowSteps(step.then)
			};
		}
		if (step.kind === 'foreach') {
			return {
				...step,
				source: typeof step.source === 'string' ? step.source : String(step.source ?? ''),
				body: sanitizeWorkflowSteps(step.body)
			};
		}
		return step;
	});
}

// get_entities はカスタムテーブル名（entity_type_id → name）を DB から解決して entity を補完する。
// entity 未指定のレコード一覧テーブルへのフォールバック（rows に id がある場合のみ）。
const RECORD_LIST_TOOL_ENTITY: Record<string, string> = {};

// entity 未指定のレコード一覧テーブルに、ヒント entity を補完する。
// 行クリックで詳細ダイアログを開けるようにするためのフォールバック（rows に id がある場合のみ）。
function applyEntityHint(events: StreamEvent[], entity: string | undefined): void {
	if (!entity) return;
	for (const e of events) {
		if (e.type !== 'ui' || e.content.type !== 'table' || e.content.entity) continue;
		const first = e.content.rows[0];
		if (e.content.rows.length > 0 && first && typeof first === 'object' && 'id' in first) {
			e.content.entity = entity;
		}
	}
}

export function parseUITag(tag: string): MessageContent | null {
	const attrStr = /^<ui\s([^>]*)>/.exec(tag)?.[1] ?? '';
	const body = tag.replace(/^<ui[^>]*>/, '').replace(/<\/ui>$/, '').trim();
	const type = /type="([^"]+)"/.exec(attrStr)?.[1];
	const title = /title="([^"]+)"/.exec(attrStr)?.[1];
	const name = /name="([^"]+)"/.exec(attrStr)?.[1];
	const id = /id="([^"]+)"/.exec(attrStr)?.[1];
	const tool = /tool="([^"]+)"/.exec(attrStr)?.[1];
	const entity = /entity="([^"]+)"/.exec(attrStr)?.[1];
	const submitLabel = /submitLabel="([^"]+)"/.exec(attrStr)?.[1];
	const chartType = /chartType="([^"]+)"/.exec(attrStr)?.[1] as 'bar' | 'line' | 'pie' | undefined;
	const chartMode = /mode="([^"]+)"/.exec(attrStr)?.[1] as 'normal' | 'stacked' | 'grouped' | undefined;
	const href = /href="([^"]+)"/.exec(attrStr)?.[1];
	const label = /label="([^"]+)"/.exec(attrStr)?.[1];
	const description = /description="([^"]+)"/.exec(attrStr)?.[1];
	const newTab = /newTab="([^"]+)"/.exec(attrStr)?.[1] === 'true';
	const jobId = /jobId="([^"]+)"/.exec(attrStr)?.[1];
	const downloadUrl = /downloadUrl="([^"]+)"/.exec(attrStr)?.[1];
	const filename = /filename="([^"]+)"/.exec(attrStr)?.[1];

	try {
		if (type === 'form' && (tool || entity)) {
			return { type: 'form', title, fields: body ? JSON.parse(body) : [], tool: tool ?? '', entity, submitLabel };
		} else if (type === 'table') {
			const { columns, rows, entity } = JSON.parse(body);
			return { type: 'table', columns, rows, entity };
		} else if (type === 'actions') {
			return { type: 'actions', title, actions: JSON.parse(body) };
		} else if (type === 'values') {
			return { type: 'values', title, items: JSON.parse(body) };
		} else if (type === 'chart') {
			// chart display is temporarily disabled
			return null;
		} else if (type === 'kanban') {
			const { columns, cards } = JSON.parse(body);
			return { type: 'kanban', title, columns, cards };
		} else if (type === 'link' && href && label) {
			return { type: 'link', label, href, description, newTab: newTab || undefined };
		} else if (type === 'document_job' && jobId && label) {
			return { type: 'document_job', jobId, label };
		} else if (type === 'doc_handoff' && downloadUrl && filename && label) {
			return { type: 'doc_handoff', label, downloadUrl, filename, prompt: body };
		} else if (type === 'reply') {
			return { type: 'reply', title, fields: JSON.parse(body), submitLabel };
		} else if (type === 'workflow') {
			const { triggerHour, triggerMinute, steps } = JSON.parse(body);
			return {
				type: 'workflow',
				id,
				name: name ?? '新規ワークフロー',
				triggerHour,
				triggerMinute,
				steps: sanitizeWorkflowSteps(steps)
			};
		}
	} catch {
		// malformed JSON in UI tag
	}
	return null;
}

export async function streamChat(
	db: Db,
	apiKey: string,
	history: MessageParam[],
	model: string | undefined,
	emit: (event: StreamEvent) => void,
	env?: ToolEnv,
	ctx?: ExecutionContext,
	appContext?: AppContext
): Promise<void> {
	const anthropic = new Anthropic({ apiKey });
	let messages: MessageParam[] = [...history];
	let lastTurnEvents: StreamEvent[] = [];
	// ターン単位で entity を追跡する。
	// 「最後に単一エンティティ種別だけを使ったターン」の entity を記憶し、
	// 最終ターンで entity 未指定テーブルへのフォールバックに使う。
	// 複数エンティティを同一ターンで使った場合は undefined（どれかわからないため補完しない）。
	let hintEntity: string | undefined;

	for (let turn = 0; turn < 10; turn++) {
		const processor = new TextStreamProcessor();
		const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
		let currentTool: { id: string; name: string; inputJson: string } | null = null;
		const turnEvents: StreamEvent[] = [];

		const tools = appContext?.appId ? appBuilderTools : mainChatTools;
		const stream = anthropic.messages.stream({
			model: model ?? DEFAULT_AI_MODEL,
			max_tokens: 8192,
			system: buildSystemPrompt(appContext),
			tools,
			messages
		});

		for await (const event of stream) {
			if (event.type === 'content_block_start') {
				if (event.content_block.type === 'tool_use') {
					currentTool = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
				}
			} else if (event.type === 'content_block_delta') {
				if (event.delta.type === 'text_delta') {
					turnEvents.push(...processor.process(event.delta.text));
				} else if (event.delta.type === 'input_json_delta' && currentTool) {
					currentTool.inputJson += event.delta.partial_json;
				}
			} else if (event.type === 'content_block_stop' && currentTool) {
				toolBlocks.push(currentTool);
				currentTool = null;
			}
		}

		turnEvents.push(...processor.flush());
		lastTurnEvents = turnEvents;

		// このターンで使ったレコード一覧系ツールの entity を収集する
		const turnEntities = new Set<string>();
		for (const b of toolBlocks) {
			const ent = RECORD_LIST_TOOL_ENTITY[b.name];
			if (ent) turnEntities.add(ent);
		}
		// get_entities はカスタムテーブル名（entity_type_id → name）を DB から解決して補完する
		await Promise.all(
			toolBlocks
				.filter((b) => b.name === 'get_entities')
				.map(async (b) => {
					try {
						const input = JSON.parse(b.inputJson || '{}') as { entity_type_id?: string };
						if (input.entity_type_id) {
							const [et] = await db
								.select({ name: entityTypes.name })
								.from(entityTypes)
								.where(eq(entityTypes.id, input.entity_type_id));
							if (et?.name) turnEntities.add(et.name);
						}
					} catch { /* ignore */ }
				})
		);
		// hintEntity を更新: 単一ならその entity、複数なら ambiguous で undefined、ゼロなら維持
		if (turnEntities.size === 1) {
			hintEntity = [...turnEntities][0];
		} else if (turnEntities.size > 1) {
			hintEntity = undefined;
		}

		const finalMsg = await stream.finalMessage();
		if (finalMsg.stop_reason !== 'tool_use') {
			applyEntityHint(turnEvents, hintEntity);
			for (const e of turnEvents) emit(e);
			return;
		}

		// ツール呼び出しを伴う中間ターンのテキスト・UIは進行状況の実況なのでユーザーには表示しない

		const toolResults = await Promise.all(
			toolBlocks.map(async (b) => {
				try {
					const input = JSON.parse(b.inputJson || '{}');
					const result = await dispatchTool(db, b.name as never, input, env, ctx);
					return { type: 'tool_result' as const, tool_use_id: b.id, content: JSON.stringify(result) };
				} catch (e) {
					return {
						type: 'tool_result' as const,
						tool_use_id: b.id,
						content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
						is_error: true
					};
				}
			})
		);

		messages = [
			...messages,
			{ role: 'assistant' as const, content: finalMsg.content },
			{ role: 'user' as const, content: toolResults }
		];
	}

	// ターン上限に達した場合は最後のターンの内容を表示する
	applyEntityHint(lastTurnEvents, hintEntity);
	for (const e of lastTurnEvents) emit(e);
}
