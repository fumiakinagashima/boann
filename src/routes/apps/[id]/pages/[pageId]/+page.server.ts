import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import {
	getPageById,
	getAppById,
	getFieldsByEntityTypeId,
	listRecordsByEntityTypeId,
	getTableInfo,
	listRecords
} from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);

	const [page, app] = await Promise.all([
		getPageById(db, params.pageId),
		getAppById(db, params.id)
	]);
	if (!page) error(404, 'ページが見つかりません');
	if (!app) error(404, 'アプリが見つかりません');
	if (!page.tableId || !page.tableName) error(404, 'ページにテーブルが紐づいていません');

	const [fields, records] = await Promise.all([
		getFieldsByEntityTypeId(db, page.tableId),
		listRecordsByEntityTypeId(db, page.tableId)
	]);

	const refFields = fields.filter(f => f.type === 'recordSelect' && f.refTable);
	const tableCache: Record<string, { fields: { key: string }[]; rows: Record<string, unknown>[] }> = {};
	await Promise.all(
		[...new Set(refFields.map(f => f.refTable!))].map(async (refTable) => {
			const [info, rows] = await Promise.all([getTableInfo(db, refTable), listRecords(db, refTable)]);
			if (info) tableCache[refTable] = { fields: info.fields, rows };
		})
	);

	const recordOptions: Record<string, { value: string; label: string }[]> = {};
	for (const field of refFields) {
		const cached = tableCache[field.refTable!];
		if (!cached) continue;
		const labelKey = field.refLabelKey || cached.fields[0]?.key || 'id';
		recordOptions[field.key] = cached.rows.map(r => ({
			value: String(r.id),
			label: String(r[labelKey] ?? r.id)
		}));
	}

	return { page, app, fields, records, recordOptions };
};
