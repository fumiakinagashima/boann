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
					enum: ['overview', 'customers', 'deals', 'activities', 'documents', 'approvals', 'apps', 'reminders', 'email'],
					description: '知りたいトピック（省略時は全体概要）'
				}
			}
		}
	}
];

const getHelpInputSchema = z.object({
	topic: z.enum(['overview', 'customers', 'deals', 'activities', 'documents', 'approvals', 'apps', 'reminders', 'email']).optional()
});

const HELP: Record<string, object> = {
	overview: {
		title: 'Midleton 使い方ガイド',
		description: 'チャットで業務指示を出すだけで、顧客管理・案件管理・資料作成・申請管理などが完結するAIファーストなCRM/SFAシステムです',
		features: [
			{ name: '顧客・担当者管理', topic: 'customers', examples: ['〇〇株式会社を登録して', '田中さんの会社を探して', '名刺を読み取って登録したい'] },
			{ name: '案件管理', topic: 'deals', examples: ['〇〇社に新しい案件を作って', '今月の商談状況を教えて', '案件をガントチャートで見せて'] },
			{ name: '活動履歴', topic: 'activities', examples: ['〇〇社に電話した記録を残して', '先週の活動一覧を見せて'] },
			{ name: '資料生成（Word/Excel/PowerPoint）', topic: 'documents', examples: ['今月の営業報告書をWordで作って', '案件一覧をExcelにまとめて', '会議用スライドを作って'] },
			{ name: '申請管理', topic: 'approvals', examples: ['出張費用の申請を作って', '承認待ちの申請は？'] },
			{ name: 'ノーコードアプリ生成', topic: 'apps', examples: ['在庫管理アプリを作って', 'プロジェクト管理テーブルが欲しい'] },
			{ name: 'リマインダー', topic: 'reminders', examples: ['明日の10時にフォローアップをリマインドして'] },
			{ name: 'メール送信', topic: 'email', examples: ['〇〇社にお礼メールを送って'] }
		],
		tips: [
			'自然な日本語で指示するだけでOKです',
			'各機能の詳しい使い方を聞く場合は「顧客管理の使い方を教えて」のように指定してください',
			'データ管理・設定変更はサイドメニューの「データ管理」「設定」からも直接操作できます',
			'顧客・案件・担当者・活動の削除は、一覧の行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから行えます'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: '顧客・案件・活動などのデータを直接管理できます' },
			{ label: '設定', href: '/settings', description: 'アプリの各種設定を変更できます' }
		]
	},
	customers: {
		title: '顧客・担当者管理',
		operations: [
			{ action: '顧客を登録する', examples: ['〇〇株式会社を顧客として登録して', '新規顧客を追加したい'] },
			{ action: '顧客と担当者を同時に登録する', examples: ['〇〇社の田中さんをまとめて登録して'] },
			{ action: '名刺をスキャンして登録する', examples: ['名刺を読み取って登録したい', '名刺をスキャンしたい'] },
			{ action: '顧客を検索・一覧表示する', examples: ['田中さんの会社を探して', '東京の顧客一覧を見せて'] },
			{ action: '顧客情報を更新する', examples: ['〇〇社のメールアドレスを変更して', '〇〇社のステータスを無効にして'] },
			{ action: '顧客情報を削除する', description: 'チャットまたはデータ管理の顧客一覧で行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから削除します', examples: ['〇〇社を削除したい', '〇〇社の情報を消したい'] },
			{ action: '担当者を追加する', examples: ['〇〇社に鈴木さんを担当者として登録して'] },
			{ action: '顧客の詳細を確認する', examples: ['〇〇社の案件・活動・担当者をまとめて教えて'] },
			{ action: 'ヘルススコアを確認する', examples: ['〇〇社との関係は良好？', 'スコアが低い顧客は？'] },
			{ action: '引き継ぎサマリーを作成する', examples: ['〇〇社の引き継ぎ資料を作って', '〇〇社とのやり取りをまとめて'] }
		],
		relatedPages: [
			{ label: '顧客一覧', href: '/database/customers', description: '顧客の一覧表示・登録・編集・削除ができます' }
		]
	},
	deals: {
		title: '案件管理',
		operations: [
			{ action: '案件を登録する', examples: ['〇〇社にシステム導入の案件を作って'] },
			{ action: '案件一覧・集計を見る', examples: ['今月の商談状況を教えて', '受注案件の合計金額は？', '案件をガントチャートで見せて', '営業パイプラインをカンバンで見せて'] },
			{ action: '案件のステータスを更新する', examples: ['〇〇案件を受注にして', '〇〇案件が失注になった'] },
			{ action: '案件を削除する', description: 'チャットまたはデータ管理の案件一覧で行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから削除します', examples: ['〇〇案件を削除したい', '〇〇社の案件を消して'] }
		],
		statusValues: [
			{ value: 'open', label: '商談中' },
			{ value: 'won', label: '受注' },
			{ value: 'lost', label: '失注' }
		],
		relatedPages: [
			{ label: '案件一覧', href: '/database/deals', description: '案件の一覧表示・登録・編集・削除ができます' }
		]
	},
	activities: {
		title: '活動履歴',
		operations: [
			{ action: '活動を記録する', examples: ['〇〇社に電話した記録を残して', '〇〇社との面談メモを追加して', '〇〇社にメールを送った'] },
			{ action: '活動履歴を確認する', examples: ['〇〇社との最近のやり取りは？', '今週の活動一覧を見せて'] },
			{ action: '活動履歴を削除する', description: 'チャットまたはデータ管理の活動一覧で行をクリックして詳細ダイアログを開き、右上の「削除」ボタンから削除します', examples: ['〇〇の活動記録を削除して', '誤って登録した活動を消したい'] }
		],
		activityTypes: [
			{ value: 'note', label: 'メモ' },
			{ value: 'call', label: '電話' },
			{ value: 'email', label: 'メール' },
			{ value: 'meeting', label: '面談' }
		],
		relatedPages: [
			{ label: '活動履歴一覧', href: '/database/activities', description: '活動履歴の一覧表示・登録・削除ができます' }
		]
	},
	documents: {
		title: '資料生成（Word / Excel / PowerPoint）',
		operations: [
			{ action: 'Word文書を作成する', description: '報告書・議事録など文章中心の資料', examples: ['今月の営業報告書をWordで作って', '〇〇社への提案書を作成して'] },
			{ action: 'Excelブックを作成する', description: '一覧・集計表など表形式データ', examples: ['案件一覧をExcelにまとめて', '今月の売上をExcelで集計して'] },
			{ action: 'PowerPointスライドを作成する', description: '会議・プレゼン用スライド', examples: ['営業会議用のスライドを作って', '〇〇社向けの提案スライドを作成して'] }
		],
		tips: [
			'AIがデータを収集してから生成するため、少し時間がかかる場合があります',
			'生成完了後、自動的にダウンロードリンクが表示されます',
			'どんな内容を含めてほしいか具体的に伝えると、より良い資料が作れます'
		]
	},
	approvals: {
		title: '申請管理',
		operations: [
			{ action: '申請を作成する', examples: ['出張費用10万円の申請を作って', '〇〇の承認申請を出したい'] },
			{ action: '申請一覧を確認する', examples: ['自分の申請状況を教えて', '承認待ちの申請は？'] },
			{ action: '申請を承認・否決する', examples: ['〇〇の申請を承認して', '〇〇申請のステップ1を却下して'] },
			{ action: '申請を取り消す', examples: ['〇〇の申請を取り消して'] }
		],
		tips: [
			'承認ルートは複数ステップ・並列承認に対応しています'
		],
		relatedPages: [
			{ label: '申請管理', href: '/database/approvals', description: '申請の詳細確認・承認・否決操作ができます' }
		]
	},
	apps: {
		title: 'ノーコードアプリ生成',
		description: 'CRMのコア機能（顧客/案件/活動）以外の業務データを管理するカスタムテーブル・アプリを対話で設計・作成できます',
		operations: [
			{ action: 'アプリを新規作成する', examples: ['在庫管理アプリを作って', 'プロジェクト管理テーブルが欲しい', '問い合わせ管理を作りたい'] },
			{ action: 'フィールドを追加する', examples: ['在庫管理テーブルに「担当者」フィールドを追加して'] },
			{ action: 'データを登録・確認する', examples: ['在庫管理に新しい商品を登録して', '在庫管理の一覧を見せて'] }
		],
		tips: [
			'AIが設計したフィールド構成を確認してから作成されます',
			'顧客・案件などのコアデータと関連付けることもできます',
			'作成後はデータ管理画面から直接データ管理ができます'
		],
		relatedPages: [
			{ label: 'データ管理', href: '/database', description: '作成したカスタムアプリのデータ管理ができます' }
		]
	},
	reminders: {
		title: 'リマインダー',
		description: '指定した日時に通知センター・メール・Slack（連携設定済みの場合）へ通知を送ります',
		operations: [
			{ action: 'リマインダーを設定する', examples: ['明日の10時にフォローアップをリマインドして', '来週月曜に〇〇社への提案書提出をリマインドして', '今日の15:00に会議を通知して'] }
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
			{ action: 'メールを作成・送信する', examples: ['〇〇社にお礼メールを送って', '田中さんにフォローアップメールを書いて', '〇〇社への提案メールを作成して'] }
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
