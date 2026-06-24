import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { contacts } from '../db/schema';
import { parseJson, mergeCustom, now } from './shared';

export const tools: Tool[] = [
	{
		name: 'get_contacts',
		description: '担当者一覧を取得する。顧客IDで絞り込みができる。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客IDで絞り込む' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: []
		}
	},
	{
		name: 'create_contact',
		description: '担当者を登録する。顧客IDは必須。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '紐付ける顧客のID（必須）' },
				name: { type: 'string', description: '担当者名（必須）' },
				name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				department: { type: 'string', description: '部署' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド' }
			},
			required: ['customer_id', 'name']
		}
	},
	{
		name: 'update_contact',
		description: '担当者情報を更新する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '担当者ID（必須）' },
				name: { type: 'string', description: '担当者名' },
				name_kana: { type: 'string', description: '担当者名のフリガナ（カナ）' },
				email: { type: 'string', description: 'メールアドレス' },
				phone: { type: 'string', description: '電話番号' },
				role: { type: 'string', description: '役職' },
				department: { type: 'string', description: '部署' },
				notes: { type: 'string', description: '備考' },
				custom: { type: 'object', description: 'カスタムフィールド（既存データとマージ）' }
			},
			required: ['id']
		}
	}
];

const getContactsSchema = z.object({
	customer_id: z.string().optional(),
	limit: z.number().int().positive().default(50)
});

const createContactSchema = z.object({
	customer_id: z.string(),
	name: z.string().min(1),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

const updateContactSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	name_kana: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	role: z.string().optional(),
	department: z.string().optional(),
	notes: z.string().optional(),
	custom: z.record(z.string(), z.unknown()).optional()
});

export async function handleGetContacts(db: Db, input: unknown) {
	const { customer_id, limit } = getContactsSchema.parse(input);
	const result = await db
		.select()
		.from(contacts)
		.where(customer_id ? eq(contacts.customerId, customer_id) : undefined)
		.orderBy(desc(contacts.createdAt))
		.limit(limit);
	return result.map((r) => ({ ...r, custom: parseJson(r.custom) }));
}

export async function handleCreateContact(db: Db, input: unknown) {
	const data = createContactSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(contacts).values({
		id,
		customerId: data.customer_id,
		name: data.name,
		nameKana: data.name_kana,
		email: data.email,
		phone: data.phone,
		role: data.role,
		department: data.department,
		notes: data.notes,
		custom: JSON.stringify(data.custom ?? {})
	});
	const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
	return { ...row, custom: parseJson(row.custom) };
}

export async function handleUpdateContact(db: Db, input: unknown) {
	const data = updateContactSchema.parse(input);
	const [existing] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	if (!existing) throw new Error(`担当者が見つかりません: ${data.id}`);

	await db
		.update(contacts)
		.set({
			...(data.name !== undefined && { name: data.name }),
			...(data.name_kana !== undefined && { nameKana: data.name_kana }),
			...(data.email !== undefined && { email: data.email }),
			...(data.phone !== undefined && { phone: data.phone }),
			...(data.role !== undefined && { role: data.role }),
			...(data.department !== undefined && { department: data.department }),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.custom !== undefined && { custom: mergeCustom(existing.custom, data.custom) }),
			updatedAt: now()
		})
		.where(eq(contacts.id, data.id));

	const [row] = await db.select().from(contacts).where(eq(contacts.id, data.id));
	return { ...row, custom: parseJson(row.custom) };
}
