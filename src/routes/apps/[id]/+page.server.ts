import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById, getTablesByAppId } from '$lib/server/db/table-service';
import { listWorkflowsByAppId } from '$lib/server/db/workflow-service';
import { getMcpTokenStatus } from '$lib/server/mcp/auth';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) error(404, 'App not found');
	const [tables, workflows, mcpStatus] = await Promise.all([
		getTablesByAppId(db, params.id),
		listWorkflowsByAppId(db, params.id),
		getMcpTokenStatus(db, params.id)
	]);

	return { app, tables, workflows, mcpStatus };
};
