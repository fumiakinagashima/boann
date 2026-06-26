import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateAppSpec, updateAppMeta, deleteApp, setAppIndexPage } from '$lib/server/db/table-service';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const body = await request.json() as { spec?: string; label?: string; icon?: string; indexPageId?: string | null };
	if (body.spec !== undefined) await updateAppSpec(db, params.id, body.spec ?? '');
	if (body.label !== undefined || body.icon !== undefined) {
		await updateAppMeta(db, params.id, { label: body.label, icon: body.icon });
	}
	if ('indexPageId' in body) await setAppIndexPage(db, params.id, body.indexPageId ?? null);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteApp(db, params.id);
	return new Response(null, { status: 204 });
};
