import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { listRecords, createRecord, getTableInfo } from '$lib/server/db/table-service';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const info = await getTableInfo(db, params.type);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	const rows = await listRecords(db, params.type);
	return json({ info, rows });
};

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const info = await getTableInfo(db, params.type);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	try {
		const data = await request.json() as Record<string, unknown>;
		const record = await createRecord(db, params.type, data, locals.account?.id);
		return json(record, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
