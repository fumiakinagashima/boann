import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateAppMeta, deleteApp, getAppById } from '$lib/server/db/table-service';
import { errors } from '$lib/server/errors';
import { canManageApp as canManage } from '$lib/server/authz';

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('App not found');
	if (!canManage(app, locals.account)) return errors.forbidden();
	const body = await request.json() as { label?: string; icon?: string };
	if (body.label !== undefined || body.icon !== undefined) {
		await updateAppMeta(db, params.id, { label: body.label, icon: body.icon });
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('App not found');
	if (!canManage(app, locals.account)) return errors.forbidden();
	await deleteApp(db, params.id);
	return new Response(null, { status: 204 });
};
