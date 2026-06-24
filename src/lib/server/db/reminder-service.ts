import { and, eq, desc, isNull, or, sql } from 'drizzle-orm';
import { reminders, type Reminder } from './schema';
import { getSlackIntegration, listSlackIntegrations } from '../slack';
import { getEmailSetup, type EmailEnv } from '../email';
import type { Db } from '.';

export type ReminderListRow = {
	id: string;
	remindAt: Date;
	content: string;
	channels: string[];
	channelLabels: string[];
	status: Reminder['status'];
	createdAt: Date;
};

export type ChannelOption = { label: string; value: string };

export async function createReminder(
	db: Db,
	input: { remindAt: Date; content: string; channels: string[]; accountId?: string | null }
): Promise<Reminder> {
	const id = crypto.randomUUID();
	await db.insert(reminders).values({
		id,
		remindAt: input.remindAt,
		content: input.content,
		channels: JSON.stringify(input.channels),
		status: 'pending',
		accountId: input.accountId ?? null
	});
	const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
	return row;
}

export async function resolveChannelLabels(db: Db, channels: string[]): Promise<string[]> {
	return Promise.all(
		channels.map(async (c) => {
			if (c === 'notification') return '通知センター';
			if (c === 'email') return 'メール';
			if (c.startsWith('slack:')) {
				const integration = await getSlackIntegration(db, c.slice('slack:'.length));
				return integration?.name ?? 'Slack';
			}
			return c;
		})
	);
}

export function parseChannels(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as string[]) : [];
	} catch {
		return [];
	}
}

async function toListRow(db: Db, r: Reminder): Promise<ReminderListRow> {
	const channels = parseChannels(r.channels);
	return {
		id: r.id,
		remindAt: r.remindAt,
		content: r.content,
		channels,
		channelLabels: await resolveChannelLabels(db, channels),
		status: r.status,
		createdAt: r.createdAt
	};
}

export async function listReminders(db: Db, accountId?: string): Promise<ReminderListRow[]> {
	const rows = await db
		.select()
		.from(reminders)
		.where(accountId ? or(isNull(reminders.accountId), eq(reminders.accountId, accountId)) : undefined)
		.orderBy(desc(reminders.remindAt));
	return Promise.all(rows.map((r) => toListRow(db, r)));
}

export async function createReminderRow(
	db: Db,
	input: { remindAt: Date; content: string; channels: string[]; accountId?: string | null }
): Promise<ReminderListRow> {
	const reminder = await createReminder(db, input);
	return toListRow(db, reminder);
}

export async function updateReminder(
	db: Db,
	id: string,
	input: { remindAt: Date; content: string; channels: string[] }
): Promise<ReminderListRow> {
	await db.update(reminders).set({
		remindAt: input.remindAt,
		content: input.content,
		channels: JSON.stringify(input.channels)
	}).where(eq(reminders.id, id));
	const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
	return toListRow(db, row);
}

export async function getReminder(db: Db, id: string): Promise<Reminder | null> {
	const [row] = await db.select().from(reminders).where(eq(reminders.id, id));
	return row ?? null;
}

export async function deleteReminder(db: Db, id: string): Promise<void> {
	await db.delete(reminders).where(eq(reminders.id, id));
}

export async function deleteSentReminders(db: Db, accountId: string): Promise<number> {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(reminders)
		.where(and(eq(reminders.status, 'sent'), eq(reminders.accountId, accountId)));
	if (count > 0) {
		await db.delete(reminders)
			.where(and(eq(reminders.status, 'sent'), eq(reminders.accountId, accountId)));
	}
	return count;
}

export async function getReminderChannelOptions(db: Db, env?: EmailEnv): Promise<ChannelOption[]> {
	const options: ChannelOption[] = [{ label: '通知センター', value: 'notification' }];
	if (await getEmailSetup(db, env)) options.push({ label: 'メール', value: 'email' });
	for (const s of await listSlackIntegrations(db)) {
		options.push({ label: s.name, value: `slack:${s.id}` });
	}
	return options;
}
