import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getRecord, updateRecord, deleteRecord } from '$lib/server/db/table-service';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const record = await getRecord(db, params.type, params.id);
	if (!record) return json({ error: 'Not found' }, { status: 404 });
	return json(record);
};

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const data = await request.json() as Record<string, unknown>;
		const record = await updateRecord(db, params.type, params.id, data, locals.account?.id);
		return json(record);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteRecord(db, params.type, params.id);
	return new Response(null, { status: 204 });
};
