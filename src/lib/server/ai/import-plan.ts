import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

// ファイル（txt/md 等の仕様メモ）から、アプリ構造（テーブル・フィールド・ページ）を
// 推論してプラン化する。確定（DBへの反映）は import-apply.ts が決定的に行う。
// LLM はあくまで「設計案」を出すだけで、レコードの一括投入などは決定的コードに任せる。

const FIELD_TYPES = ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'] as const;

const fieldSchema = z.object({
	key: z.string().regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z.enum(FIELD_TYPES).default('text'),
	required: z.boolean().default(false),
	options: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
	ref_table: z.string().optional()
});

const componentSchema = z.object({
	type: z.enum(['list', 'form']),
	table_name: z.string(),
	title: z.string().optional(),
	fields: z.array(z.string()).optional(),
	actions: z.array(z.enum(['create', 'edit', 'delete'])).optional()
});

const tableSchema = z.object({
	name: z.string().regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(fieldSchema).min(1)
});

const pageSchema = z.object({
	label: z.string().min(1),
	components: z.array(componentSchema).min(1)
});

export const importPlanSchema = z.object({
	app: z.object({
		name: z.string().regex(/^[a-z0-9_]+$/),
		label: z.string().min(1),
		icon: z.string().optional()
	}),
	tables: z.array(tableSchema).min(1),
	pages: z.array(pageSchema).default([]),
	// ワークフローは現状プランに含めても自動作成しない（情報提示のみ）。
	workflows: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([])
});

export type ImportPlan = z.infer<typeof importPlanSchema>;

const PLAN_TOOL: Tool = {
	name: 'emit_app_plan',
	description: 'ファイルの内容から設計したアプリ構造（テーブル・フィールド・ページ）を出力する。',
	input_schema: {
		type: 'object',
		properties: {
			app: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'アプリの識別名（英小文字・数字・アンダースコアのみ、例: customer_management）' },
					label: { type: 'string', description: 'アプリの表示名（例: 顧客管理）' },
					icon: { type: 'string', description: 'アイコン（絵文字推奨 例: 📇）' }
				},
				required: ['name', 'label']
			},
			tables: {
				type: 'array',
				description: 'アプリに含めるテーブル一覧',
				items: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'テーブルの識別名（英小文字・数字・アンダースコアのみ、例: customers）' },
						label: { type: 'string', description: 'テーブルの表示名（例: 顧客マスタ）' },
						icon: { type: 'string', description: 'アイコン（絵文字推奨）' },
						fields: {
							type: 'array',
							description: 'フィールド定義（表示順）',
							items: {
								type: 'object',
								properties: {
									key: { type: 'string', description: 'フィールドキー（英小文字・数字・アンダースコアのみ）' },
									label: { type: 'string', description: 'フィールドの表示名' },
									type: {
										type: 'string',
										enum: [...FIELD_TYPES],
										description: 'フィールドの型。recordSelect は他テーブルのレコードを参照する関係フィールド。account はアカウント（ユーザー）を参照する関係フィールドで ref_table は不要（自動で accounts を参照し、表示・選択肢ではアカウント名を表示）'
									},
									required: { type: 'boolean' },
									options: {
										type: 'array',
										items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
										description: 'type が select のときの選択肢'
									},
									ref_table: { type: 'string', description: 'type が recordSelect のときの参照先テーブルの name（このプラン内の tables の name を指定）' }
								},
								required: ['key', 'label', 'type']
							}
						}
					},
					required: ['name', 'label', 'fields']
				}
			},
			pages: {
				type: 'array',
				description: '画面（ページ）一覧。各テーブルには最低1つの一覧ページを用意する。',
				items: {
					type: 'object',
					properties: {
						label: { type: 'string', description: 'ページの表示名（例: 顧客一覧）' },
						components: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									type: { type: 'string', enum: ['list', 'form'], description: 'list: 一覧表示, form: 登録フォーム' },
									table_name: { type: 'string', description: '対象テーブルの name（tables の name を指定）' },
									title: { type: 'string' },
									fields: { type: 'array', items: { type: 'string' }, description: '表示するフィールドキー（省略時は全フィールド）' },
									actions: { type: 'array', items: { type: 'string', enum: ['create', 'edit', 'delete'] } }
								},
								required: ['type', 'table_name']
							}
						}
					},
					required: ['label', 'components']
				}
			},
			workflows: {
				type: 'array',
				description: 'ファイルに記載があれば、ワークフロー（自動処理）の名称と概要を列挙する（このプランでは作成されず、後で手動追加する）。',
				items: {
					type: 'object',
					properties: { name: { type: 'string' }, description: { type: 'string' } },
					required: ['name']
				}
			}
		},
		required: ['app', 'tables', 'pages']
	}
};

