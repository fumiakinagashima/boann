import { eq, desc, sql, inArray, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Db } from './index';
import { apps, appPages, entityTypes, entityFields, entities, bookmarks, workflows, workflowRuns } from './schema';

// app スコープ内の末尾に追加するための次の sortOrder（最大値 + 1、無ければ 0）を返す。
async function nextSortOrder(
	db: Db,
	table: SQLiteTable,
	appIdCol: SQLiteColumn,
	appId: string | null,
	sortCol: SQLiteColumn
): Promise<number> {
	const [row] = await db
		.select({ s: sortCol })
		.from(table)
		.where(appId === null ? isNull(appIdCol) : eq(appIdCol, appId))
		.orderBy(desc(sortCol))
		.limit(1);
	const max = (row?.s as number | null | undefined) ?? -1;
	return max + 1;
}

export type PageComponentType = 'list' | 'form';

export type PageComponent = {
	id: string;
	type: PageComponentType;
	tableId: string;
	title?: string | null;
	fields?: string[] | null;
	actions: ('create' | 'edit' | 'delete')[];
};

export type AppPageRow = {
	id: string;
	appId: string;
	label: string;
	components: PageComponent[];
	sortOrder: number;
};

/** クエリ件数が可変の場合に `db.batch([...])` を呼ぶためのヘルパー。空配列なら何もしない。 */
async function batchIfNonEmpty<U extends BatchItem<'sqlite'>>(db: Db, queries: U[]): Promise<void> {
	if (queries.length === 0) return;
	await db.batch(queries as [U, ...U[]]);
}

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'email' | 'tel' | 'textarea';

export type FieldDef = {
	key: string;
	label: string;
	type: CustomFieldType | 'recordSelect' | 'datetime-local';
	required?: boolean;
	options?: { label: string; value: string }[];
	formOptions?: { label: string; value: string }[];
	defaultValue?: string;
	description?: string;
	listable?: boolean;
	isCustom?: boolean;
	refTable?: string;
	refLabelKey?: string;
};

export type TableInfo = {
	id: string;
	label: string;
	icon: string;
	isCore: boolean;
	fields: FieldDef[];
};

export type RecordRow = Record<string, string | number | null>;

const toTs = (d: Date | null | undefined): number | null =>
	d ? Math.floor(d.getTime() / 1000) : null;

export const CORE_TABLE_NAMES: string[] = [];

// /database/[type] ルートと衝突する予約済み名
const RESERVED_NAMES = new Set([
	'accounts', 'reminders', 'workflows', // 固定ルート
	'entity_types', 'entity_fields', 'entities', 'core_custom_fields',
	'integrations',
	'new', 'schema', // サブルート名
]);

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'entityTypeId']);

export async function getTableInfo(db: Db, type: string): Promise<TableInfo | null> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) return null;

	const fields = await db.select().from(entityFields)
		.where(eq(entityFields.entityTypeId, et.id))
		.orderBy(entityFields.sortOrder);

	return {
		id: et.name, label: et.label, icon: et.icon ?? 'table', isCore: false,
		fields: fields.map(f => ({
			key: f.key, label: f.label, type: f.type, required: f.required,
			options: JSON.parse(f.options ?? '[]'), listable: true,
			defaultValue: f.defaultValue ?? undefined,
			description: f.description ?? undefined,
			refTable: f.refTable ?? undefined,
			refLabelKey: f.refLabelKey ?? undefined
		}))
	};
}

export async function listAllTables(db: Db): Promise<(TableInfo & { count: number })[]> {
	const customTypes = await db.select().from(entityTypes);
	return Promise.all(
		customTypes.map(async (et) => {
			const [fields, [{ count }]] = await Promise.all([
				db.select().from(entityFields)
					.where(eq(entityFields.entityTypeId, et.id))
					.orderBy(entityFields.sortOrder),
				db.select({ count: sql<number>`count(*)` })
					.from(entities).where(eq(entities.entityTypeId, et.id))
			]);
			return {
				id: et.name, label: et.label, icon: et.icon ?? 'table', isCore: false, count,
				fields: fields.map(f => ({
					key: f.key, label: f.label, type: f.type, required: f.required,
					options: JSON.parse(f.options ?? '[]'), listable: true,
					defaultValue: f.defaultValue ?? undefined,
					description: f.description ?? undefined,
					refTable: f.refTable ?? undefined
				}))
			};
		})
	);
}

