import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { toggleBookmark } from '$lib/server/db/bookmark-service';

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	if (!locals.account) error(401);
	if (!platform?.env?.DB) error(500);
	const { entityTypeId } = (await request.json()) as { entityTypeId?: string };
	if (!entityTypeId) error(400, 'entityTypeId required');
	const db = createDb(platform.env.DB);
	const bookmarked = await toggleBookmark(db, locals.account.id, entityTypeId);
	return json({ bookmarked });
};
