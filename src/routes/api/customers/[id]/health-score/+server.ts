import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { computeCustomerHealthScore } from '$lib/server/ai/customer-health';

export type CustomerHealthScoreResult = {
	score: number;
	level: 'good' | 'warning' | 'risk';
	summary: string;
	positives: string[];
	concerns: string[];
	updatedAt: string;
};

export const POST: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const [customer] = await db.select().from(customers).where(eq(customers.id, params.id));
	if (!customer) return json({ error: '顧客が見つかりません' }, { status: 404 });

	try {
		const result = await computeCustomerHealthScore(db, customer, apiKey);
		return json({ ...result, updatedAt: result.updatedAt.toISOString() } satisfies CustomerHealthScoreResult);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AIエラー: ${msg}` }, { status: 500 });
	}
};
