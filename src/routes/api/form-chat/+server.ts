import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { dispatchTool, type ToolEnv } from '$lib/server/mcp';
import type { StreamEvent } from '$lib/server/ai/stream';
import { readonlyTools } from '$lib/server/ai/readonly-tools';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	const body = (await request.json()) as {
		message: string;
		formTitle: string;
		formFields: { key: string; label: string }[];
		history: { role: 'user' | 'assistant'; text: string }[];
		// ダイアログに表示中のレコード（詳細表示時）。指示語「この顧客」等の解決に使う
		recordContext?: {
			type: string;
			typeLabel: string;
			id: string;
			label: string;
			data?: Record<string, unknown>;
		} | null;
	};

	if (mockMode) {
		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
				await new Promise((r) => setTimeout(r, 300));
				for (const char of 'ご質問ありがとうございます。') {
					enqueue({ type: 'delta', text: char });
					await new Promise((r) => setTimeout(r, 20));
				}
				enqueue({ type: 'done' });
				controller.close();
			}
		});
		return new Response(stream, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
		});
	}

	if (!platform?.env?.DB) {
		return json({ error: 'DB not available' }, { status: 500 });
	}

	const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const sections: string[] = [
		'あなたは画面に開いているダイアログの内容についてユーザーをサポートするAIアシスタントです。'
	];

	const rc = body.recordContext;
	if (rc) {
		const dataLines = rc.data
			? Object.entries(rc.data)
					.filter(([, v]) => v != null && v !== '')
					.map(([k, v]) => `  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
					.join('\n')
			: '';
		sections.push(
			`現在ダイアログに表示中のレコード:
- 種別: ${rc.typeLabel}（${rc.type}）
- ID: ${rc.id}
- 名称: ${rc.label}${dataLines ? `\n- 表示中の内容:\n${dataLines}` : ''}

ユーザーが「このレコード」「これ」などと指示語で言及した場合は、上記の表示中レコードを指します（どのレコードか聞き返す必要はありません）。
関連するデータの取得が必要な場合は、上記のIDを使ってツールで取得してください。`
		);
	}

	if (body.formFields.length > 0) {
		const fieldList = body.formFields.map((f) => `- ${f.label}（${f.key}）`).join('\n');
		sections.push(
			`このダイアログは「${body.formTitle}」フォームです。ユーザーが各フィールドを正しく入力できるよう、具体的なアドバイスや情報を提供してください。
フォームのフィールド一覧:
${fieldList}`
		);
	}

	sections.push(
		`利用可能なツール: カスタムテーブルのデータを検索・取得・集計できます。
制約: データの登録・更新・削除・メール送信はできません。情報の取得のみ行えます。
日付・数値などは日本語で分かりやすく示し、回答は簡潔にしてください。`
	);

	const systemPrompt = sections.join('\n\n');

	const messages: MessageParam[] = [
		...body.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text })),
		{ role: 'user', content: body.message }
	];

	const anthropic = new Anthropic({ apiKey });

	const stream = new ReadableStream({
		async start(controller) {
			const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
			try {
				let currentMessages = messages;

				for (let turn = 0; turn < 5; turn++) {
					const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
					let currentTool: { id: string; name: string; inputJson: string } | null = null;
					let assistantText = '';

					const claudeStream = anthropic.messages.stream({
						model: 'claude-haiku-4-5-20251001',
						max_tokens: 1024,
						system: systemPrompt,
						tools: readonlyTools,
						messages: currentMessages
					});

					for await (const event of claudeStream) {
						if (event.type === 'content_block_start') {
							if (event.content_block.type === 'tool_use') {
								currentTool = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
							}
						} else if (event.type === 'content_block_delta') {
							if (event.delta.type === 'text_delta') {
								assistantText += event.delta.text;
								enqueue({ type: 'delta', text: event.delta.text });
							} else if (event.delta.type === 'input_json_delta' && currentTool) {
								currentTool.inputJson += event.delta.partial_json;
							}
						} else if (event.type === 'content_block_stop' && currentTool) {
							toolBlocks.push(currentTool);
							currentTool = null;
						}
					}

					const finalMsg = await claudeStream.finalMessage();
					if (finalMsg.stop_reason !== 'tool_use') break;

					// ツール呼び出しターン中のテキストはストリーム済みなのでそのまま継続
					const toolResults = await Promise.all(
						toolBlocks.map(async (b) => {
							try {
								const input = JSON.parse(b.inputJson || '{}');
								const result = await dispatchTool(db, b.name as never, input, toolEnv);
								return {
									type: 'tool_result' as const,
									tool_use_id: b.id,
									content: JSON.stringify(result)
								};
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

					currentMessages = [
						...currentMessages,
						{ role: 'assistant' as const, content: finalMsg.content },
						{ role: 'user' as const, content: toolResults }
					];
				}

				enqueue({ type: 'done' });
			} catch (e) {
				enqueue({ type: 'error', message: String(e) });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
	});
};
