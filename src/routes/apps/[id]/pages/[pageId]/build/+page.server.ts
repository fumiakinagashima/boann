import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import {
	getPageById,
	getAppById,
	getTablesByAppId,
	getFieldsByEntityTypeId
} from '$lib/server/db/table-service';
import type { FieldDef } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) error(500);
	if (locals.account?.permission !== 'admin') error(403);
	const db = createDb(platform.env.DB);

	const [page, app, tables] = await Promise.all([
		getPageById(db, params.pageId),
		getAppById(db, params.id),
		getTablesByAppId(db, params.id)
	]);
	if (!page) error(404, 'ページが見つかりません');
	if (!app) error(404, 'アプリが見つかりません');

	const tableFields: Record<string, FieldDef[]> = {};
	await Promise.all(tables.map(async (t) => {
		tableFields[t.id] = await getFieldsByEntityTypeId(db, t.id);
	}));

	return { page, app, tables, tableFields };
};
