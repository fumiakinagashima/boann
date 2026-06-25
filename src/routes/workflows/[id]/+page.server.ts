import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) error(500, 'DB not available');
	const db = createDb(platform.env.DB);
	const [workflow, entityTypes, slackIntegrations] = await Promise.all([
		getWorkflow(db, params.id),
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	if (!workflow) error(404, 'ワークフローが見つかりません');
	const runs = await listWorkflowRuns(db, params.id, 20);
	return { workflow, entityTypes, slackIntegrations, runs };
};
