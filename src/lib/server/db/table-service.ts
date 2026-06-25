import { eq, desc, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from './index';
import { entityTypes, entityFields, entities } from './schema';

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
	listable?: boolean;
	isCustom?: boolean;
	refTable?: string;
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
	'approvals', 'accounts', 'reminders', 'workflows', // 固定ルート
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
			refTable: f.refTable ?? undefined
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
					refTable: f.refTable ?? undefined
				}))
			};
		})
	);
}

export type EntityTypeForWorkflow = {
	id: string;
	label: string;
	fields: { key: string; label: string }[];
};

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

// ── Entity type (custom table) management ──────────────────────────────────

export type EditableField = Omit<FieldDef, 'listable' | 'isCustom'> & { _id: string };

export type EntityTypeInput = {
	name: string;
	label: string;
	icon?: string;
	fields: EditableField[];
};

export async function createEntityType(db: Db, input: EntityTypeInput): Promise<void> {
	if (RESERVED_NAMES.has(input.name)) {
		throw new Error(`テーブル名 "${input.name}" はシステムで予約されています。別の名前を使用してください。`);
	}
	const [existing] = await db.select({ name: entityTypes.name }).from(entityTypes).where(eq(entityTypes.name, input.name));
	if (existing) {
		throw new Error(`テーブル名 "${input.name}" はすでに使用されています。`);
	}

	const id = crypto.randomUUID();
	await db.batch([
		db.insert(entityTypes).values({ id, name: input.name, label: input.label, icon: input.icon }),
		...input.fields.map((f, i) =>
			db.insert(entityFields).values({
				id: crypto.randomUUID(), entityTypeId: id,
				key: f.key, label: f.label, type: f.type as CustomFieldType,
				required: f.required ?? false,
				options: JSON.stringify(f.options ?? []),
				refTable: f.refTable ?? null,
				sortOrder: i
			})
		)
	]);
}

export async function updateEntityType(db: Db, name: string, input: Partial<EntityTypeInput>): Promise<void> {
	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, name));
	if (!et) throw new Error(`Table not found: ${name}`);

	const queries: BatchItem<'sqlite'>[] = [];

	if (input.label != null || input.icon != null) {
		queries.push(
			db.update(entityTypes).set({
				...(input.label != null ? { label: input.label } : {}),
				...(input.icon != null ? { icon: input.icon } : {})
			}).where(eq(entityTypes.id, et.id))
		);
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
					refTable: f.refTable ?? null,
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
		db.delete(entityTypes).where(eq(entityTypes.id, et.id))
	]);
}
