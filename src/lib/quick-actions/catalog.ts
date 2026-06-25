// クイックアクション: チャット入力欄の「+」ボタンから AI を介さず直接呼び出せる MCP ツールのカタログ。
// クライアント（チャット入力欄・設定画面）と共有するため、サーバー専用の依存（DB・dispatchTool 等）は持たない。

export type QuickActionId =
	| 'list_entity_types'
	| 'list_workflows'
	| 'create_app';

export type QuickActionDef = {
	id: QuickActionId;
	label: string;
	description: string;
	icon: string;
};

export const quickActionCatalog: QuickActionDef[] = [
	{ id: 'list_entity_types', label: 'テーブル一覧', description: '作成済みのカスタムテーブルを表示します', icon: '🗂️' },
	{ id: 'list_workflows', label: 'ワークフロー一覧', description: '設定済みのワークフローを表示します', icon: '⚙️' },
	{ id: 'create_app', label: 'アプリ作成', description: 'AIにアプリの説明を送ってテーブルを作成します', icon: '✨' }
];

export const DEFAULT_QUICK_ACTION_IDS: QuickActionId[] = [
	'list_entity_types',
	'list_workflows'
];

export const MAX_QUICK_ACTIONS = 5;

export const QUICK_ACTIONS_STORAGE_KEY = 'quickActionIds';

export function isQuickActionId(id: string): id is QuickActionId {
	return quickActionCatalog.some((a) => a.id === id);
}
