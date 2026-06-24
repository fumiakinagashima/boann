import type { LayoutServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { countUnreadNotifications } from '$lib/server/db/notification-service';
import { listChats } from '$lib/server/db/chat-service';

export const load: LayoutServerLoad = async ({ platform, locals, url }) => {
	if (!locals.account || url.pathname === '/signin' || !platform?.env?.DB) {
		return { account: locals.account, unreadNotificationCount: 0, chats: [] };
	}
	const db = createDb(platform.env.DB);
	const [unreadNotificationCount, chatRows] = await Promise.all([
		countUnreadNotifications(db, locals.account.id),
		listChats(db, locals.account.id)
	]);
	const chats = chatRows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
	return { account: locals.account, unreadNotificationCount, chats };
};
