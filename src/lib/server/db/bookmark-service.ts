import { eq, and } from 'drizzle-orm';
import type { Db } from '.';
import { bookmarks } from './schema';

export async function listBookmarks(db: Db, accountId: string): Promise<string[]> {
	const rows = await db.select({ entityTypeId: bookmarks.entityTypeId })
		.from(bookmarks)
		.where(eq(bookmarks.accountId, accountId));
	return rows.map((r) => r.entityTypeId);
}

export async function toggleBookmark(db: Db, accountId: string, entityTypeId: string): Promise<boolean> {
	const existing = await db.select({ id: bookmarks.id })
		.from(bookmarks)
		.where(and(eq(bookmarks.accountId, accountId), eq(bookmarks.entityTypeId, entityTypeId)));
	if (existing.length > 0) {
		await db.delete(bookmarks).where(and(eq(bookmarks.accountId, accountId), eq(bookmarks.entityTypeId, entityTypeId)));
		return false;
	}
	await db.insert(bookmarks).values({ id: crypto.randomUUID(), accountId, entityTypeId });
	return true;
}
