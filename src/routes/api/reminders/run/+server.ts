import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { processDueReminders } from '$lib/server/reminders/delivery';

export const POST: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const results = await processDueReminders(db, platform.env);
	return json({ results });
};
