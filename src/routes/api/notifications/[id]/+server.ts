import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getNotification, markNotificationRead } from '$lib/server/db/notification-service';
import { errors } from '$lib/server/errors';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const row = await getNotification(db, params.id);
	if (!row) return errors.notFound();
	if (row.accountId && row.accountId !== locals.account!.id) return errors.forbidden();
	return json(row);
};

export const PATCH: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const existing = await getNotification(db, params.id);
	if (!existing) return errors.notFound();
	if (existing.accountId && existing.accountId !== locals.account!.id) return errors.forbidden();
	const row = await markNotificationRead(db, params.id);
	return json(row);
};
