import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';

// Returns the workflow's run logs (fetched by the client while editing the dialog).
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const workflow = await getWorkflow(db, params.id);
	if (!workflow) return json({ error: 'Not found' }, { status: 404 });
	if (workflow.accountId && workflow.accountId !== locals.account?.id) {
		return json({ error: 'No permission' }, { status: 403 });
	}
	const runs = await listWorkflowRuns(db, params.id);
	return json({ runs });
};
