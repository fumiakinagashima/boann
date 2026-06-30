import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createDb } from '$lib/server/db';
import {
	getPageById,
	getAppById,
	getTablesByAppId,
	getFieldsByEntityTypeId,
	deletePage,
	findTablesReferencingTable
} from '$lib/server/db/table-service';
import type { FieldDef, ReferencingTable } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
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

	let referencingTables: ReferencingTable[] = [];
	if (page.tableId) {
		const currentTable = tables.find(t => t.id === page.tableId);
		if (currentTable) {
			referencingTables = await findTablesReferencingTable(db, currentTable.name, params.id);
		}
	}

	return { page, app, tables, tableFields, referencingTables };
};

export const actions: Actions = {
	delete: async ({ params, platform }) => {
		if (!platform?.env?.DB) error(500);
		const db = createDb(platform.env.DB);
		await deletePage(db, params.pageId);
		redirect(303, `/apps/${params.id}`);
	}
};
