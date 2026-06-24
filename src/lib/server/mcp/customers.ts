import { and, eq, like, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers, contacts, deals, activities } from '../db/schema';
import { computeCustomerHealthScore, getCachedCustomerHealthScore } from '../ai/customer-health';
import { computeCustomerHandoverSummary } from '../ai/customer-handover';
import { parseJson, mergeCustom, now, type ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_customer_detail',
		description:
			'顧客の詳細情報（基本情報・担当者・案件・活動履歴）をまとめて取得する。名前（部分一致）またはIDで検索できる。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（id か name のどちらか一方を指定）' },
				name: {
					type: 'string',
					description: '顧客名（部分一致）（id か name のどちらか一方を指定）'
				},
				activities_limit: { type: 'number', description: '活動履歴の取得件数（デフォルト: 10）' }
			},
			required: []
		}
	},
	{
		name: 'get_customer_health_score',
		description:
			'顧客のヘルススコア（取引関係の健全度を0-100でAIが評価したもの）を取得する。名前（部分一致）またはIDで検索できる。「株式会社◯◯のヘルススコアは？」「◯◯との関係は良好？」などに使う。結果はDBにキャッシュされ、通常はキャッシュ済みの値を即座に返す（未計算の場合のみAIで新規計算する）。最新の状態に更新したい場合は force を true にする。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（id か name のどちらか一方を指定）' },
				name: {
					type: 'string',
					description: '顧客名（部分一致）（id か name のどちらか一方を指定）'
				},
				force: {
					type: 'boolean',
					description: 'true の場合、キャッシュを無視して再計算する（デフォルト: false）'
				}
			},
			required: []
		}
	},
	{
		name: 'get_customer_health_ranking',
		description:
			'ヘルススコアが計算済みの顧客を、スコアの高い順・低い順にランキングする。「ヘルススコアが一番高い／低い企業は？」などに使う。スコアが未計算の顧客は対象外で、件数のみ uncomputedCount / uncomputedNames で示される（未計算の顧客のスコアを知りたい場合は get_customer_health_score を個別に呼ぶ）。',
		input_schema: {
			type: 'object',
			properties: {
				order: {
					type: 'string',
					enum: ['asc', 'desc'],
					description: '並び順（デフォルト: desc = 高い順）'
				},
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 5）' }
			},
			required: []
		}
	},
	{
		name: 'get_customer_handover_summary',
		description:
			'顧客とのこれまでのやり取り（案件・活動履歴）をAIが要約し、担当者引き継ぎ用のサマリーと注意点を生成する。名前（部分一致）またはIDで検索できる。「〇〇社の引き継ぎ資料を作って」「〇〇社とのやり取りをまとめて」などに使う。キャッシュは行わず毎回その場で生成するため、時間がかかることがある。注意点（attentionItems）には根拠となった案件・活動履歴へのリンク用情報（sourceType, sourceId）が含まれる。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（id か name のどちらか一方を指定）' },
				name: {
					type: 'string',
					description: '顧客名（部分一致）（id か name のどちらか一方を指定）'
				}
			},
			required: []
		}
	},
	{
		name: 'get_customers',
		description: '顧客一覧を取得する。名前・ステータスで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '顧客名（部分一致）' },
				status: {
					type: 'string',
					enum: ['active', 'inactive'],
					description: 'ステータスで絞り込む'
				},
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'get_customer',
		description: '指定IDの顧客を1件取得する。',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'string', description: '顧客ID' } },
			required: ['id']
		}
	},
	{
		name: 'create_customer',
		description: '新しい顧客を登録する。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '会社名（必須）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				postal_code: { type: 'string', description: '郵便番号' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（任意のキー/値）' }
			},
			required: ['name']
		}
	},
	{
		name: 'update_customer',
		description: '既存の顧客情報を更新する。指定したフィールドのみ更新される。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '顧客ID（必須）' },
				name: { type: 'string', description: '会社名' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				postal_code: { type: 'string', description: '郵便番号' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
				status: { type: 'string', enum: ['active', 'inactive'], description: 'ステータス' },
				notes: { type: 'string', description: '備考' },
				custom: {
					type: 'object',
					description: 'カスタムフィールド（既存データとマージされる）'
				}
			},
			required: ['id']
		}
	},
	{
		name: 'delete_customer',
		description: '顧客を削除する。',
		input_schema: {
			type: 'object',
			properties: { id: { type: 'string', description: '顧客ID' } },
			required: ['id']
		}
	},
	{
		name: 'create_customer_with_contact',
		description:
			'新しい顧客（会社）と、その担当者を同時に登録する。名刺情報などから会社と担当者をまとめて新規登録する場合に使う。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: '会社名（必須）' },
				email: { type: 'string', description: 'メールアドレス（会社・担当者で共通）' },
				phone: { type: 'string', description: '電話番号（会社・担当者で共通）' },
				address: { type: 'string', description: '住所' },
				website: { type: 'string', description: 'ホームページURL' },
				notes: { type: 'string', description: '備考' },
				contact_name: { type: 'string', description: '担当者氏名（必須）' },
				contact_name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				contact_role: { type: 'string', description: '担当者の役職' },
				contact_department: { type: 'string', description: '担当者の部署' },
				custom: { type: 'object', description: 'カスタムフィールド（顧客側、任意のキー/値）' }
			},
			required: ['name', 'contact_name']
		}
	}
];

const getCustomerDetailSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	activities_limit: z.number().int().positive().default(10)
});

async function resolveCustomerByIdOrName(db: Db, id?: string, name?: string) {
	if (!id && !name) throw new Error('id または name のどちらかを指定してください');
	if (id) {
		const [row] = await db.select().from(customers).where(eq(customers.id, id));
		if (!row) throw new Error(`顧客が見つかりません: ${id}`);
		return row;
	}
	const rows = await db
		.select()
		.from(customers)
		.where(like(customers.name, `%${name}%`))
		.limit(1);
	if (!rows[0]) throw new Error(`顧客が見つかりません: ${name}`);
	return rows[0];
}

export async function handleGetCustomerDetail(db: Db, input: unknown) {
	const { id, name, activities_limit } = getCustomerDetailSchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	const [customerContacts, customerDeals, customerActivities] = await Promise.all([
		db
			.select()
			.from(contacts)
			.where(eq(contacts.customerId, customer.id))
			.orderBy(desc(contacts.createdAt)),
		db
			.select()
			.from(deals)
			.where(eq(deals.customerId, customer.id))
			.orderBy(desc(deals.createdAt)),
		db
			.select()
			.from(activities)
			.where(eq(activities.customerId, customer.id))
			.orderBy(desc(sql`COALESCE(${activities.activityDate}, ${activities.createdAt})`))
			.limit(activities_limit)
	]);

	return {
		...customer,
		custom: parseJson(customer.custom),
		contacts: customerContacts.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		deals: customerDeals.map((r) => ({ ...r, custom: parseJson(r.custom) })),
		activities: customerActivities
	};
}

const getCustomerHealthScoreSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	force: z.boolean().optional().default(false)
});

export async function handleGetCustomerHealthScore(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, force } = getCustomerHealthScoreSchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	if (!force) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			return {
				id: customer.id,
				name: customer.name,
				...cached,
				updatedAt: cached.updatedAt.toISOString(),
				cached: true
			};
		}
	}

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');

	const result = await computeCustomerHealthScore(db, customer, apiKey);
	return {
		id: customer.id,
		name: customer.name,
		...result,
		updatedAt: result.updatedAt.toISOString(),
		cached: false
	};
}

const getCustomerHealthRankingSchema = z.object({
	order: z.enum(['asc', 'desc']).optional().default('desc'),
	limit: z.number().int().positive().optional().default(5)
});

export async function handleGetCustomerHealthRanking(db: Db, input: unknown) {
	const { order, limit } = getCustomerHealthRankingSchema.parse(input);
	const rows = await db.select().from(customers);

	const ranked: {
		id: string;
		name: string;
		score: number;
		level: string;
		summary: string;
		updatedAt: string;
	}[] = [];
	const uncomputedNames: string[] = [];

	for (const customer of rows) {
		const cached = getCachedCustomerHealthScore(customer);
		if (cached) {
			ranked.push({
				id: customer.id,
				name: customer.name,
				score: cached.score,
				level: cached.level,
				summary: cached.summary,
				updatedAt: cached.updatedAt.toISOString()
			});
		} else {
			uncomputedNames.push(customer.name);
		}
	}

	ranked.sort((a, b) => (order === 'asc' ? a.score - b.score : b.score - a.score));

	return {
		ranking: ranked.slice(0, limit),
		uncomputedCount: uncomputedNames.length,
		uncomputedNames
	};
}

