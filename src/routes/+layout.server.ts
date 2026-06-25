import type { LayoutServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { countUnreadNotifications } from '$lib/server/db/notification-service';
import { listBookmarks } from '$lib/server/db/bookmark-service';
import { listEntityTypesSimple } from '$lib/server/db/table-service';

export const load: LayoutServerLoad = async ({ platform, locals, url }) => {
	if (!locals.account || url.pathname === '/signin' || !platform?.env?.DB) {
		return { account: locals.account, unreadNotificationCount: 0, bookmarkedIds: [], apps: [] };
	}
	const db = createDb(platform.env.DB);
	const [unreadNotificationCount, bookmarkedIds, apps] = await Promise.all([
		countUnreadNotifications(db, locals.account.id),
		listBookmarks(db, locals.account.id),
		listEntityTypesSimple(db)
	]);
	return { account: locals.account, unreadNotificationCount, bookmarkedIds, apps };
};
