import { eq, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db';
import { contacts, deals, activities, type Customer } from '../db/schema';
import { CUSTOMER_HANDOVER_SUMMARY_SYSTEM_PROMPT, buildCustomerHandoverSummaryPrompt } from './prompt';

export type CustomerHandoverAttentionItem = {
	content: string;
	sourceType: 'activity' | 'deal';
	sourceId: string;
};

export type CustomerHandoverSummary = {
	summary: string;
	attentionItems: CustomerHandoverAttentionItem[];
};

export async function computeCustomerHandoverSummary(
	db: Db,
	customer: Customer,
	apiKey: string
): Promise<CustomerHandoverSummary> {
	const [customerContacts, customerDeals, customerActivities] = await Promise.all([
		db.select().from(contacts).where(eq(contacts.customerId, customer.id)).orderBy(desc(contacts.createdAt)),
		db.select().from(deals).where(eq(deals.customerId, customer.id)).orderBy(desc(deals.createdAt)),
		db.select().from(activities).where(eq(activities.customerId, customer.id)).orderBy(desc(activities.createdAt))
	]);

	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	const message = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1536,
		system: CUSTOMER_HANDOVER_SUMMARY_SYSTEM_PROMPT,
		messages: [{
			role: 'user',
			content: buildCustomerHandoverSummaryPrompt({
				customer,
				contacts: customerContacts,
				deals: customerDeals,
				activities: customerActivities
			})
		}]
	});
	const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error(`引き継ぎサマリーの解析に失敗しました。(response: ${text.slice(0, 100)})`);
	}

	let parsed: CustomerHandoverSummary;
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch {
		throw new Error('引き継ぎサマリーの解析に失敗しました。');
	}

	return {
		summary: parsed.summary,
		attentionItems: parsed.attentionItems ?? []
	};
}