export type TableCard = {
	id: string;
	name: string;
	label: string;
	icon: string | null;
	fieldCount: number;
	recordCount: number;
};

export type AppCard = {
	id: string;
	name: string;
	label: string;
	icon: string | null;
	firstPageId: string | null;
	pageCount: number;
};

export async function listTables(db: Db): Promise<TableCard[]> {
	const types = await db.select().from(entityTypes).orderBy(entityTypes.sortOrder);
	return Promise.all(
		types.map(async (et) => {
			const [[fieldRow], [recordRow]] = await Promise.all([
				db.select({ count: sql<number>`count(*)` }).from(entityFields).where(eq(entityFields.entityTypeId, et.id)),
				db.select({ count: sql<number>`count(*)` }).from(entities).where(eq(entities.entityTypeId, et.id))
			]);
			return {
				id: et.id,
				name: et.name,
				label: et.label,
				icon: et.icon,
				fieldCount: fieldRow.count,
				recordCount: recordRow.count
			} satisfies TableCard;
		})
	);
}

export async function listApps(db: Db): Promise<AppCard[]> {
	const appRows = await db.select().from(apps);
	return Promise.all(appRows.map(async (app) => {
		const [pageRow] = await db.select({ count: sql<number>`count(*)` })
			.from(appPages).where(eq(appPages.appId, app.id));
		// 画面表示は sortOrder が最小のページ（重複時は取得できた1件）
		const [firstPage] = await db.select({ id: appPages.id })
			.from(appPages).where(eq(appPages.appId, app.id))
			.orderBy(appPages.sortOrder).limit(1);
		return {
			id: app.id,
			name: app.name,
			label: app.label,
			icon: app.icon,
			firstPageId: firstPage?.id ?? null,
			pageCount: pageRow.count,
		};
	}));
}

export type EntityTypeForWorkflow = {
	id: string;
	label: string;
	fields: { key: string; label: string }[];
};

export type EntityTypeSimple = { id: string; name: string; label: string; icon: string | null };

export async function listEntityTypesSimple(db: Db): Promise<EntityTypeSimple[]> {
	const rows = await db.select({
		id: entityTypes.id,
		name: entityTypes.name,
		label: entityTypes.label,
		icon: entityTypes.icon
	}).from(entityTypes);
	return rows;
}

export async function getEntityTypeByName(db: Db, name: string): Promise<{ id: string } | null> {
	const [et] = await db.select({ id: entityTypes.id }).from(entityTypes).where(eq(entityTypes.name, name));
	return et ?? null;
}

export async function listEntityTypesForWorkflow(db: Db): Promise<EntityTypeForWorkflow[]> {
	const types = await db.select().from(entityTypes);
	return Promise.all(
		types.map(async (et) => {
			const fields = await db
				.select()
				.from(entityFields)
				.where(eq(entityFields.entityTypeId, et.id))
				.orderBy(entityFields.sortOrder);
			return {
				id: et.id,
				label: et.label,
				fields: fields.map((f) => ({ key: f.key, label: f.label }))
			};
		})
	);
}

export async function listRecords(db: Db, type: string, limit = 200): Promise<RecordRow[]> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) return [];

	return (await db.select().from(entities)
		.where(eq(entities.entityTypeId, et.id))
		.orderBy(desc(entities.createdAt)).limit(limit))
		.map(e => ({
			id: e.id,
			...(JSON.parse(e.data ?? '{}') as RecordRow),
			createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
		}));
}

export async function getRecord(db: Db, type: string, id: string): Promise<RecordRow | null> {
	const [e] = await db.select().from(entities).where(eq(entities.id, id));
	if (!e) return null;
	return {
		id: e.id,
		...(JSON.parse(e.data ?? '{}') as RecordRow),
		createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
	};
}

export async function createRecord(db: Db, type: string, data: Record<string, unknown>): Promise<RecordRow> {
	const id = crypto.randomUUID();

	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) throw new Error(`Table not found: ${type}`);

	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.insert(entities).values({ id, entityTypeId: et.id, data: JSON.stringify(entityData) });
	return (await getRecord(db, type, id))!;
}

