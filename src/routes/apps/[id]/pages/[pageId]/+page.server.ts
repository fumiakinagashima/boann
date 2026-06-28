import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import {
	getPageById,
	getAppById,
	getFieldsByEntityTypeId,
	listRecordsByEntityTypeId,
	getEntityTypeById,
	getTableInfo,
	listRecords
} from '$lib/server/db/table-service';
import type { FieldDef, RecordRow, PageComponent } from '$lib/server/db/table-service';
import { isRefField } from '$lib/types/chat';

export type ComponentData = {
	component: PageComponent;
	tableId: string;
	tableName: string;
	tableLabel: string;
	fields: FieldDef[];
	displayFields: FieldDef[];
	records: RecordRow[];
	recordOptions: Record<string, { value: string; label: string }[]>;
};

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);

	const [page, app] = await Promise.all([
		getPageById(db, params.pageId),
		getAppById(db, params.id)
	]);
	if (!page) error(404, 'ページが見つかりません');
	if (!app) error(404, 'アプリが見つかりません');

	const componentData: ComponentData[] = await Promise.all(
		page.components.map(async (comp) => {
			const [et, fields] = await Promise.all([
				getEntityTypeById(db, comp.tableId),
				getFieldsByEntityTypeId(db, comp.tableId)
			]);
			if (!et) return null;

			const records = comp.type === 'list'
				? await listRecordsByEntityTypeId(db, comp.tableId)
				: [];

			const refFields = fields.filter(f => isRefField(f.type) && f.refTable);
			const recordOptions: Record<string, { value: string; label: string }[]> = {};
			await Promise.all(refFields.map(async (f) => {
				const [info, rows] = await Promise.all([
					getTableInfo(db, f.refTable!),
					listRecords(db, f.refTable!)
				]);
				if (info) {
					const labelKey = f.refLabelKey || info.fields[0]?.key || 'id';
					recordOptions[f.key] = rows.map(r => ({
						value: String(r.id),
						label: String(r[labelKey] ?? r.id)
					}));
				}
			}));

			const displayFields = comp.fields?.length
				? fields.filter(f => comp.fields!.includes(f.key))
				: fields;

			return {
				component: comp,
				tableId: et.id,
				tableName: et.name,
				tableLabel: et.label,
				fields,
				displayFields,
				records,
				recordOptions
			} satisfies ComponentData;
		})
	).then(results => results.filter((r): r is ComponentData => r !== null));

	return { page, app, componentData };
};
