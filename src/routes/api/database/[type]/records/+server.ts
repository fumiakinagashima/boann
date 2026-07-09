import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { listRecords, createRecord, getTableInfo } from '$lib/server/db/table-service';
import type { WorkflowEventMessage } from '$lib/server/workflow/event-trigger';

export const GET: RequestHandler = async ({ params, url, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const appId = url.searchParams.get('appId');
	const info = await getTableInfo(db, params.type, appId);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	const rows = await listRecords(db, params.type, 200, appId);
	return json({ info, rows });
};

export const POST: RequestHandler = async ({ params, url, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const appId = url.searchParams.get('appId');
	const info = await getTableInfo(db, params.type, appId);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	try {
		const data = await request.json() as Record<string, unknown>;
		const record = await createRecord(db, params.type, data, locals.account?.id, appId);
		if (platform.env.QUEUE && info.entityTypeId) {
			const msg: WorkflowEventMessage = { type: 'workflow-event', entityTypeId: info.entityTypeId, event: 'create', recordId: record.id as string, data: record };
			await platform.env.QUEUE.send(msg);
		}
		return json(record, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
