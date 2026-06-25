import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateAppSpec, deleteApp } from '$lib/server/db/table-service';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const { spec } = await request.json() as { spec: string };
	await updateAppSpec(db, params.id, spec ?? '');
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteApp(db, params.id);
	return new Response(null, { status: 204 });
};
