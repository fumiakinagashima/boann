import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const customers = sqliteTable('customers', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email'),
	phone: text('phone'),
	address: text('address'),
	postalCode: text('postal_code'),
	website: text('website'),
	status: text('status', { enum: ['active', 'inactive'] })
		.notNull()
		.default('active'),
	notes: text('notes'),
	custom: text('custom').default('{}'),
	healthScore: integer('health_score'),
	healthScoreLevel: text('health_score_level', { enum: ['good', 'warning', 'risk'] }),
	healthScoreSummary: text('health_score_summary'),
	healthScorePositives: text('health_score_positives').default('[]'),
	healthScoreConcerns: text('health_score_concerns').default('[]'),
	healthScoreUpdatedAt: integer('health_score_updated_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const contacts = sqliteTable('contacts', {
	id: text('id').primaryKey(),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	name: text('name').notNull(),
	nameKana: text('name_kana'),
	email: text('email'),
	phone: text('phone'),
	role: text('role'),
	department: text('department'),
	notes: text('notes'),
	custom: text('custom').default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const deals = sqliteTable('deals', {
	id: text('id').primaryKey(),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	title: text('title').notNull(),
	amount: integer('amount'),
	status: text('status', { enum: ['open', 'won', 'lost'] })
		.notNull()
		.default('open'),
	closedAt: integer('closed_at', { mode: 'timestamp' }),
	plannedStart: text('planned_start'),
	plannedEnd: text('planned_end'),
	notes: text('notes'),
	custom: text('custom').default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const activities = sqliteTable('activities', {
	id: text('id').primaryKey(),
	customerId: text('customer_id')
		.notNull()
		.references(() => customers.id),
	type: text('type', { enum: ['note', 'call', 'email', 'meeting', 'deal_created'] })
		.notNull()
		.default('note'),
	content: text('content').notNull(),
	// ユーザーが任意で設定する「実際に活動を行った日時」（登録日時 createdAt と異なる場合に使う）
	activityDate: integer('activity_date', { mode: 'timestamp' }),
	// 登録者の accountId（セッションから設定）。ログイン実装前の既存データは ''
	createdBy: text('created_by').notNull().default(''),
	custom: text('custom').default('{}'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const entityTypes = sqliteTable('entity_types', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	label: text('label').notNull(),
	icon: text('icon'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const entityFields = sqliteTable('entity_fields', {
	id: text('id').primaryKey(),
	entityTypeId: text('entity_type_id')
		.notNull()
		.references(() => entityTypes.id),
	key: text('key').notNull(),
	label: text('label').notNull(),
	type: text('type', { enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'] })
		.notNull()
		.default('text'),
	required: integer('required', { mode: 'boolean' }).notNull().default(false),
	options: text('options').default('[]'),
	refTable: text('ref_table'),
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
		.default(sql`(unixepoch())`)
});

export const coreCustomFields = sqliteTable('core_custom_fields', {
	id: text('id').primaryKey(),
	tableName: text('table_name').notNull(),
	key: text('key').notNull(),
	label: text('label').notNull(),
	type: text('type', { enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'] })
		.notNull()
		.default('text'),
	required: integer('required', { mode: 'boolean' }).notNull().default(false),
	options: text('options').default('[]'),
	refTable: text('ref_table'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
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

export const approvalRequests = sqliteTable('approval_requests', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	type: text('type').notNull(),
	entityType: text('entity_type'),
	entityId: text('entity_id'),
	status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled'] })
		.notNull()
		.default('pending'),
	submittedBy: text('submitted_by').notNull().default(''),
	data: text('data').notNull().default('{}'),
	route: text('route').notNull().default('[]'),
	attachments: text('attachments').notNull().default('[]'),
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

export const reminders = sqliteTable('reminders', {
	id: text('id').primaryKey(),
	remindAt: integer('remind_at', { mode: 'timestamp' }).notNull(),
	content: text('content').notNull(),
	// JSON配列: 'notification' | 'email' | 'slack:<integration_id>'
	channels: text('channels').notNull().default('[]'),
	status: text('status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
	// null = 全アカウント共通（ログイン実装前の既存データ）。配信先メールは getAccount(accountId)?.email、なければ REMINDER_EMAIL_TO にフォールバック
	accountId: text('account_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const chats = sqliteTable('chats', {
	id: text('id').primaryKey(),
	title: text('title').notNull().default(''),
	// null = 全アカウント共通（ログイン実装前の既存データ）。読み取りは accountId IS NULL OR accountId = <自分> でフィルタする
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
	// WorkflowStep[] のJSON（src/lib/types/chat.ts）
	steps: text('steps').notNull().default('[]'),
	triggerHour: integer('trigger_hour').notNull(),
	triggerMinute: integer('trigger_minute').notNull(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	// null = 全アカウント共通（ログイン実装前の既存データ想定）
	accountId: text('account_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type EntityType = typeof entityTypes.$inferSelect;
export type EntityField = typeof entityFields.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type CoreCustomField = typeof coreCustomFields.$inferSelect;
export type EmailProviderSettings = typeof emailProviders.$inferSelect;
export type NewEmailProviderSettings = typeof emailProviders.$inferInsert;
export type AiSettings = typeof aiSettings.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export const workflowRuns = sqliteTable('workflow_runs', {
	id: text('id').primaryKey(),
	workflowId: text('workflow_id').notNull(),
	ok: integer('ok', { mode: 'boolean' }).notNull(),
	error: text('error'),
	startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
	finishedAt: integer('finished_at', { mode: 'timestamp' }).notNull()
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;

export const briefings = sqliteTable('briefings', {
	id: text('id').primaryKey(),
	// null = 全アカウント共通。通常はログイン中アカウントのIDを設定する
	accountId: text('account_id'),
	// JST日付文字列 "YYYY-MM-DD"
	date: text('date').notNull(),
	// MessageContent[] をJSON文字列化して保存
	contents: text('contents').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type Briefing = typeof briefings.$inferSelect;
export type NewBriefing = typeof briefings.$inferInsert;