export async function updateRecord(db: Db, type: string, id: string, data: Record<string, unknown>): Promise<RecordRow> {
	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.update(entities).set({
		data: JSON.stringify(entityData), updatedAt: new Date()
	}).where(eq(entities.id, id));
	return (await getRecord(db, type, id))!;
}

export async function deleteRecord(db: Db, type: string, id: string): Promise<void> {
	await db.delete(entities).where(eq(entities.id, id));
}

export async function listRecordsByEntityTypeId(db: Db, entityTypeId: string, limit = 200): Promise<RecordRow[]> {
	return (await db.select().from(entities)
		.where(eq(entities.entityTypeId, entityTypeId))
		.orderBy(desc(entities.createdAt)).limit(limit))
		.map(e => ({
			id: e.id,
			...(JSON.parse(e.data ?? '{}') as RecordRow),
			createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
		}));
}

export async function getFieldsByEntityTypeId(db: Db, entityTypeId: string): Promise<FieldDef[]> {
	const fields = await db.select().from(entityFields)
		.where(eq(entityFields.entityTypeId, entityTypeId))
		.orderBy(entityFields.sortOrder);
	return fields.map(f => ({
		key: f.key, label: f.label, type: f.type, required: f.required,
		options: JSON.parse(f.options ?? '[]'), listable: true,
		defaultValue: f.defaultValue ?? undefined,
		description: f.description ?? undefined,
		refTable: f.refTable ?? undefined,
		refLabelKey: f.refLabelKey ?? undefined
	}));
}

// ── Entity type (custom table) management ──────────────────────────────────

export type EditableField = Omit<FieldDef, 'listable' | 'isCustom'> & { _id: string };

export type EntityTypeInput = {
	name: string;
	label: string;
	icon?: string;
	appId: string;
	fields: EditableField[];
};

export type AppInput = {
	name: string;
	label: string;
	icon?: string;
};

export async function createApp(db: Db, input: AppInput): Promise<{ id: string; name: string }> {
	if (RESERVED_NAMES.has(input.name)) {
		throw new Error(`アプリ名 "${input.name}" はシステムで予約されています。`);
	}
	const [existing] = await db.select({ id: apps.id }).from(apps).where(eq(apps.name, input.name));
	if (existing) {
		throw new Error(`アプリ名 "${input.name}" はすでに使用されています。`);
	}
	const id = crypto.randomUUID();
	await db.insert(apps).values({ id, name: input.name, label: input.label, icon: input.icon ?? 'layout-grid' });
	return { id, name: input.name };
}

