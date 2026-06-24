import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { customers } from '../db/schema';
import { eq, like, or } from 'drizzle-orm';
import { computeCustomerFollowupSingle, computeCustomerFollowupList } from '../ai/customer-followup';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'suggest_customer_followup',
		description:
			'顧客の案件・活動履歴をAIが分析し、フォローアップアクションを提案する。' +
			'顧客名またはIDを指定すると特定顧客の詳細提案、指定しない場合はフォローアップが必要な顧客一覧を返す。' +
			'「今週フォローアップが必要な企業は？」「〇〇社の次のアクションを提案して」などに使う。',
		input_schema: {
			type: 'object',
			properties: {
				customer_id: {
					type: 'string',
					description: '顧客ID（id か name のどちらか一方、または両方省略で全顧客一覧モード）'
				},
				customer_name: {
					type: 'string',
					description: '顧客名（部分一致）'
				},
				period: {
					type: 'string',
					enum: ['this_week', 'next_week', 'this_month'],
					description: '全顧客一覧モード時の対象期間（デフォルト: this_week）'
				},
				limit: {
					type: 'number',
					description: '全顧客一覧モード時の上限件数（デフォルト: 10）'
				}
			},
			required: []
		}
	}
];

const inputSchema = z.object({
	customer_id: z.string().optional(),
	customer_name: z.string().optional(),
	period: z.enum(['this_week', 'next_week', 'this_month']).optional(),
	limit: z.number().int().positive().optional().default(10)
});

export async function handleSuggestCustomerFollowup(db: Db, input: unknown, env?: ToolEnv) {
	const { customer_id, customer_name, period, limit } = inputSchema.parse(input);

	const apiKey = env?.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません。');

	// 顧客指定あり → 単一顧客モード
	if (customer_id || customer_name) {
		let customer;
		if (customer_id) {
			const [row] = await db.select().from(customers).where(eq(customers.id, customer_id));
			customer = row;
		} else {
			const rows = await db.select().from(customers)
				.where(like(customers.name, `%${customer_name}%`));
			customer = rows[0];
		}
		if (!customer) throw new Error(`顧客が見つかりません: ${customer_id ?? customer_name}`);
		return computeCustomerFollowupSingle(db, customer, apiKey);
	}

	// 顧客指定なし → 全顧客一覧モード
	return computeCustomerFollowupList(db, period, limit, apiKey);
}
