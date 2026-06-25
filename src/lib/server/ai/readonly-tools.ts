import { tools } from '$lib/server/mcp';

// 情報取得のみ許可するツール名のセット。フォーム入力サポート・ワークフロー構築サポートなど、
// データの登録・更新・削除を行わせたくない補助チャットで共有する。
export const READONLY_TOOL_NAMES = new Set([
	'list_integrations',
	'list_reminders',
	'list_entity_types',
	'get_entity_fields',
	'get_entities',
	'get_help'
]);

export const readonlyTools = tools.filter((t) => READONLY_TOOL_NAMES.has(t.name));
