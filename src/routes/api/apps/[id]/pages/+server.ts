import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { createPage } from '$lib/server/db/table-service';

export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const body = await request.json() as { label: string; tableId?: string | null };
	const result = await createPage(db, params.id, { label: body.label, tableId: body.tableId });
	return json(result, { status: 201 });
};
