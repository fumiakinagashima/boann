import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById, getTablesByAppId, getPagesByAppId } from '$lib/server/db/table-service';
import { listWorkflowsByAppId } from '$lib/server/db/workflow-service';

const VALID_TABS = ['tables', 'pages', 'workflows'] as const;
type AppTab = (typeof VALID_TABS)[number];

export const load: PageServerLoad = async ({ params, platform, url }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const [tables, pages, workflows] = await Promise.all([
		getTablesByAppId(db, params.id),
		getPagesByAppId(db, params.id),
		listWorkflowsByAppId(db, params.id)
	]);
	const tabParam = url.searchParams.get('tab') as AppTab | null;
	const tab: AppTab = VALID_TABS.includes(tabParam as AppTab) ? (tabParam as AppTab) : 'tables';
	
	return { app, tables, pages, workflows, tab };
};
