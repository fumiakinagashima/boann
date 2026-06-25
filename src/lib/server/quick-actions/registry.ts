import type { Db } from '../db';
import { dispatchTool, type ToolName, type ToolEnv } from '../mcp';
import type { MessageContent } from '$lib/types/chat';
import type { QuickActionId } from '$lib/quick-actions/catalog';

type ToolQuickActionHandler = {
	tool: ToolName;
	input?: Record<string, unknown>;
	format: (result: unknown) => MessageContent[];
};

type StaticQuickActionHandler = {
	contents: MessageContent[];
};

type DynamicQuickActionHandler = {
	build: (db: Db, env?: ToolEnv) => Promise<MessageContent[]>;
};

type QuickActionHandler = ToolQuickActionHandler | StaticQuickActionHandler | DynamicQuickActionHandler;

function isToolHandler(handler: QuickActionHandler): handler is ToolQuickActionHandler {
	return 'tool' in handler;
}

function isDynamicHandler(handler: QuickActionHandler): handler is DynamicQuickActionHandler {
	return 'build' in handler;
}

const handlers: Record<QuickActionId, QuickActionHandler> = {
	list_entity_types: {
		tool: 'list_entity_types',
		input: {},
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'カスタムテーブルはまだありません。「〇〇の管理テーブルを作って」と話しかけてみてください。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'icon', label: '' },
						{ key: 'label', label: 'テーブル名' },
						{ key: 'name', label: '識別名' }
					],
					rows
				}
			];
		}
	},

	list_workflows: {
		tool: 'list_workflows',
		input: {},
		format: (result) => {
			const rows = result as Record<string, unknown>[];
			if (rows.length === 0) return [{ type: 'text', text: 'ワークフローはまだありません。' }];
			return [
				{
					type: 'table',
					columns: [
						{ key: 'name', label: 'ワークフロー名' },
						{ key: 'enabledLabel', label: '状態' }
					],
					rows: rows.map((r) => ({
						...r,
						enabledLabel: r.enabled ? '有効' : '無効'
					}))
				}
			];
		}
	},

	create_app: {
		contents: [
			{
				type: 'reply',
				title: 'アプリ作成',
				fields: [
					{
						key: 'description',
						label: 'どんなアプリを作りますか？（例: 社内の備品管理、採用候補者のトラッキング）',
						type: 'textarea',
						required: true
					}
				],
				submitLabel: 'AIに相談する'
			}
		]
	}
};

export async function runQuickAction(db: Db, id: QuickActionId, env?: ToolEnv): Promise<MessageContent[]> {
	const handler = handlers[id];
	if (isDynamicHandler(handler)) return handler.build(db, env);
	if (!isToolHandler(handler)) return handler.contents;
	const result = await dispatchTool(db, handler.tool, handler.input ?? {});
	return handler.format(result);
}
