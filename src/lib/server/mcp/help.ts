import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

export const tools: Tool[] = [
	{
		name: 'get_help',
		description:
			'使い方・機能説明を取得する。ユーザーが「使い方を教えて」「何ができる？」「ヘルプ」「〇〇機能の使い方は？」などと聞いた時に呼び出す。topic を省略すると全体概要を返す',
		input_schema: {
			type: 'object',
			properties: {
				topic: {
					type: 'string',
					enum: ['overview', 'apps', 'tables', 'records', 'workflows', 'documents', 'reminders', 'email'],
					description: '知りたいトピック（省略時は全体概要）'
				}
			}
		}
	}
];

const getHelpInputSchema = z.object({
	topic: z.enum(['overview', 'apps', 'tables', 'records', 'workflows', 'documents', 'reminders', 'email']).optional()
});

const HELP: Record<string, object> = {
	overview: {
		title: 'Boann 使い方ガイド',
		description: 'チャットで業務指示を出すだけで、カスタムアプリの作成・データ管理・ワークフロー自動化などが完結するAIファーストなノーコードプラットフォームです',
		features: [
			{ name: 'ノーコードアプリ生成', topic: 'apps', examples: ['在庫管理アプリを作って', '採用候補者を管理するテーブルが欲しい', '問い合わせ管理アプリを作って'] },
			{ name: 'テーブル管理', topic: 'tables', examples: ['どんなテーブルがある？', '商品管理テーブルにカテゴリフィールドを追加して'] },
			{ name: 'レコード操作', topic: 'records', examples: ['在庫管理に新しい商品を登録して', '商品一覧を見せて', '〇〇の在庫数を更新して'] },
			{ name: 'ワークフロー自動化', topic: 'workflows', examples: ['毎日9時に在庫数が少ない商品を通知して', 'ワークフローを作りたい'] },
			{ name: '資料生成（CSV/Markdownデータ）', topic: 'documents', examples: ['商品一覧をExcel用にまとめて', 'データをCSVで出力して'] },
			{ name: 'リマインダー', topic: 'reminders', examples: ['明日の10時にフォローアップをリマインドして'] },
			{ name: 'メール送信', topic: 'email', examples: ['〇〇にお知らせメールを送って'] }
		],
		tips: [
			'自然な日本語で指示するだけでOKです',
			'各機能の詳しい使い方を聞く場合は「アプリ作成の使い方を教えて」のように指定してください',
			'データ管理・設定変更はサイドメニューの「データ管理」「設定」からも直接操作できます',
			'レコードの削除は、一覧の行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから行えます'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: '作成したアプリのテーブル・データを直接管理できます' },
			{ label: '設定', href: '/settings', description: 'アプリの各種設定を変更できます' }
		]
	},
	apps: {
		title: 'ノーコードアプリ生成',
		description: 'チャットで業務内容を伝えるだけで、カスタムテーブル・アプリをAIが自動設計して作成します',
		operations: [
			{ action: '新しいアプリを作成する', examples: ['在庫管理アプリを作って', '採用候補者のトラッキングテーブルが欲しい', '問い合わせ管理を作りたい', '社内の備品管理アプリを作って'] },
			{ action: 'フィールドを追加する', examples: ['在庫管理テーブルに「担当者」フィールドを追加して', '商品管理に「カテゴリ」列を追加して'] },
			{ action: '他テーブルと関連付ける', examples: ['案件管理テーブルを顧客テーブルと紐付けたい', '注文テーブルに商品を選択するフィールドを追加して'] }
		],
		tips: [
			'AIがフィールド構成を提案して確認を求めてから作成します',
			'テーブル同士を recordSelect フィールドで関連付けることができます',
			'作成後はデータ管理画面から直接データ操作ができます',
			'フィールド構成の変更はデータ管理のスキーマ編集画面からも行えます'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: '作成したアプリのテーブル一覧・スキーマ編集ができます' }
		]
	},
	tables: {
		title: 'テーブル管理',
		description: '作成したカスタムテーブルの確認・フィールド追加・削除ができます',
		operations: [
			{ action: 'テーブル一覧を確認する', examples: ['どんなテーブルがある？', 'テーブル一覧を見せて', '作成済みのアプリを教えて'] },
			{ action: 'フィールドを追加する', examples: ['〇〇テーブルに「△△」フィールドを追加して'] },
			{ action: 'テーブルを削除する', description: 'データ管理のスキーマ編集画面から削除できます', examples: ['〇〇テーブルを削除したい'] }
		],
		tips: [
			'テーブル名（識別名）は英小文字・数字・アンダースコアのみ使用できます',
			'システム予約語（accounts, reminders, workflows 等）はテーブル名として使用できません'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: 'テーブル一覧・スキーマ編集ができます' }
		]
	},
	records: {
		title: 'レコード操作',
		description: 'カスタムテーブルのデータ（レコード）の登録・一覧表示・更新・削除ができます',
		operations: [
			{ action: 'レコードを登録する', examples: ['在庫管理に新しい商品を追加して', '〇〇テーブルにデータを登録したい'] },
			{ action: 'レコード一覧を見る', examples: ['商品一覧を見せて', '〇〇テーブルのデータを表示して'] },
			{ action: 'レコードを更新する', examples: ['〇〇の在庫数を10に変更して', '〇〇テーブルの〇〇レコードを編集して'] },
			{ action: 'レコードを削除する', description: 'チャットまたはデータ管理の一覧で行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから削除します', examples: ['〇〇レコードを削除したい'] }
		],
		tips: [
			'データ管理画面からも直接レコードの登録・編集・削除ができます',
			'行クリックで詳細ダイアログを開けます（チャットの一覧テーブルでも使えます）'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: '各テーブルのレコード一覧・登録・編集・削除ができます' }
		]
	},
	workflows: {
		title: 'ワークフロー自動化',
		description: '毎日決まった時刻に実行する自動化フローを作成できます（通知・集計・メール送信など）',
		operations: [
			{ action: 'ワークフローを作成する', examples: ['毎日9時に未処理の〇〇を通知して', 'ワークフローを作りたい', '定期実行の自動化フローを作って'] },
			{ action: 'ワークフロー一覧を確認する', examples: ['設定済みのワークフローは？', 'どんなワークフローがある？'] },
			{ action: 'ワークフローを編集する', examples: ['〇〇ワークフローのトリガー時刻を変えて', '〇〇ワークフローにステップを追加して'] }
		],
		tips: [
			'トリガーは毎日の決まった時刻のみ対応しています',
			'action（ツール実行）/ condition（条件分岐）/ foreach（繰り返し）の3種類のステップを組み合わせます',
			'ワークフロー管理画面から有効化・無効化・実行ログの確認ができます'
		],
		relatedPages: [
			{ label: 'ワークフロー管理', href: '/database/workflows', description: 'ワークフローの一覧・有効化・実行ログ確認ができます' }
		]
	},
	documents: {
		title: '資料生成（CSV / Markdownデータ出力）',
		description: 'テーブルのデータをCSV・Markdown形式で出力し、ExcelやAIツールで加工できる素材ファイルを生成します',
		operations: [
			{ action: 'データをCSVで出力する', description: 'Excelで開ける表形式データ', examples: ['商品一覧をCSVで出力して', '〇〇テーブルのデータをExcel用にまとめて'] },
			{ action: 'Markdownレポートを生成する', description: '文章・複数テーブル混在の報告書', examples: ['〇〇のサマリーレポートを作って', '月次まとめをMarkdownで生成して'] }
		],
		tips: [
			'生成したファイルはダウンロードリンクから取得できます',
			'Excel・ChatGPT・Copilotなどの外部ツールで加工するための素材ファイルです',
			'具体的な加工内容を伝えると、外部AIツール向けのプロンプトも一緒に生成します'
		]
	},
	reminders: {
		title: 'リマインダー',
		description: '指定した日時に通知センター・メール・Slack（連携設定済みの場合）へ通知を送ります',
		operations: [
			{ action: 'リマインダーを設定する', examples: ['明日の10時にフォローアップをリマインドして', '来週月曜に〇〇を通知して', '今日の15:00に会議の連絡をして'] }
		],
		tips: [
			'通知先はフォーム送信時に選択できます（通知センター・メール・Slack）',
			'Slack通知は外部API連携画面でWebhook URLの設定が必要です'
		],
		relatedPages: [
			{ label: 'リマインダー管理', href: '/database/reminders', description: '登録済みリマインダーの確認・削除ができます' },
			{ label: '外部API連携', href: '/settings/integrations', description: 'Slack Webhook URLの設定ができます' }
		]
	},
	email: {
		title: 'メール送信',
		operations: [
			{ action: 'メールを作成・送信する', examples: ['〇〇にお知らせメールを送って', '△△担当者にフォローアップメールを書いて', '確認メールを作成して'] }
		],
		tips: [
			'AIが下書きを作成し、フォームで内容を確認・編集してから送信します',
			'初回利用時はメール設定画面でメールサービスの設定が必要です'
		],
		relatedPages: [
			{ label: 'メール設定', href: '/settings/email', description: 'メール送信サービスの設定ができます' }
		]
	}
};

export function handleGetHelp(input: unknown) {
	const { topic } = getHelpInputSchema.parse(input ?? {});
	return HELP[topic ?? 'overview'];
}
