import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId, listRecordsByEntityTypeId, getTableInfo, listRecords } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getEntityTypeById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const [fields, records] = await Promise.all([
		getFieldsByEntityTypeId(db, params.id),
		listRecordsByEntityTypeId(db, params.id)
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

	return { app, fields, records, recordOptions };
};