export async function deleteApp(db: Db, id: string): Promise<void> {
	const tables = await db.select({ id: entityTypes.id })
		.from(entityTypes).where(eq(entityTypes.appId, id));
	const wfRows = await db.select({ id: workflows.id })
		.from(workflows).where(eq(workflows.appId, id));
	const queries: BatchItem<'sqlite'>[] = [];
	// FK 参照を成立させる順序で削除する:
	//   app_pages.table_id → entity_types.id,
	//   entity_types.app_id / app_pages.app_id / workflows.app_id → apps.id,
	//   bookmarks.entity_type_id / entity_fields / entities → entity_types.id
	// 1. app_pages を削除（entity_types を参照しているため先に消す）
	queries.push(db.delete(appPages).where(eq(appPages.appId, id)));
	// 2. テーブルに紐づく子レコードを削除してから entity_types を削除
	for (const table of tables) {
		queries.push(db.delete(entities).where(eq(entities.entityTypeId, table.id)));
		queries.push(db.delete(entityFields).where(eq(entityFields.entityTypeId, table.id)));
		queries.push(db.delete(bookmarks).where(eq(bookmarks.entityTypeId, table.id)));
		queries.push(db.delete(entityTypes).where(eq(entityTypes.id, table.id)));
	}
	// 3. workflow_runs（実行ログ）→ workflows を削除（apps を参照しているため apps より先に消す）
	if (wfRows.length > 0) {
		queries.push(db.delete(workflowRuns).where(inArray(workflowRuns.workflowId, wfRows.map((w) => w.id))));
	}
	queries.push(db.delete(workflows).where(eq(workflows.appId, id)));
	// 4. apps を削除
	queries.push(db.delete(apps).where(eq(apps.id, id)));
	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

export async function createEntityType(db: Db, input: EntityTypeInput): Promise<{ id: string; name: string }> {
	if (RESERVED_NAMES.has(input.name)) {
		throw new Error(`テーブル名 "${input.name}" はシステムで予約されています。別の名前を使用してください。`);
	}
	const [existing] = await db.select({ name: entityTypes.name }).from(entityTypes).where(eq(entityTypes.name, input.name));
	if (existing) {
		throw new Error(`テーブル名 "${input.name}" はすでに使用されています。`);
	}

	const id = crypto.randomUUID();
	// テーブルは app 内の末尾に追加する。ページはテーブルとは独立して別途作成する（自動生成しない）。
	const tableSortOrder = await nextSortOrder(db, entityTypes, entityTypes.appId, input.appId ?? null, entityTypes.sortOrder);
	await db.batch([
		db.insert(entityTypes).values({ id, name: input.name, label: input.label, icon: input.icon, appId: input.appId, sortOrder: tableSortOrder }),
		...input.fields.map((f, i) =>
			db.insert(entityFields).values({
				id: crypto.randomUUID(), entityTypeId: id,
				key: f.key, label: f.label, type: f.type as CustomFieldType,
				required: f.required ?? false,
				options: JSON.stringify(f.options ?? []),
				defaultValue: f.defaultValue ?? null,
				description: f.description ?? null,
				refTable: f.refTable ?? null,
				refLabelKey: f.refLabelKey ?? null,
				sortOrder: i
			})
		)
	]);
	return { id, name: input.name };
}

export async function updateAppSpec(db: Db, id: string, spec: string): Promise<void> {
	await db.update(apps).set({ spec, updatedAt: new Date() }).where(eq(apps.id, id));
}

export async function updateAppMeta(db: Db, id: string, input: { label?: string; icon?: string }): Promise<void> {
	const set: Record<string, unknown> = { updatedAt: new Date() };
	if (input.label !== undefined) set.label = input.label;
	if (input.icon !== undefined) set.icon = input.icon;
	await db.update(apps).set(set).where(eq(apps.id, id));
}

export async function getAppById(db: Db, id: string): Promise<{ id: string; name: string; label: string; icon: string | null; spec: string | null } | null> {
	const [a] = await db.select({ id: apps.id, name: apps.name, label: apps.label, icon: apps.icon, spec: apps.spec })
		.from(apps).where(eq(apps.id, id));
	return a ?? null;
}

export async function getTablesByAppId(db: Db, appId: string): Promise<{ id: string; name: string; label: string; icon: string | null; recordCount: number }[]> {
	const rows = await db.select({ id: entityTypes.id, name: entityTypes.name, label: entityTypes.label, icon: entityTypes.icon })
		.from(entityTypes).where(eq(entityTypes.appId, appId)).orderBy(entityTypes.sortOrder);
	return Promise.all(rows.map(async (et) => {
		const [{ count }] = await db.select({ count: sql<number>`count(*)` })
			.from(entities).where(eq(entities.entityTypeId, et.id));
		return { ...et, recordCount: count };
	}));
}

function parseComponents(raw: string | null | undefined): PageComponent[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as PageComponent[]) : [];
	} catch {
		return [];
	}
}

export async function getPageById(db: Db, pageId: string): Promise<AppPageRow | null> {
	const [row] = await db.select({
		id: appPages.id,
		appId: appPages.appId,
		label: appPages.label,
		components: appPages.components,
		sortOrder: appPages.sortOrder
	}).from(appPages).where(eq(appPages.id, pageId));
	if (!row) return null;
	return { ...row, components: parseComponents(row.components) };
}

export async function getPagesByAppId(db: Db, appId: string): Promise<AppPageRow[]> {
	const rows = await db.select({
		id: appPages.id,
		appId: appPages.appId,
		label: appPages.label,
		components: appPages.components,
		sortOrder: appPages.sortOrder
	}).from(appPages).where(eq(appPages.appId, appId)).orderBy(appPages.sortOrder);
	return rows.map(row => ({ ...row, components: parseComponents(row.components) }));
}

