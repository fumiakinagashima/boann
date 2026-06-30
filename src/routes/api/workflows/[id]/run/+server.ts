import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { runWorkflowNow, type TriggerContext } from '$lib/server/workflow/run';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const workflow = await getWorkflow(db, params.id);
	if (!workflow) return json({ error: 'Not found' }, { status: 404 });
	if (workflow.accountId && workflow.accountId !== locals.account?.id) {
		return json({ error: '権限がありません' }, { status: 403 });
	}

	let triggerContext: TriggerContext | undefined;
	if (workflow.triggerType === 'event') {
		let body: { triggerRecordId?: string } = {};
		try { body = await request.json(); } catch { /* body は省略可 */ }
		triggerContext = {
			event: workflow.triggerEvent ?? 'create',
			recordId: body.triggerRecordId?.trim() ?? '',
			entityTypeId: workflow.triggerEntityTypeId ?? ''
		};
	}

	try {
		const result = await runWorkflowNow(db, params.id, platform.env, triggerContext);
		return json(result);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
