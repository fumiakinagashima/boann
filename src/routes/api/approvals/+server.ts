import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { listApprovals, createApproval } from '$lib/server/db/approval-service';

export const GET: RequestHandler = async ({ url, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const status = url.searchParams.get('status')?.split(',').filter(Boolean);
	const rows = await listApprovals(db, { status });
	return json({ rows });
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const data = await request.json() as Parameters<typeof createApproval>[1];
		const row = await createApproval(db, { ...data, submittedBy: locals.account!.name });
		return json(row, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
