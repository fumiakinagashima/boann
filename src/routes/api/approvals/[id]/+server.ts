import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import {
	getApproval,
	updateApprovalStep,
	cancelApproval,
	deleteApproval
} from '$lib/server/db/approval-service';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const row = await getApproval(db, params.id);
	if (!row) return json({ error: 'Not found' }, { status: 404 });
	return json(row);
};

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const body = await request.json() as {
			action?: 'approve_step' | 'reject_step' | 'cancel';
			step?: number;
			comment?: string;
		};
		let row;
		if (body.action === 'approve_step' || body.action === 'reject_step') {
			if (body.step == null) return json({ error: 'step is required' }, { status: 400 });
			row = await updateApprovalStep(
				db, params.id, body.step,
				body.action === 'approve_step' ? 'approve' : 'reject',
				locals.account!.id,
				body.comment
			);
		} else if (body.action === 'cancel') {
			row = await cancelApproval(db, params.id);
		} else {
			return json({ error: 'Invalid action' }, { status: 400 });
		}
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	await deleteApproval(db, params.id);
	return new Response(null, { status: 204 });
};
