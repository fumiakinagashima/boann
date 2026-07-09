import { eq, and } from 'drizzle-orm';
import type { Db } from '.';
import { bookmarks } from './schema';

export async function listBookmarks(db: Db, accountId: string): Promise<string[]> {
	const rows = await db.select({ appId: bookmarks.appId })
		.from(bookmarks)
		.where(eq(bookmarks.accountId, accountId));
	return rows.map((r) => r.appId);
}

export async function toggleBookmark(db: Db, accountId: string, appId: string): Promise<boolean> {
	const existing = await db.select({ id: bookmarks.id })
		.from(bookmarks)
		.where(and(eq(bookmarks.accountId, accountId), eq(bookmarks.appId, appId)));
	if (existing.length > 0) {
		await db.delete(bookmarks).where(and(eq(bookmarks.accountId, accountId), eq(bookmarks.appId, appId)));
		return false;
	}
	await db.insert(bookmarks).values({ id: crypto.randomUUID(), accountId, appId });
	return true;
}
