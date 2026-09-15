import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { listAllTables, createEntityType, type EntityTypeInput } from '$lib/server/db/table-service';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const tables = await listAllTables(db);
	return json(tables);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const body = await request.json() as EntityTypeInput & { appId?: string };
		let appId = body.appId;
		if (!appId) {
			// If appId is not specified, automatically create an app with the same name (backward compatibility)
			const { createApp } = await import('$lib/server/db/table-service');
			const app = await createApp(db, { name: body.name, label: body.label, icon: body.icon });
			appId = app.id;
		}
		const result = await createEntityType(db, { ...body, appId });
		return json(result, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