const SYSTEM_PROMPT = `あなたはノーコードアプリ基盤 Boann の設計アシスタントです。
ユーザーがアップロードした仕様メモ（テキスト/Markdown）を読み、業務アプリの構造を設計してください。

設計ルール:
- ファイルの内容から必要なテーブル・フィールド・ページを過不足なく設計する。
- 表示名（label）は日本語、識別名（name/key）は英小文字・数字・アンダースコアのみ。
- テーブル間の関係は recordSelect 型フィールドで表現し、ref_table に参照先テーブルの name を指定する。
- 各テーブルには最低1つの一覧ページ（list コンポーネント）を用意する。詳細・登録が必要なら form も追加する。
- 一般的な業務に必要な基本フィールド（名称・日付・担当者・ステータス等）は文面に明示がなくても適宜補う。
- ファイルにワークフロー（自動処理）の記載があれば workflows に列挙する（作成はしない）。
- 必ず emit_app_plan ツールを呼び出して結果を返す。`;

export async function generateImportPlan(opts: {
	apiKey: string;
	model: string;
	content: string;
	filename: string;
}): Promise<ImportPlan> {
	const anthropic = new Anthropic({ apiKey: opts.apiKey });
	const response = await anthropic.messages.create({
		model: opts.model,
		max_tokens: 4096,
		system: SYSTEM_PROMPT,
		tools: [PLAN_TOOL],
		tool_choice: { type: 'tool', name: 'emit_app_plan' },
		messages: [
			{ role: 'user', content: `ファイル名: ${opts.filename}\n\n--- ファイル内容 ---\n${opts.content}` }
		]
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('プランを生成できませんでした');
	}
	return importPlanSchema.parse(block.input);
}

const REFINE_SYSTEM_PROMPT = `あなたはノーコードアプリ基盤 Boann の設計アシスタントです。
既に設計済みのアプリのプラン（JSON）に対し、ユーザーの修正依頼を反映した**新しいプラン全体**を出力します。

ルール:
- 依頼された変更のみを反映し、それ以外の構成・命名は極力維持する。
- 表示名（label）は日本語、識別名（name/key）は英小文字・数字・アンダースコアのみ。
- テーブル間の関係は recordSelect 型フィールド（ref_table に参照先テーブルの name）で表現する。
- 各テーブルには最低1つの一覧ページを保つ。
- 必ず emit_app_plan ツールでプラン全体を返す（差分ではなく完全な新プラン）。`;

export async function refineImportPlan(opts: {
	apiKey: string;
	model: string;
	currentPlan: ImportPlan;
	content: string | null;
	message: string;
	history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<ImportPlan> {
	const anthropic = new Anthropic({ apiKey: opts.apiKey });
	const pastRequests = opts.history
		.filter((m) => m.role === 'user')
		.map((m) => `- ${m.text}`)
		.join('\n');

	const userText = [
		'現在のプラン(JSON):',
		'```json',
		JSON.stringify(opts.currentPlan, null, 2),
		'```',
		opts.content ? `\n元のファイル内容:\n---\n${opts.content}\n---` : '',
		pastRequests ? `\nこれまでの修正依頼:\n${pastRequests}` : '',
		`\n今回の修正依頼:\n${opts.message}`,
		'\n上記を反映した新しいプラン全体を emit_app_plan で返してください。'
	].join('\n');

	const response = await anthropic.messages.create({
		model: opts.model,
		max_tokens: 4096,
		system: REFINE_SYSTEM_PROMPT,
		tools: [PLAN_TOOL],
		tool_choice: { type: 'tool', name: 'emit_app_plan' },
		messages: [{ role: 'user', content: userText }]
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('プランを更新できませんでした');
	}
	return importPlanSchema.parse(block.input);
}

// MOCK_AI 用の決定的プラン（顧客管理の例）。
export function mockImportPlan(_content: string): ImportPlan {
	return importPlanSchema.parse({
		app: { name: 'customer_management', label: '顧客管理', icon: '📇' },
		tables: [
			{
				name: 'customers',
				label: '顧客マスタ',
				icon: '🏢',
				fields: [
					{ key: 'name', label: '顧客名', type: 'text', required: true },
					{ key: 'email', label: 'メール', type: 'email' },
					{ key: 'phone', label: '電話番号', type: 'tel' },
					{ key: 'status', label: 'ステータス', type: 'select', options: [
						{ value: 'active', label: '取引中' },
						{ value: 'prospect', label: '見込み' }
					] }
				]
			},
			{
				name: 'activities',
				label: '活動履歴',
				icon: '📝',
				fields: [
					{ key: 'customer', label: '顧客', type: 'recordSelect', ref_table: 'customers', required: true },
					{ key: 'occurred_on', label: '実施日', type: 'date' },
					{ key: 'memo', label: '内容', type: 'textarea' },
					{ key: 'shared_with', label: '共有者', type: 'text' }
				]
			}
		],
		pages: [
			{ label: '顧客一覧', components: [{ type: 'list', table_name: 'customers' }] },
			{
				label: '顧客詳細',
				components: [
					{ type: 'form', table_name: 'customers' },
					{ type: 'list', table_name: 'activities', title: '活動履歴' }
				]
			}
		],
		workflows: [
			{ name: '活動履歴の共有通知', description: '活動履歴登録時、共有者に通知を送信する' }
		]
	});
}
