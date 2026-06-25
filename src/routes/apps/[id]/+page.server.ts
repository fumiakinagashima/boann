import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById, getTablesByAppId, getPagesByAppId } from '$lib/server/db/table-service';
import { listWorkflows } from '$lib/server/db/workflow-service';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const [tables, pages, workflows] = await Promise.all([
		getTablesByAppId(db, params.id),
		getPagesByAppId(db, params.id),
		listWorkflows(db, locals.account?.id)
	]);
	return { app, tables, pages, workflows };
};
