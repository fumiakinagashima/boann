import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { deals } from '../db/schema';
import { dealRegisteredActivityInsert } from '../db/table-service';
import { parseJson, mergeCustom, now, type ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_deals',
		description: '案件一覧を取得する。顧客IDやステータスで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客IDで絞り込む' },
				status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: 'ステータスで絞り込む'
				},
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'create_deal',
		description: '案件を登録する。顧客IDは必須。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客のID（必須）' },
				title: { type: 'string', description: '案件タイトル（必須）' },
				amount: { type: 'number', description: '金額（円）' },
				status: {
					type: 'string',
					enum: ['open', 'won', 'lost'],
					description: 'ステータス（デフォルト: open）'
				},
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド' }
			},
			required: ['customer_id', 'title']
		}
	},
	{
		name: 'update_deal',
		description: '案件情報を更新する。ステータスの変更（受注・失注など）にも使う。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '案件ID（必須）' },
				title: { type: 'string', description: '案件タイトル' },
				amount: { type: 'number', description: '金額（円）' },
				status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'ステータス' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（既存データとマージ）' }
			},
			required: ['id']
		}
	}
];

const getDealsSchema = z.object({
	customer_id: z.string().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	limit: z.number().int().positive().default(50)
});

const createDealSchema = z.object({
	customer_id: z.string(),
	title: z.string().min(1),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).default('open'),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateDealSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	amount: z.number().int().optional(),
	status: z.enum(['open', 'won', 'lost']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

export async function handleGetDeals(db: Db, input: unknown) {
	const { customer_id, status, limit } = getDealsSchema.parse(input);
	const result = await db
		.select()
		.from(deals)
		.where(
			and(
				customer_id ? eq(deals.customerId, customer_id) : undefined,
				status ? eq(deals.status, status) : undefined
			)
		)
		.orderBy(desc(deals.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

export async function handleCreateDeal(db: Db, input: unknown, env?: ToolEnv) {
	const data = createDealSchema.parse(input);
	const id = crypto.randomUUID();
	await db.batch([
		db.insert(deals).values({
			id,
			customerId: data.customer_id,
			title: data.title,
			amount: data.amount,
			status: data.status,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		dealRegisteredActivityInsert(db, data.customer_id, data.title, env?.accountId)
	]);
	const [row] = await db.select().from(deals).where(eq(deals.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateDeal(db: Db, input: unknown) {
	const data = updateDealSchema.parse(input);
	const [existing] = await db.select().from(deals).where(eq(deals.id, data.id));
	if (!existing) throw new Error(`案件が見つかりません: ${data.id}`);

	const closedAt =
		data.status === 'won' || data.status === 'lost'
			? now()
			: data.status === 'open'
				? null
				: undefined;

	await db
		.update(deals)
		.set({
			...(data.title !== undefined && { title: data.title }),
			...(data.amount !== undefined && { amount: data.amount }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			...(closedAt !== undefined && { closedAt }),
			updatedAt: now()
		})
		.where(eq(deals.id, data.id));

	const [row] = await db.select().from(deals).where(eq(deals.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}
