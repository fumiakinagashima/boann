import { eq, desc, and, inArray, gte, lte, or, isNull } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db';
import { customers, deals, activities, reminders, briefings } from '../db/schema';
import { BRIEFING_SYSTEM_PROMPT, buildBriefingPrompt } from './prompt';
import type { MessageContent } from '$lib/types/chat';
import { formatJstDateTime } from '$lib/datetime';

function getJstDateString(now: Date): string {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const parts = fmt.formatToParts(now);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseJson<T>(text: string): T {
	const m = text.match(/\{[\s\S]*\}/);
	if (!m) throw new Error('ブリーフィングの解析に失敗しました。');
	try { return JSON.parse(m[0]); } catch { throw new Error('ブリーフィングの解析に失敗しました。'); }
}

type BriefingResult = {
	summary: string;
	followupDeals: {
		id: string;
		title: string;
		customerName: string;
		amount: number | null;
		lastActivityDays: number | null;
		nextAction: string;
	}[];
};

export async function getCachedBriefing(
	db: Db,
	accountId: string | null
): Promise<MessageContent[] | null> {
	const todayJst = getJstDateString(new Date());
	const [cached] = await db
		.select()
		.from(briefings)
		.where(
			and(
				eq(briefings.date, todayJst),
				accountId
					? or(isNull(briefings.accountId), eq(briefings.accountId, accountId))
					: isNull(briefings.accountId)
			)
		)
		.limit(1);
	if (!cached) return null;
	try {
		return JSON.parse(cached.contents) as MessageContent[];
	} catch {
		return null;
	}
}

export async function computeBriefing(
	db: Db,
	accountId: string | null,
	apiKey: string
): Promise<MessageContent[]> {
	const now = new Date();
	const todayJst = getJstDateString(now);

	// 今日のJST始端・終端（UTC）
	const todayStart = new Date(`${todayJst}T00:00:00+09:00`);
	const todayEnd = new Date(`${todayJst}T23:59:59+09:00`);

	// 進行中案件 + 顧客名
	const openDealsRaw = await db
		.select({
			id: deals.id,
			title: deals.title,
			amount: deals.amount,
			customerId: deals.customerId,
			customerName: customers.name
		})
		.from(deals)
		.leftJoin(customers, eq(deals.customerId, customers.id))
		.where(eq(deals.status, 'open'));

	// 各顧客の最終活動日（一括取得）
	const customerIds = [...new Set(openDealsRaw.map((d) => d.customerId))];
	const lastActivities =
		customerIds.length > 0
			? await db
					.select({ customerId: activities.customerId, createdAt: activities.createdAt })
					.from(activities)
					.where(inArray(activities.customerId, customerIds))
					.orderBy(desc(activities.createdAt))
			: [];

	const lastActivityByCustomer = new Map<string, Date>();
	for (const a of lastActivities) {
		if (!lastActivityByCustomer.has(a.customerId) && a.createdAt) {
			lastActivityByCustomer.set(a.customerId, a.createdAt);
		}
	}

	const openDeals = openDealsRaw.map((d) => {
		const lastAct = lastActivityByCustomer.get(d.customerId);
		const lastActivityDays = lastAct
			? Math.floor((now.getTime() - lastAct.getTime()) / 86400000)
			: null;
		return {
			id: d.id,
			title: d.title,
			customerName: d.customerName ?? '（顧客不明）',
			amount: d.amount,
			lastActivityDays
		};
	});

	// 今日のリマインダー（このアカウント分）
	const todayRemindersRaw = await db
		.select()
		.from(reminders)
		.where(
			and(
				eq(reminders.status, 'pending'),
				gte(reminders.remindAt, todayStart),
				lte(reminders.remindAt, todayEnd),
				accountId
					? or(isNull(reminders.accountId), eq(reminders.accountId, accountId))
					: isNull(reminders.accountId)
			)
		);

	const todayReminders = todayRemindersRaw.map((r) => ({
		content: r.content,
		timeLabel: r.remindAt ? formatJstDateTime(r.remindAt).split(' ')[1] : ''
	}));

	// Claude でブリーフィング生成
	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	const message = await anthropic.messages.create({
		model: 'claude-haiku-4-5-20251001',
		max_tokens: 1024,
		system: BRIEFING_SYSTEM_PROMPT,
		messages: [
			{
				role: 'user',
				content: buildBriefingPrompt({ today: todayJst, openDeals, todayReminders })
			}
		]
	});

	const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
	const result = parseJson<BriefingResult>(text);

	// MessageContent[] を構築
	const contents: MessageContent[] = [];

	// サマリーテキスト
	contents.push({ type: 'text', text: result.summary ?? '' });

	// サマリー数値
	const followupCount = result.followupDeals?.length ?? 0;
	contents.push({
		type: 'values',
		title: `${todayJst} のサマリー`,
		items: [
			{ label: '進行中案件', value: openDeals.length, format: 'number' },
			{ label: 'フォロー推奨', value: followupCount, format: 'number' },
			{ label: '今日のリマインダー', value: todayReminders.length, format: 'number' }
		]
	});

	// フォロー推奨案件テーブル
	if (result.followupDeals && result.followupDeals.length > 0) {
		contents.push({
			type: 'table',
			entity: 'deals',
			columns: [
				{ key: 'customerName', label: '顧客' },
				{ key: 'title', label: '案件名' },
				{ key: 'amount', label: '金額' },
				{ key: 'lastActivityDays', label: '最終活動' },
				{ key: 'nextAction', label: '推奨アクション' }
			],
			rows: result.followupDeals.map((d) => ({
				id: d.id,
				customerName: d.customerName,
				title: d.title,
				amount: d.amount != null ? `¥${d.amount.toLocaleString()}` : '—',
				lastActivityDays: d.lastActivityDays != null ? `${d.lastActivityDays}日前` : '記録なし',
				nextAction: d.nextAction
			}))
		});
	}

	// 今日のリマインダーテーブル
	if (todayReminders.length > 0) {
		contents.push({
			type: 'table',
			columns: [
				{ key: 'timeLabel', label: '時刻' },
				{ key: 'content', label: '内容' }
			],
			rows: todayReminders.map((r) => ({ timeLabel: r.timeLabel, content: r.content }))
		});
	}

	// DBにキャッシュ保存（同日の既存キャッシュは上書き）
	await db
		.delete(briefings)
		.where(
			and(
				eq(briefings.date, todayJst),
				accountId ? eq(briefings.accountId, accountId) : isNull(briefings.accountId)
			)
		);
	await db.insert(briefings).values({
		id: crypto.randomUUID(),
		accountId,
		date: todayJst,
		contents: JSON.stringify(contents)
	});

	return contents;
}
