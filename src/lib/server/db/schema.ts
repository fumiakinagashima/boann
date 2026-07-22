import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const apps = sqliteTable('apps', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	label: text('label').notNull(),
	icon: text('icon'),
	// 作成者のアカウントID。null は既存データ（移行前）または所有者を問わない共有アプリを表す。
	accountId: text('account_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// アプリを外部MCPサーバーとして公開するためのBearerトークン。1アプリにつき1トークン
// （app_id をPKにして1:1を強制、再発行は既存行をupsert）。平文は保存せずハッシュのみ保持する。
export const appMcpTokens = sqliteTable('app_mcp_tokens', {
	appId: text('app_id')
		.primaryKey()
		.references(() => apps.id),
	tokenHash: text('token_hash').notNull(),
	tokenPrefix: text('token_prefix').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
	createdBy: text('created_by')
});

export const entityTypes = sqliteTable(
	'entity_types',
	{
		id: text('id').primaryKey(),
		// name はアプリ内で一意（グローバルではない）。同名テーブルを別アプリで持てる。
		name: text('name').notNull(),
		label: text('label').notNull(),
		icon: text('icon'),
		appId: text('app_id').references(() => apps.id),
		sortOrder: integer('sort_order').notNull().default(0),
		// 外部MCPサーバー経由で許可するCRUD操作（デフォルト全許可）。「閲覧」はlist_/get_の両方をまとめて制御する。
		mcpCreate: integer('mcp_create', { mode: 'boolean' }).notNull().default(true),
		mcpRead: integer('mcp_read', { mode: 'boolean' }).notNull().default(true),
		mcpUpdate: integer('mcp_update', { mode: 'boolean' }).notNull().default(true),
		mcpDelete: integer('mcp_delete', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [uniqueIndex('entity_types_app_id_name_unique').on(t.appId, t.name)]
);

export const entityFields = sqliteTable('entity_fields', {
	id: text('id').primaryKey(),
	entityTypeId: text('entity_type_id')
		.notNull()
		.references(() => entityTypes.id),
	key: text('key').notNull(),
	label: text('label').notNull(),
	type: text('type', { enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'] })
		.notNull()
		.default('text'),
	required: integer('required', { mode: 'boolean' }).notNull().default(false),
	options: text('options').default('[]'),
	defaultValue: text('default_value'),
	description: text('description'),
	refTable: text('ref_table'),
	refLabelKey: text('ref_label_key'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const entities = sqliteTable('entities', {
	id: text('id').primaryKey(),
	entityTypeId: text('entity_type_id')
		.notNull()
		.references(() => entityTypes.id),
	data: text('data').notNull().default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	createdBy: text('created_by'),
	updatedBy: text('updated_by'),
});

export const integrations = sqliteTable('integrations', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	baseUrl: text('base_url').notNull(),
	authType: text('auth_type', { enum: ['none', 'api_key', 'bearer', 'basic'] })
		.notNull()
		.default('none'),
	authConfig: text('auth_config').notNull().default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ワークフローの「外部APIを呼び出す」アクション専用の連携設定。上の`integrations`（Slack通知等、
// 通知目的の連携）とは目的が別のシステム単位の設定（2026-07-22、ユーザー方針）。
// 認証はauthType別のフィールドではなく、汎用的なヘッダーのkey/valueのみ（headers列にJSON保存）。
export const externalApiConnections = sqliteTable('external_api_connections', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	url: text('url').notNull(),
	headers: text('headers').notNull().default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	createdBy: text('created_by')
});

export const emailProviders = sqliteTable('email_providers', {
	id: text('id').primaryKey(),
	provider: text('provider', { enum: ['resend', 'ses', 'smtp'] })
		.notNull()
		.default('resend'),
	config: text('config').notNull().default('{}'),
	fromAddress: text('from_address').notNull().default(''),
	fromName: text('from_name'),
	signature: text('signature'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const aiSettings = sqliteTable('ai_settings', {
	id: text('id').primaryKey(),
	model: text('model').notNull().default('claude-haiku-4-5-20251001'),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const accounts = sqliteTable('accounts', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email'),
	role: text('role'),
	permission: text('permission', { enum: ['general', 'admin'] }).notNull().default('general'),
	passwordHash: text('password_hash'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const notifications = sqliteTable('notifications', {
	id: text('id').primaryKey(),
	type: text('type').notNull().default('generic'),
	title: text('title').notNull(),
	body: text('body').notNull().default(''),
	seedContent: text('seed_content').notNull().default('[]'),
	accountId: text('account_id').notNull(),
	isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const importJobs = sqliteTable('import_jobs', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	// 'designing' | 'ready' | 'applying' | 'done' | 'error'
	status: text('status').notNull().default('designing'),
	filename: text('filename'),
	content: text('content'),
	// 設計完了で埋まる ImportPlan の JSON。チャット修正で可変。
	plan: text('plan'),
	// プラン修正チャットの履歴（MessageContent ベース）の JSON。
	chat: text('chat').notNull().default('[]'),
	appId: text('app_id'),
	error: text('error'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const chats = sqliteTable('chats', {
	id: text('id').primaryKey(),
	title: text('title').notNull().default(''),
	accountId: text('account_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const chatMessages = sqliteTable('chat_messages', {
	id: text('id').primaryKey(),
	chatId: text('chat_id')
		.notNull()
		.references(() => chats.id),
	role: text('role', { enum: ['user', 'assistant'] }).notNull(),
	contents: text('contents').notNull().default('[]'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const workflows = sqliteTable('workflows', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	// MCPツールとして公開する際のdescriptionに使う自由記述の説明文（未設定ならフォールバック文言を使う）。
	description: text('description'),
	steps: text('steps').notNull().default('[]'),
	inputSchema: text('input_schema').notNull().default('[]'),
	triggerType: text('trigger_type').notNull().default('schedule'),
	triggerHour: integer('trigger_hour').notNull(),
	triggerMinute: integer('trigger_minute').notNull(),
	triggerEvent: text('trigger_event'),
	triggerEntityTypeId: text('trigger_entity_type_id'),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	accountId: text('account_id'),
	appId: text('app_id').references(() => apps.id),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const workflowRuns = sqliteTable('workflow_runs', {
	id: text('id').primaryKey(),
	workflowId: text('workflow_id').notNull().references(() => workflows.id),
	ok: integer('ok', { mode: 'boolean' }).notNull(),
	error: text('error'),
	log: text('log'),
	startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
	finishedAt: integer('finished_at', { mode: 'timestamp' }).notNull()
});

export const bookmarks = sqliteTable('bookmarks', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	appId: text('app_id')
		.notNull()
		.references(() => apps.id),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type EntityType = typeof entityTypes.$inferSelect;
export type EntityField = typeof entityFields.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type EmailProviderSettings = typeof emailProviders.$inferSelect;
export type NewEmailProviderSettings = typeof emailProviders.$inferInsert;
export type AiSettings = typeof aiSettings.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
