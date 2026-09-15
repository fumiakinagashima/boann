import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getRecord, updateRecord, deleteRecord, getTableInfo } from '$lib/server/db/table-service';
import type { WorkflowEventMessage } from '$lib/server/workflow/event-trigger';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const record = await getRecord(db, params.type, params.id);
	if (!record) return json({ error: 'Not found' }, { status: 404 });
	return json(record);
};

export const PATCH: RequestHandler = async ({ params, url, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const data = await request.json() as Record<string, unknown>;
		const record = await updateRecord(db, params.type, params.id, data, locals.account?.id);
		if (platform.env.QUEUE && record.entityTypeId) {
			const msg: WorkflowEventMessage = { type: 'workflow-event', entityTypeId: record.entityTypeId as string, event: 'update', recordId: record.id as string, data: record };
			await platform.env.QUEUE.send(msg);
		}
		return json(record);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, url, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const appId = url.searchParams.get('appId');
	if (!appId) return json({ error: 'appId is required' }, { status: 400 });
	const info = await getTableInfo(db, params.type, appId);
	// Take a snapshot of the field values before deletion, for the workflow's @trigger:<field> references
	// (since they can no longer be read from entities after deletion).
	const snapshot = await getRecord(db, params.type, params.id);
	await deleteRecord(db, params.type, params.id);
	if (platform.env.QUEUE && info?.entityTypeId) {
		const msg: WorkflowEventMessage = { type: 'workflow-event', entityTypeId: info.entityTypeId, event: 'delete', recordId: params.id, data: snapshot ?? undefined };
		await platform.env.QUEUE.send(msg);
	}
	return new Response(null, { status: 204 });
};
