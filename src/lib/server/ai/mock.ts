import type { MessageContent } from '$lib/types/chat';

const MOCK_RESPONSES: MessageContent[][] = [
	[
		{ type: 'text', text: 'アプリを作成します。以下のフィールド構成で「在庫管理」テーブルを作成してよいですか？' },
		{
			type: 'table',
			columns: [
				{ key: 'label', label: 'フィールド名' },
				{ key: 'type', label: '型' },
				{ key: 'required', label: '必須' }
			],
			rows: [
				{ label: '商品名', type: '文字', required: '必須' },
				{ label: '在庫数', type: '数値', required: '任意' },
				{ label: '単価', type: '数値', required: '任意' },
				{ label: 'カテゴリ', type: '選択', required: '任意' }
			]
		}
	],
	[
		{ type: 'text', text: '登録済みのテーブル一覧です。' },
		{
			type: 'table',
			columns: [
				{ key: 'icon', label: '' },
				{ key: 'label', label: 'テーブル名' },
				{ key: 'name', label: '識別名' }
			],
			rows: [
				{ icon: '📦', label: '在庫管理', name: 'inventory' },
				{ icon: '📋', label: 'タスク管理', name: 'tasks' },
				{ icon: '📞', label: '問い合わせ管理', name: 'inquiries' }
			]
		}
	],
	[
		{ type: 'text', text: 'こんにちは！Boannです。何をお手伝いしましょうか？' }
	]
];

let mockIndex = 0;

export function mockChat(): MessageContent[] {
	const contents = MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length];
	mockIndex++;
	return contents;
}