const getCustomerHandoverSummarySchema = z.object({
	id: z.string().optional(),
	name: z.string().optional()
});

export async function handleGetCustomerHandoverSummary(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name } = getCustomerHandoverSummarySchema.parse(input);
	const customer = await resolveCustomerByIdOrName(db, id, name);

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');

	const result = await computeCustomerHandoverSummary(db, customer, apiKey);
	return { id: customer.id, name: customer.name, ...result };
}

const getCustomersSchema = z.object({
	name: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	limit: z.number().int().positive().default(50)
});

const getCustomerSchema = z.object({ id: z.string() });

const createCustomerSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateCustomerSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	postal_code: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	status: z.enum(['active', 'inactive']).optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const deleteCustomerSchema = z.object({ id: z.string() });

const createCustomerWithContactSchema = z.object({
	name: z.string().min(1),
	email: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	website: z.string().optional(),
	notes: z.string().optional(),
	contact_name: z.string().min(1),
	contact_name_kana: z.string().optional(),
	contact_role: z.string().optional(),
	contact_department: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

export async function handleGetCustomers(db: Db, input: unknown) {
	const { name, status, limit } = getCustomersSchema.parse(input);
	const rows = await db
		.select()
		.from(customers)
		.where(
			and(
				name ? like(customers.name, `%${name}%`) : undefined,
				status ? eq(customers.status, status) : undefined
			)
		)
		.orderBy(desc(customers.createdAt))
		.limit(limit);
	return rows.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

export async function handleGetCustomer(db: Db, input: unknown) {
	const { id } = getCustomerSchema.parse(input);
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	if (!row) throw new Error(`顧客が見つかりません: ${id}`);
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleCreateCustomer(db: Db, input: unknown) {
	const data = createCustomerSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(customers).values({
		id,
		name: data.name,
		email: data.email,
		phone: data.phone,
		postalCode: data.postal_code,
		address: data.address,
		website: data.website,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(customers).where(eq(customers.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateCustomer(db: Db, input: unknown) {
	const data = updateCustomerSchema.parse(input);
	const [existing] = await db.select().from(customers).where(eq(customers.id, data.id));
	if (!existing) throw new Error(`顧客が見つかりません: ${data.id}`);

	await db
		.update(customers)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.postal_code !== undefined && { postalCode: data.postal_code }),
			...(data.address !== undefined && { address: data.address }),
			...(data.website !== undefined && { website: data.website }),
			...(data.status !== undefined && { status: data.status }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(customers.id, data.id));

	const [row] = await db.select().from(customers).where(eq(customers.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleDeleteCustomer(db: Db, input: unknown) {
	const { id } = deleteCustomerSchema.parse(input);
	await db.delete(customers).where(eq(customers.id, id));
	return { deleted: true, id };
}

export async function handleCreateCustomerWithContact(db: Db, input: unknown) {
	const data = createCustomerWithContactSchema.parse(input);

	const customerId = crypto.randomUUID();
	const contactId = crypto.randomUUID();
	await db.batch([
		db.insert(customers).values({
			id: customerId,
			name: data.name,
			email: data.email,
			phone: data.phone,
			address: data.address,
			website: data.website,
			notes: data.notes,
			custom: JSON.stringify(data.custom ?? {})
		}),
		db.insert(contacts).values({
			id: contactId,
			customerId,
			name: data.contact_name,
			nameKana: data.contact_name_kana,
			email: data.email,
			phone: data.phone,
			role: data.contact_role,
			department: data.contact_department,
			custom: JSON.stringify({})
		})
	]);

	const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
	const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
	return {
		customer: { ...customer, custom: parseJson(customer.custom) },
		contact: { ...contact, custom: parseJson(contact.custom) }
	};
}
