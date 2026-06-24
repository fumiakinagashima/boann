import type { MessageContent } from '$lib/types/chat';

const MOCK_RESPONSES: MessageContent[][] = [
	[
		{ type: 'text', text: '顧客情報を登録します。以下のフォームに入力してください。' },
		{
			type: 'form',
			title: '顧客登録',
			tool: 'create_customer',
			fields: [
				{ key: 'name', label: '会社名', type: 'text', required: true, placeholder: '株式会社サンプル' },
				{ key: 'email', label: 'メールアドレス', type: 'email', placeholder: 'taro@example.com' },
				{ key: 'phone', label: '電話番号', type: 'tel', placeholder: '03-0000-0000' },
				{ key: 'postal_code', label: '郵便番号', type: 'text', placeholder: '100-0001' },
				{ key: 'address', label: '住所', type: 'text', placeholder: '東京都千代田区...' },
				{ key: 'website', label: 'ホームページ', type: 'text', placeholder: 'https://example.com' },
				{
					key: 'status',
					label: 'ステータス',
					type: 'select',
					options: [
						{ value: 'lead', label: 'リード' },
						{ value: 'active', label: '有効' },
						{ value: 'inactive', label: '無効' }
					]
				},
				{ key: 'notes', label: 'メモ', type: 'textarea', placeholder: '自由記述' }
			]
		}
	],
	[
		{ type: 'text', text: '登録済みの顧客一覧です。' },
		{
			type: 'table',
			columns: [
				{ key: 'name', label: '会社名' },
				{ key: 'email', label: 'メール' },
				{ key: 'status', label: 'ステータス' }
			],
			rows: [
				{ name: '株式会社アルコジー', email: 'taro@alcogy.com', status: 'active' },
				{ name: '合同会社テスト商事', email: 'hanako@test.co.jp', status: 'lead' },
				{ name: 'サンプル株式会社', email: 'jiro@sample.jp', status: 'inactive' }
			]
		}
	],
	[
		{ type: 'text', text: 'こんにちは！Midleton CRMです。何をお手伝いしましょうか？' },
		{
			type: 'actions',
			title: '操作を選択してください',
			actions: [
				{ id: 'create', label: '顧客を登録する', description: '新規顧客情報をフォームで入力します' },
				{ id: 'list', label: '顧客一覧を見る', description: '登録済みの顧客一覧を表示します' },
				{ id: 'report', label: 'レポートを見る', description: '月次の売上レポートを表示します' }
			]
		}
	],
	[
		{ type: 'text', text: '名刺を読み取ります。カメラで撮影するか、画像をアップロードしてください。' },
		{
			type: 'bizcard',
			title: '名刺を読み取ってください'
		}
	]
];

let mockIndex = 0;

export function mockChat(): MessageContent[] {
	const contents = MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length];
	mockIndex++;
	return contents;
}
