import { and, eq, like, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers, deals, activities } from '../db/schema';
import { parseJson, toDate } from './shared';

export const tools: Tool[] = [
	{
		name: 'search_customers',
		description:
			'案件・活動のリレーション条件で顧客を検索する。「open案件を持つ顧客」「今月面談した顧客」など単純フィルタでは届かない絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '顧客名（部分一致）' },
				status: { type: 'string', enum: ['active', 'inactive'] },
				has_deal_status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: '指定ステータスの案件を持つ顧客に絞り込む'
				},
				deal_since: { type: 'string', description: '案件の対象期間・開始日（ISO 8601）' },
				deal_until: { type: 'string', description: '案件の対象期間・終了日（ISO 8601）' },
				has_activity_type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created'],
					description: '指定種別の活動を持つ顧客に絞り込む'
				},
				activity_since: { type: 'string', description: '活動の対象期間・開始日（ISO 8601）' },
				activity_until: { type: 'string', description: '活動の対象期間・終了日（ISO 8601）' },
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'search_deals',
		description:
			'案件を複合条件で検索する。顧客ID・顧客名（JOIN）・金額範囲・期間など get_deals より柔軟な絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客のIDで絞り込む' },
				customer_name: { type: 'string', description: '顧客名（部分一致）' },
				status: { type: 'string', enum: ['open', 'won', 'lost'] },
				amount_min: { type: 'number', description: '金額の下限（円）' },
				amount_max: { type: 'number', description: '金額の上限（円）' },
				since: { type: 'string', description: '開始日（ISO 8601）' },
				until: { type: 'string', description: '終了日（ISO 8601）' },
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: '期間の基準日（デフォルト: created_at）'
				},
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'search_activities',
		description:
			'活動履歴を複合条件で検索する。customer_id で顧客に絞り込める。content のキーワード検索も可能。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客のIDで絞り込む' },
				type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created']
				},
				content: { type: 'string', description: '活動内容のキーワード（部分一致）' },
				since: { type: 'string', description: '開始日（ISO 8601）' },
				until: { type: 'string', description: '終了日（ISO 8601）' },
				limit: { type: 'number', description: '取得件数（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'summarize_deals',
		description:
			'案件を件数・金額でステータス別に集計する。「今月の受注合計は？」「open案件の総額は？」などの質問に使う。期間・顧客で絞り込み可能。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '特定の顧客に絞り込む' },
				since: {
					type: 'string',
					description: '集計開始日（ISO 8601 形式 例: 2025-01-01）'
				},
				until: {
					type: 'string',
					description: '集計終了日（ISO 8601 形式 例: 2025-12-31）'
				},
				date_field: {
					type: 'string',
					enum: ['created_at', 'closed_at'],
					description: '期間絞り込みの基準日（デフォルト: created_at）'
				}
			},
			required: []
		}
	},
	{
		name: 'summarize_customers',
		description:
			'顧客数をステータス別（active/inactive）に集計する。「顧客数は何社？」「有効な顧客は？」などに使う。',
		input_schema: {
			type: 'object',
			properties: {
				since: { type: 'string', description: '登録日の開始日（ISO 8601 形式）' },
				until: { type: 'string', description: '登録日の終了日（ISO 8601 形式）' }
			},
			required: []
		}
	},
	{
		name: 'summarize_activities',
		description:
			'活動履歴を種別（note/call/email/meeting/deal_created）ごとに件数集計する。「今月の商談数は？」「電話した件数は？」などに使う。期間・顧客で絞り込み可能。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '特定の顧客に絞り込む' },
				since: { type: 'string', description: '集計開始日（ISO 8601 形式）' },
				until: { type: 'string', description: '集計終了日（ISO 8601 形式）' }
			},
			required: []
		}
	}
];

const searchCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	has_deal_status: z.enum(['open', 'won', 'lost']).optional(),
	deal_since: z.string().optional(),
	deal_until: z.string().optional(),
	has_activity_type: z
		.enum(['note', 'call', 'email', 'meeting', 'deal_created'])
		.optional(),
	activity_since: z.string().optional(),
	activity_until: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchCustomers(db: Db, input: unknown) {
	const p = searchCustomersSchema.parse(input);

	const dealSub = p.has_deal_status
		? db.selectDistinct({ id: deals.customerId }).from(deals).where(
				and(
					eq(deals.status, p.has_deal_status),
					p.deal_since ? gte(deals.createdAt, toDate(p.deal_since)) : undefined,
					p.deal_until ? lte(deals.createdAt, toDate(p.deal_until)) : undefined
				)
			)
		: null;

	const actSub = p.has_activity_type
		? db.selectDistinct({ id: activities.customerId }).from(activities).where(
				and(
					eq(activities.type, p.has_activity_type),
					p.activity_since
						? gte(activities.createdAt, toDate(p.activity_since))
						: undefined,
					p.activity_until ? lte(activities.createdAt, toDate(p.activity_until)) : undefined
				)
			)
		: null;

	const rows = await db
		.select()
		.from(customers)
		.where(
			and(
				p.name ? like(customers.name, `%${p.name}%`) : undefined,
				p.status ? eq(customers.status, p.status) : undefined,
				dealSub ? inArray(customers.id, dealSub) : undefined,
				actSub ? inArray(customers.id, actSub) : undefined
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchDealsSchema = z.object({
	customer_id: z.string().optional(),
	customer_name: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	amount_min: z.number().optional(),
	amount_max: z.number().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at'),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchDeals(db: Db, input: unknown) {
	const p = searchDealsSchema.parse(input);
	const dateCol = p.date_field === 'closed_at' ? deals.closedAt : deals.createdAt;

	const rows = await db
		.select({
			id: deals.id,
			customerId: deals.customerId,
			customerName: customers.name,
			title: deals.title,
			amount: deals.amount,
			status: deals.status,
			closedAt: deals.closedAt,
			notes: deals.notes,
			custom: deals.custom,
			createdAt: deals.createdAt,
			updatedAt: deals.updatedAt
		})
		.from(deals)
		.leftJoin(customers, eq(deals.customerId, customers.id))
		.where(
			and(
				p.customer_id ? eq(deals.customerId, p.customer_id) : undefined,
				p.customer_name ? like(customers.name, `%${p.customer_name}%`) : undefined,
				p.status ? eq(deals.status, p.status) : undefined,
				p.amount_min !== undefined ? gte(deals.amount, p.amount_min) : undefined,
				p.amount_max !== undefined ? lte(deals.amount, p.amount_max) : undefined,
				p.since ? gte(dateCol, toDate(p.since)) : undefined,
				p.until ? lte(dateCol, toDate(p.until)) : undefined
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(p.limit);

	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

const searchActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).optional(),
	content: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

export async function handleSearchActivities(db: Db, input: unknown) {
	const p = searchActivitiesSchema.parse(input);

	return db
		.select()
		.from(activities)
		.where(
			and(
				p.customer_id ? eq(activities.customerId, p.customer_id) : undefined,
				p.type ? eq(activities.type, p.type) : undefined,
				p.content ? like(activities.content, `%${p.content}%`) : undefined,
				p.since ? gte(activities.createdAt, toDate(p.since)) : undefined,
				p.until ? lte(activities.createdAt, toDate(p.until)) : undefined
			)
		)
		.orderBy(desc(activities.createdAt))
		.limit(p.limit);
}

const summarizeDealsSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional(),
	date_field: z.enum(['created_at', 'closed_at']).default('created_at')
});

export async function handleSummarizeDeals(db: Db, input: unknown) {
	const { customer_id, since, until, date_field } = summarizeDealsSchema.parse(input);
	const dateCol = date_field === 'closed_at' ? deals.closedAt : deals.createdAt;

	const rows = await db
		.select({
			status: deals.status,
			count: sql<number>`cast(count(*) as integer)`,
			totalAmount: sql<number>`cast(coalesce(sum(${deals.amount}), 0) as integer)`,
			avgAmount: sql<number>`cast(coalesce(avg(${deals.amount}), 0) as integer)`
		})
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				since ? gte(dateCol, toDate(since)) : undefined,
				until ? lte(dateCol, toDate(until)) : undefined
			)
		)
		.groupBy(deals.status);

	const byStatus: Record<string, { count: number; total_amount: number; avg_amount: number }> = {};
	let totalCount = 0;
	let totalAmount = 0;
	for (const r of rows) {
		byStatus[r.status] = { count: r.count, total_amount: r.totalAmount, avg_amount: r.avgAmount };
		totalCount += r.count;
		totalAmount += r.totalAmount;
	}

	return { by_status: byStatus, total: { count: totalCount, total_amount: totalAmount } };
}

const summarizeCustomersSchema = z.object({
	since: z.string().optional(),
	until: z.string().optional()
});

export async function handleSummarizeCustomers(db: Db, input: unknown) {
	const { since, until } = summarizeCustomersSchema.parse(input);

	const rows = await db
		.select({
			status: customers.status,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(customers)
		.where(
			and(
				since ? gte(customers.createdAt, toDate(since)) : undefined,
				until ? lte(customers.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(customers.status);

	const byStatus: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byStatus[r.status] = r.count;
		total += r.count;
	}

	return { total, by_status: byStatus };
}

const summarizeActivitiesSchema = z.object({
	customer_id: z.string().optional(),
	since: z.string().optional(),
	until: z.string().optional()
});

export async function handleSummarizeActivities(db: Db, input: unknown) {
	const { customer_id, since, until } = summarizeActivitiesSchema.parse(input);

	const rows = await db
		.select({
			type: activities.type,
			count: sql<number>`cast(count(*) as integer)`
		})
		.from(activities)
		.where(
			and(
				customer_id ? eq(activities.customerId, customer_id) : undefined,
				since ? gte(activities.createdAt, toDate(since)) : undefined,
				until ? lte(activities.createdAt, toDate(until)) : undefined
			)
		)
		.groupBy(activities.type);

	const byType: Record<string, number> = {};
	let total = 0;
	for (const r of rows) {
		byType[r.type] = r.count;
		total += r.count;
	}

	return { total, by_type: byType };
}
