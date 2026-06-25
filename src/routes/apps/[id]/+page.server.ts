import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById, getTablesByAppId } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const tables = await getTablesByAppId(db, params.id);
	return { app, tables };
};
