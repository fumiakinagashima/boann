import { eq, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db';
import { customers, deals, activities, type Customer } from '../db/schema';
import { CUSTOMER_HEALTH_SCORE_SYSTEM_PROMPT, buildCustomerHealthScorePrompt } from './prompt';

export type CustomerHealthLevel = 'good' | 'warning' | 'risk';

export type CustomerHealthScore = {
	score: number;
	level: CustomerHealthLevel;
	summary: string;
	positives: string[];
	concerns: string[];
	updatedAt: Date;
};

export function getCachedCustomerHealthScore(customer: Customer): CustomerHealthScore | null {
	if (customer.healthScore == null || !customer.healthScoreLevel || !customer.healthScoreUpdatedAt) {
		return null;
	}
	return {
		score: customer.healthScore,
		level: customer.healthScoreLevel,
		summary: customer.healthScoreSummary ?? '',
		positives: JSON.parse(customer.healthScorePositives ?? '[]'),
		concerns: JSON.parse(customer.healthScoreConcerns ?? '[]'),
		updatedAt: customer.healthScoreUpdatedAt
	};
}

export async function computeCustomerHealthScore(
	db: Db,
	customer: Customer,
	apiKey: string
): Promise<CustomerHealthScore> {
	const [customerDeals, customerActivities] = await Promise.all([
		db.select().from(deals).where(eq(deals.customerId, customer.id)).orderBy(desc(deals.createdAt)),
		db.select().from(activities).where(eq(activities.customerId, customer.id)).orderBy(desc(activities.createdAt)).limit(10)
	]);

	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	const message = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1024,
		system: CUSTOMER_HEALTH_SCORE_SYSTEM_PROMPT,
		messages: [{
			role: 'user',
			content: buildCustomerHealthScorePrompt({
				customer,
				deals: customerDeals,
				activities: customerActivities
			})
		}]
	});
	const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error(`ヘルススコアの解析に失敗しました。(response: ${text.slice(0, 100)})`);
	}

	let parsed: { score: number; level: CustomerHealthLevel; summary: string; positives: string[]; concerns: string[] };
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch {
		throw new Error('ヘルススコアの解析に失敗しました。');
	}

	const updatedAt = new Date();
	await db
		.update(customers)
		.set({
			healthScore: parsed.score,
			healthScoreLevel: parsed.level,
			healthScoreSummary: parsed.summary,
			healthScorePositives: JSON.stringify(parsed.positives ?? []),
			healthScoreConcerns: JSON.stringify(parsed.concerns ?? []),
			healthScoreUpdatedAt: updatedAt
		})
		.where(eq(customers.id, customer.id));

	return {
		score: parsed.score,
		level: parsed.level,
		summary: parsed.summary,
		positives: parsed.positives ?? [],
		concerns: parsed.concerns ?? [],
		updatedAt
	};
}
