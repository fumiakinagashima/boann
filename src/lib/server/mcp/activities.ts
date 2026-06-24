import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { activities } from '../db/schema';
import type { ToolEnv } from './shared';
import { parseJstDatetime } from '$lib/datetime';

export const tools: Tool[] = [
	{
		name: 'get_activities',
		description: '指定した顧客の活動履歴を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '顧客のID' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 20）' }
			},
			required: ['customer_id']
		}
	},
	{
		name: 'create_activity',
		description: '活動履歴（メモ・通話・メール・面談）を記録する。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: { type: 'string', description: '記録先の顧客ID' },
				type: {
					type: 'string',
					enum: ['note', 'call', 'email', 'meeting', 'deal_created'],
					description:
						'活動の種別（note: メモ / call: 通話 / email: メール / meeting: 面談 / deal_created: 案件登録）'
				},
				content: { type: 'string', description: '活動内容（必須）' },
				activity_date: {
					type: 'string',
					description: '実際に活動を行った日時（JST、"YYYY-MM-DDTHH:mm" 形式、省略可）。登録日時と異なる場合に指定する'
				}
			},
			required: ['customer_id', 'content']
		}
	}
];

const getActivitiesSchema = z.object({
	customer_id: z.string(),
	limit: z.number().int().positive().default(20)
});

const createActivitySchema = z.object({
	customer_id: z.string(),
	type: z.enum(['note', 'call', 'email', 'meeting', 'deal_created']).default('note'),
	content: z.string().min(1),
	activity_date: z.string().optional()
});

export async function handleGetActivities(db: Db, input: unknown) {
	const { customer_id, limit } = getActivitiesSchema.parse(input);
	return db
		.select()
		.from(activities)
		.where(eq(activities.customerId, customer_id))
		.orderBy(desc(activities.createdAt))
		.limit(limit);
}

export async function handleCreateActivity(db: Db, input: unknown, env?: ToolEnv) {
	const data = createActivitySchema.parse(input);
	const id = crypto.randomUUID();
	const actDate = data.activity_date ? parseJstDatetime(data.activity_date) : null;
	await db.insert(activities).values({
		id,
		customerId: data.customer_id,
		type: data.type,
		content: data.content,
		...(actDate !== null ? { activityDate: actDate } : {}),
		createdBy: env?.accountId ?? ''
	});
	const [row] = await db.select().from(activities).where(eq(activities.id, id));
	return row;
}
