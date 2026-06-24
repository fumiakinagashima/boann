import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) throw error(500, 'DB not available');
	const db = createDb(platform.env.DB);
	const workflow = await getWorkflow(db, params.id);
	if (!workflow) throw error(404, 'ワークフローが見つかりません');
	if (workflow.accountId && workflow.accountId !== locals.account?.id) {
		throw error(403, '権限がありません');
	}
	const [runs, entityTypes, slackIntegrations] = await Promise.all([
		listWorkflowRuns(db, params.id),
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	return { workflow, runs, entityTypes, slackIntegrations };
};
