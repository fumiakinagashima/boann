import { error, fail, redirect } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getWorkflow, deleteWorkflow } from '$lib/server/db/workflow-service';
import { getAppById } from '$lib/server/db/table-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import { listExternalApiConnectionsForWorkflow } from '$lib/server/db/external-api-connection-service';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const [workflow, app, entityTypes, slackIntegrations, integrations] = await Promise.all([
		getWorkflow(db, params.workflowId),
		getAppById(db, params.id),
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db),
		listExternalApiConnectionsForWorkflow(db)
	]);
	if (!workflow) error(404, 'Workflow not found');
	if (!app) error(404, 'App not found');
	const runs = await listWorkflowRuns(db, params.workflowId, 20);
	return { workflow, app, entityTypes, slackIntegrations, integrations, runs };
};

export const actions: Actions = {
	delete: async ({ params, platform, locals }) => {
		if (!platform?.env?.DB) error(500);
		const db = createDb(platform.env.DB);
		const workflow = await getWorkflow(db, params.workflowId);
		if (!workflow) error(404, 'Workflow not found');
		if (workflow.accountId && workflow.accountId !== locals.account?.id) {
			return fail(403, { message: 'You do not have permission' });
		}
		await deleteWorkflow(db, params.workflowId);
		redirect(303, `/apps/${params.id}`);
	}
};