export type PageInput = {
	label: string;
	components: PageComponent[];
};

export async function createPage(db: Db, appId: string, input: PageInput): Promise<{ id: string }> {
	const [maxRow] = await db.select({ sortOrder: appPages.sortOrder })
		.from(appPages).where(eq(appPages.appId, appId))
		.orderBy(desc(appPages.sortOrder)).limit(1);
	const sortOrder = (maxRow?.sortOrder ?? -1) + 1;
	const id = crypto.randomUUID();
	await db.insert(appPages).values({
		id, appId, label: input.label,
		components: JSON.stringify(input.components),
		sortOrder
	});
	return { id };
}

export async function updatePage(db: Db, pageId: string, input: Partial<PageInput>): Promise<void> {
	const set: Record<string, unknown> = {};
	if (input.label !== undefined) set.label = input.label;
	if (input.components !== undefined) set.components = JSON.stringify(input.components);
	if (Object.keys(set).length === 0) return;
	await db.update(appPages).set(set).where(eq(appPages.id, pageId));
}

export async function deletePage(db: Db, pageId: string): Promise<void> {
	await db.delete(appPages).where(eq(appPages.id, pageId));
}

// アプリ設定のページタブ: ドラッグ&ドロップ後の並び順を sortOrder に反映する。
export async function reorderPages(db: Db, appId: string, orderedIds: string[]): Promise<void> {
	if (orderedIds.length === 0) return;
	const queries: BatchItem<'sqlite'>[] = orderedIds.map((id, i) =>
		db.update(appPages).set({ sortOrder: i }).where(eq(appPages.id, id))
	);
	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

// アプリ設定のテーブルタブ: ドラッグ&ドロップ後の並び順を sortOrder に反映する。
export async function reorderTables(db: Db, appId: string, orderedIds: string[]): Promise<void> {
	if (orderedIds.length === 0) return;
	const queries: BatchItem<'sqlite'>[] = orderedIds.map((id, i) =>
		db.update(entityTypes).set({ sortOrder: i }).where(eq(entityTypes.id, id))
	);
	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

export async function getEntityTypeById(db: Db, id: string): Promise<{ id: string; name: string; label: string; icon: string | null } | null> {
	const [et] = await db.select({ id: entityTypes.id, name: entityTypes.name, label: entityTypes.label, icon: entityTypes.icon })
		.from(entityTypes).where(eq(entityTypes.id, id));
	return et ?? null;
}

export async function updateEntityType(db: Db, name: string, input: Partial<EntityTypeInput>): Promise<void> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, name));
	if (!et) throw new Error(`Table not found: ${name}`);

	const queries: BatchItem<'sqlite'>[] = [];

	if (input.label != null || input.icon != null) {
		const metaUpdate = {
			...(input.label != null ? { label: input.label } : {}),
			...(input.icon != null ? { icon: input.icon } : {})
		};
		queries.push(db.update(entityTypes).set(metaUpdate).where(eq(entityTypes.id, et.id)));
	}

	if (input.fields != null) {
		queries.push(db.delete(entityFields).where(eq(entityFields.entityTypeId, et.id)));
		for (let i = 0; i < input.fields.length; i++) {
			const f = input.fields[i];
			queries.push(
				db.insert(entityFields).values({
					id: crypto.randomUUID(), entityTypeId: et.id,
					key: f.key, label: f.label, type: f.type as CustomFieldType,
					required: f.required ?? false,
					options: JSON.stringify(f.options ?? []),
					defaultValue: f.defaultValue ?? null,
					description: f.description ?? null,
					refTable: f.refTable ?? null,
					refLabelKey: f.refLabelKey ?? null,
					sortOrder: i
				})
			);
		}
	}

	await batchIfNonEmpty(db, queries);
}

export async function deleteEntityType(db: Db, name: string): Promise<void> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, name));
	if (!et) return;
	await db.batch([
		db.delete(entities).where(eq(entities.entityTypeId, et.id)),
		db.delete(entityFields).where(eq(entityFields.entityTypeId, et.id)),
		db.delete(appPages).where(eq(appPages.tableId, et.id)),
		db.delete(entityTypes).where(eq(entityTypes.id, et.id))
	]);
}
