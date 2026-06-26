import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { getAppById } from '$lib/server/db/table-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const [workflow, app, entityTypes, slackIntegrations] = await Promise.all([
		getWorkflow(db, params.workflowId),
		getAppById(db, params.id),
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	if (!workflow) error(404, 'ワークフローが見つかりません');
	if (!app) error(404, 'アプリが見つかりません');
	const runs = await listWorkflowRuns(db, params.workflowId, 20);
	return { workflow, app, entityTypes, slackIntegrations, runs };
};
