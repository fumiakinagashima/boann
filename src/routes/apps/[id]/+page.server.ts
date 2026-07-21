import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById, getTablesByAppId, getPagesByAppId } from '$lib/server/db/table-service';
import { listWorkflowsByAppId } from '$lib/server/db/workflow-service';
import { getMcpTokenStatus } from '$lib/server/mcp/auth';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const [tables, pages, workflows, mcpStatus] = await Promise.all([
		getTablesByAppId(db, params.id),
		getPagesByAppId(db, params.id),
		listWorkflowsByAppId(db, params.id),
		getMcpTokenStatus(db, params.id)
	]);

	return { app, tables, pages, workflows, mcpStatus };
};
