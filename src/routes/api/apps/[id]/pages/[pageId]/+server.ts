import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updatePage, deletePage } from '$lib/server/db/table-service';
import type { PageConfig } from '$lib/server/db/table-service';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const body = await request.json() as { label?: string; tableId?: string | null; config?: PageConfig };
	await updatePage(db, params.pageId, body);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deletePage(db, params.pageId);
	return new Response(null, { status: 204 });
};
