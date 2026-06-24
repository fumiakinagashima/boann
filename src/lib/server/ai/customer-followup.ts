import { eq, desc, and, inArray } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db';
import { customers, deals, activities, type Customer } from '../db/schema';
import {
	CUSTOMER_FOLLOWUP_SINGLE_SYSTEM_PROMPT,
	CUSTOMER_FOLLOWUP_LIST_SYSTEM_PROMPT,
	buildCustomerFollowupSinglePrompt,
	buildCustomerFollowupListPrompt
} from './prompt';

export type FollowupAction = {
	type: 'call' | 'email' | 'meeting';
	description: string;
	priority: 'high' | 'medium' | 'low';
	timing: string;
	reason: string;
};

export type CustomerFollowupSingle = {
	customerId: string;
	customerName: string;
	actions: FollowupAction[];
	summary: string;
};

export type FollowupItem = {
	customerId: string;
	customerName: string;
	priority: 'high' | 'medium' | 'low';
	action: string;
	reason: string;
	timing: string;
};

export type CustomerFollowupList = {
	period: string;
	followups: FollowupItem[];
	summary: string;
};

function periodLabel(period: 'this_week' | 'next_week' | 'this_month' | undefined, today: Date): string {
	if (!period || period === 'this_week') {
		const mon = new Date(today);
		mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
		const sun = new Date(mon);
		sun.setDate(mon.getDate() + 6);
		const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
		return `今週（${fmt(mon)}〜${fmt(sun)}）`;
	}
	if (period === 'next_week') {
		const mon = new Date(today);
		mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) + 7);
		const sun = new Date(mon);
		sun.setDate(mon.getDate() + 6);
		const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}`;
		return `来週（${fmt(mon)}〜${fmt(sun)}）`;
	}
	return `今月（${today.getFullYear()}年${today.getMonth()+1}月）`;
}

function parseJson<T>(text: string): T {
	const m = text.match(/\{[\s\S]*\}/);
	if (!m) throw new Error(`フォローアップ提案の解析に失敗しました。(response: ${text.slice(0, 100)})`);
	try { return JSON.parse(m[0]); } catch { throw new Error('フォローアップ提案の解析に失敗しました。'); }
}

export async function computeCustomerFollowupSingle(
	db: Db,
	customer: Customer,
	apiKey: string
): Promise<CustomerFollowupSingle> {
	const today = new Date();

	const [openDeals, recentActivities] = await Promise.all([
		db.select().from(deals).where(and(eq(deals.customerId, customer.id), eq(deals.status, 'open'))),
		db.select().from(activities).where(eq(activities.customerId, customer.id))
			.orderBy(desc(activities.createdAt)).limit(10)
	]);

	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	const message = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1024,
		system: CUSTOMER_FOLLOWUP_SINGLE_SYSTEM_PROMPT,
		messages: [{
			role: 'user',
			content: buildCustomerFollowupSinglePrompt({
				customer,
				openDeals,
				activities: recentActivities,
				today
			})
		}]
	});

	const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
	const parsed = parseJson<{ actions: FollowupAction[]; summary: string }>(text);

	return {
		customerId: customer.id,
		customerName: customer.name,
		actions: parsed.actions ?? [],
		summary: parsed.summary ?? ''
	};
}

export async function computeCustomerFollowupList(
	db: Db,
	period: 'this_week' | 'next_week' | 'this_month' | undefined,
	limit: number,
	apiKey: string
): Promise<CustomerFollowupList> {
	const today = new Date();

	// 有効な顧客を全件取得
	const activeCustomers = await db.select().from(customers).where(eq(customers.status, 'active'));
	if (activeCustomers.length === 0) {
		return { period: periodLabel(period, today), followups: [], summary: 'フォローアップ対象の顧客がいません。' };
	}

	const customerIds = activeCustomers.map(c => c.id);

	// 進行中案件を一括取得
	const openDeals = await db.select().from(deals)
		.where(and(eq(deals.status, 'open'), inArray(deals.customerId, customerIds)));

	// 進行中案件がある顧客のみ対象
	const dealsByCustomer = new Map<string, string[]>();
	for (const d of openDeals) {
		const list = dealsByCustomer.get(d.customerId) ?? [];
		list.push(d.title);
		dealsByCustomer.set(d.customerId, list);
	}
	const candidateIds = new Set(dealsByCustomer.keys());
	const candidates = activeCustomers.filter(c => candidateIds.has(c.id));
	if (candidates.length === 0) {
		return { period: periodLabel(period, today), followups: [], summary: '進行中案件のある顧客がいません。' };
	}

	// 直近活動を一括取得（各顧客の最新1件）
	const recentActs = await db.select().from(activities)
		.where(inArray(activities.customerId, candidates.map(c => c.id)))
		.orderBy(desc(activities.createdAt))
		.limit(candidates.length * 3); // 各顧客分カバーできる件数

	const lastActivityByCustomer = new Map<string, typeof recentActs[0]>();
	for (const a of recentActs) {
		if (!lastActivityByCustomer.has(a.customerId)) {
			lastActivityByCustomer.set(a.customerId, a);
		}
	}

	const summaries = candidates.map(c => {
		const lastAct = lastActivityByCustomer.get(c.id);
		const daysSince = lastAct
			? Math.floor((today.getTime() - new Date(typeof lastAct.createdAt === 'number' ? lastAct.createdAt * 1000 : lastAct.createdAt).getTime()) / 86400000)
			: null;
		return {
			customerId: c.id,
			customerName: c.name,
			openDeals: dealsByCustomer.get(c.id) ?? [],
			daysSinceLastActivity: daysSince,
			lastActivityType: lastAct?.type ?? null,
			lastActivityContent: lastAct?.content ?? null
		};
	});

	const label = periodLabel(period, today);
	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	const message = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 2048,
		system: CUSTOMER_FOLLOWUP_LIST_SYSTEM_PROMPT,
		messages: [{
			role: 'user',
			content: buildCustomerFollowupListPrompt({ summaries, period: label, today })
		}]
	});

	const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
	const parsed = parseJson<{ followups: FollowupItem[]; summary: string }>(text);

	return {
		period: label,
		followups: (parsed.followups ?? []).slice(0, limit),
		summary: parsed.summary ?? ''
	};
}
