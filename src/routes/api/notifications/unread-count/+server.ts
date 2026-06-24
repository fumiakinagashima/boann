import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { countUnreadNotifications } from '$lib/server/db/notification-service';

export const GET: RequestHandler = async ({ platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const unreadCount = await countUnreadNotifications(db, locals.account!.id);
	return json({ unreadCount });
};
