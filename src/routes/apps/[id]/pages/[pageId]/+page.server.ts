import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import {
	getPageById,
	getPagesByAppId,
	getAppById,
	getEntityTypeById,
	getFieldsByEntityTypeId,
	listRecordsByEntityTypeId,
	listRecordsByRefField,
	getTableInfo,
	listRecords
} from '$lib/server/db/table-service';
import type { FieldDef, RecordRow, DetailRelatedTable } from '$lib/server/db/table-service';
import { isRefField } from '$lib/types/chat';

export type RelatedSection = {
	config: DetailRelatedTable;
	tableLabel: string;
	tableName: string;
	fields: FieldDef[];
	displayFields: FieldDef[];
	records: RecordRow[];
	recordOptions: Record<string, { value: string; label: string }[]>;
};

async function loadRecordOptions(
	db: ReturnType<typeof createDb>,
	fields: FieldDef[]
): Promise<Record<string, { value: string; label: string }[]>> {
	const refFields = fields.filter(f => isRefField(f.type) && f.refTable);
	const options: Record<string, { value: string; label: string }[]> = {};
	await Promise.all(refFields.map(async (f) => {
		const [info, rows] = await Promise.all([getTableInfo(db, f.refTable!), listRecords(db, f.refTable!)]);
		if (info) {
			const labelKey = f.refLabelKey || info.fields[0]?.key || 'id';
			options[f.key] = rows.map(r => ({ value: String(r.id), label: String(r[labelKey] ?? r.id) }));
		}
	}));
	return options;
}

export const load: PageServerLoad = async ({ params, url, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const recordId = url.searchParams.get('recordId');

	const [page, app, allPages] = await Promise.all([
		getPageById(db, params.pageId),
		getAppById(db, params.id),
		getPagesByAppId(db, params.id)
	]);
	if (!page) error(404, 'ページが見つかりません');
	if (!app) error(404, 'アプリが見つかりません');

	// テーブル未設定
	if (!page.tableId) {
		return { page, app, allPages, fields: [], displayFields: [], records: [], recordOptions: {}, record: null, relatedSections: [], et: null };
	}

	const [et, fields] = await Promise.all([
		getEntityTypeById(db, page.tableId),
		getFieldsByEntityTypeId(db, page.tableId)
	]);
	if (!et) error(404, 'テーブルが見つかりません');

	const recordOptions = await loadRecordOptions(db, fields);
	const displayFields = page.config.fields?.length
		? fields.filter(f => page.config.fields!.includes(f.key))
		: fields;

	if (recordId) {
		// ── 詳細ビュー ──────────────────────────────────────────
		const { getRecord } = await import('$lib/server/db/table-service');
		const record = await getRecord(db, et.name, recordId);
		if (!record) error(404, 'レコードが見つかりません');

		const relatedSections: RelatedSection[] = (
			await Promise.all(
				page.config.detail.relatedTables.map(async (rt) => {
					const [relEt, relFields] = await Promise.all([
						getEntityTypeById(db, rt.tableId),
						getFieldsByEntityTypeId(db, rt.tableId)
					]);
					if (!relEt) return null;
					const relDisplayFields = rt.fields?.length
						? relFields.filter(f => rt.fields!.includes(f.key))
						: relFields;
					const [relRecords, relOptions] = await Promise.all([
						listRecordsByRefField(db, rt.tableId, rt.refFieldKey, recordId),
						loadRecordOptions(db, relFields)
					]);
					return {
						config: rt,
						tableLabel: rt.label || relEt.label,
						tableName: relEt.name,
						fields: relFields,
						displayFields: relDisplayFields,
						records: relRecords,
						recordOptions: relOptions
					} satisfies RelatedSection;
				})
			)
		).filter((r): r is RelatedSection => r !== null);

		return { page, app, allPages, fields, displayFields, records: [], recordOptions, record, relatedSections, et };
	}

	// ── 一覧ビュー ──────────────────────────────────────────────
	const records = await listRecordsByEntityTypeId(db, page.tableId);
	return { page, app, allPages, fields, displayFields, records, recordOptions, record: null, relatedSections: [], et };
};
