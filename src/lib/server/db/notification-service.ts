import { and, eq, desc, sql } from 'drizzle-orm';
import { notifications } from './schema';
import type { Db } from '.';
import type { MessageContent } from '$lib/types/chat';

export type NotificationRow = {
	id: string;
	type: string;
	title: string;
	body: string;
	seedContent: MessageContent[];
	accountId: string;
	isRead: boolean;
	createdAt: Date;
};

function toRow(r: typeof notifications.$inferSelect): NotificationRow {
	return {
		id: r.id,
		type: r.type,
		title: r.title,
		body: r.body,
		seedContent: JSON.parse(r.seedContent) as MessageContent[],
		accountId: r.accountId,
		isRead: r.isRead,
		createdAt: r.createdAt
	};
}

export async function createNotification(
	db: Db,
	input: { type?: string; title: string; body: string; seedContent: MessageContent[]; accountId: string }
): Promise<NotificationRow> {
	const id = crypto.randomUUID();
	await db.insert(notifications).values({
		id,
		type: input.type ?? 'generic',
		title: input.title,
		body: input.body,
		seedContent: JSON.stringify(input.seedContent),
		accountId: input.accountId,
		isRead: false,
		createdAt: new Date()
	});
	return (await getNotification(db, id))!;
}

export async function listNotifications(db: Db, accountId: string, limit = 50): Promise<NotificationRow[]> {
	const rows = await db
		.select()
		.from(notifications)
		.where(eq(notifications.accountId, accountId))
		.orderBy(desc(notifications.createdAt))
		.limit(limit);
	return rows.map(toRow);
}

export async function getNotification(db: Db, id: string): Promise<NotificationRow | null> {
	const [r] = await db.select().from(notifications).where(eq(notifications.id, id));
	return r ? toRow(r) : null;
}

export async function markNotificationRead(db: Db, id: string): Promise<NotificationRow | null> {
	await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
	return getNotification(db, id);
}

export async function countUnreadNotifications(db: Db, accountId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(notifications)
		.where(and(eq(notifications.isRead, false), eq(notifications.accountId, accountId)));
	return row?.count ?? 0;
}

export async function deleteReadNotifications(db: Db, accountId: string): Promise<number> {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(notifications)
		.where(and(eq(notifications.isRead, true), eq(notifications.accountId, accountId)));
	if (count > 0) {
		await db.delete(notifications)
			.where(and(eq(notifications.isRead, true), eq(notifications.accountId, accountId)));
	}
	return count;
}
