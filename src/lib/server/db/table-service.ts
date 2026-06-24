import { eq, desc, sql } from 'drizzle-orm';
import { parseJstDatetime } from '$lib/datetime';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from './index';
import {
	customers, contacts, deals, activities,
	entityTypes, entityFields, entities, coreCustomFields
} from './schema';

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
	// 登録・編集フォームの選択肢（省略時は options を使用）。
	// システムが自動付与する値（例: 活動履歴の「案件登録」）を表示用 options には残しつつ、フォームでは選択不可にする場合に指定する
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

export const CORE_TABLE_NAMES = ['customers', 'contacts', 'deals', 'activities'];

// /database/[type] ルートと衝突する予約済み名
const RESERVED_NAMES = new Set([
	...CORE_TABLE_NAMES,
	'approvals', 'accounts', 'reminders', // 固定ルート
	'entity_types', 'entity_fields', 'entities', 'core_custom_fields',
	'approval_requests', 'approval_attachments', 'integrations', // 物理テーブル名
	'new', 'schema', 'gantt',         // サブルート名
]);

const CORE_TABLE_BASE: Record<string, Omit<TableInfo, 'fields'> & { fields: FieldDef[] }> = {
	customers: {
		id: 'customers', label: '顧客', icon: 'building', isCore: true,
		fields: [
			{ key: 'name', label: '会社名', type: 'text', required: true, listable: true },
			{ key: 'email', label: 'メール', type: 'email', listable: true },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'postalCode', label: '郵便番号', type: 'text' },
			{ key: 'address', label: '住所', type: 'text' },
			{ key: 'website', label: 'ホームページ', type: 'text' },
			{
				key: 'status', label: 'ステータス', type: 'select', listable: true,
				options: [{ label: '有効', value: 'active' }, { label: '無効', value: 'inactive' }]
			},
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	contacts: {
		id: 'contacts', label: '担当者', icon: 'user', isCore: true,
		fields: [
			{ key: 'name', label: '氏名', type: 'text', required: true, listable: true },
			{ key: 'nameKana', label: '氏名（カナ）', type: 'text' },
			{ key: 'customerId', label: '顧客', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{ key: 'email', label: 'メール', type: 'email', listable: true },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'role', label: '役職', type: 'text', listable: true },
			{ key: 'department', label: '部署', type: 'text' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	deals: {
		id: 'deals', label: '案件', icon: 'briefcase', isCore: true,
		fields: [
			{ key: 'title', label: '案件タイトル', type: 'text', required: true, listable: true },
			{ key: 'customerId', label: '顧客', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{ key: 'amount', label: '金額', type: 'number', listable: true },
			{
				key: 'status', label: 'ステータス', type: 'select', listable: true,
				options: [{ label: '商談中', value: 'open' }, { label: '受注', value: 'won' }, { label: '失注', value: 'lost' }]
			},
			{ key: 'plannedStart', label: '開始予定日', type: 'date' },
			{ key: 'plannedEnd', label: '終了予定日', type: 'date' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		]
	},
	activities: {
		id: 'activities', label: '活動履歴', icon: 'clipboard', isCore: true,
		fields: [
			{ key: 'customerId', label: '顧客', type: 'recordSelect', required: true, listable: true, refTable: 'customers' },
			{
				key: 'type', label: '種類', type: 'select', required: true, listable: true,
				options: [
					{ label: 'メモ', value: 'note' }, { label: '電話', value: 'call' },
					{ label: 'メール', value: 'email' }, { label: '面談', value: 'meeting' },
					{ label: '案件登録', value: 'deal_created' }
				],
				// 「案件登録」は案件登録時にシステムが自動で記録するため、フォームでは選択させない
				formOptions: [
					{ label: 'メモ', value: 'note' }, { label: '電話', value: 'call' },
					{ label: 'メール', value: 'email' }, { label: '面談', value: 'meeting' }
				]
			},
			{ key: 'content', label: '内容', type: 'textarea', required: true, listable: true },
			{ key: 'activityDate', label: '活動日時', type: 'datetime-local' }
		]
	}
};

// Keep for backwards compatibility with MCP tools
export const CORE_TABLE_INFO = CORE_TABLE_BASE;

const CORE_COLUMN_KEYS: Record<string, string[]> = {
	customers: ['name', 'email', 'phone', 'postalCode', 'address', 'website', 'status', 'notes'],
	contacts: ['customerId', 'name', 'nameKana', 'email', 'phone', 'role', 'department', 'notes'],
	deals: ['customerId', 'title', 'amount', 'status', 'plannedStart', 'plannedEnd', 'notes'],
	activities: ['customerId', 'type', 'content', 'activityDate']
};

const SYSTEM_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'entityTypeId']);

function extractCustomData(type: string, data: Record<string, unknown>): Record<string, unknown> {
	const coreKeys = new Set(CORE_COLUMN_KEYS[type] ?? []);
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (!coreKeys.has(k) && !SYSTEM_KEYS.has(k)) {
			result[k] = v;
		}
	}
	return result;
}

export async function getCoreCustomFields(db: Db, tableName: string): Promise<FieldDef[]> {
	const fields = await db.select().from(coreCustomFields)
		.where(eq(coreCustomFields.tableName, tableName))
		.orderBy(coreCustomFields.sortOrder);
	return fields.map(f => ({
		key: f.key, label: f.label, type: f.type, required: f.required,
		options: JSON.parse(f.options ?? '[]'), listable: true, isCustom: true,
		refTable: f.refTable ?? undefined
	}));
}

export async function updateCoreCustomFields(db: Db, tableName: string, fields: EditableField[]): Promise<void> {
	await db.batch([
		db.delete(coreCustomFields).where(eq(coreCustomFields.tableName, tableName)),
		...fields.map((f, i) =>
			db.insert(coreCustomFields).values({
				id: crypto.randomUUID(), tableName,
				key: f.key, label: f.label, type: f.type as CustomFieldType,
				required: f.required ?? false,
				options: JSON.stringify(f.options ?? []),
				refTable: f.refTable ?? null,
				sortOrder: i
			})
		)
	]);
}

export async function getTableInfo(db: Db, type: string): Promise<TableInfo | null> {
	if (CORE_TABLE_BASE[type]) {
		const customFields = await getCoreCustomFields(db, type);
		return {
			...CORE_TABLE_BASE[type],
			fields: [...CORE_TABLE_BASE[type].fields, ...customFields]
		};
	}

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
	const [[c1], [c2], [c3], [c4]] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(customers),
		db.select({ count: sql<number>`count(*)` }).from(contacts),
		db.select({ count: sql<number>`count(*)` }).from(deals),
		db.select({ count: sql<number>`count(*)` }).from(activities)
	]);

	const coreTables = [
		{ ...CORE_TABLE_BASE.customers, count: c1.count },
		{ ...CORE_TABLE_BASE.contacts, count: c2.count },
		{ ...CORE_TABLE_BASE.deals, count: c3.count },
		{ ...CORE_TABLE_BASE.activities, count: c4.count }
	];

	const customTypes = await db.select().from(entityTypes);
	const customTables = await Promise.all(
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

	return [...coreTables, ...customTables];
}

export type EntityTypeForWorkflow = {
	id: string;
	label: string;
	fields: { key: string; label: string }[];
};

/** テーブル名（entity_types.name）からid（entity_types.id）を取得する。カスタムテーブル削除前のワークフロー参照チェック等で使う。 */
export async function getEntityTypeByName(db: Db, name: string): Promise<{ id: string } | null> {
	const [et] = await db.select({ id: entityTypes.id }).from(entityTypes).where(eq(entityTypes.name, name));
	return et ?? null;
}

/** ワークフローの「自作テーブル」対象選択用に、カスタムテーブル一覧をid付きで取得する。 */
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
	if (type === 'customers') {
		return (await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(limit))
			.map(c => ({
				id: c.id, name: c.name, email: c.email, phone: c.phone,
				postalCode: c.postalCode, address: c.address, website: c.website,
				status: c.status, notes: c.notes,
				...(JSON.parse(c.custom ?? '{}') as RecordRow),
				createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
			}));
	}
	if (type === 'contacts') {
		return (await db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(limit))
			.map(c => ({
				id: c.id, customerId: c.customerId, name: c.name, nameKana: c.nameKana, email: c.email,
				phone: c.phone, role: c.role, department: c.department, notes: c.notes,
				...(JSON.parse(c.custom ?? '{}') as RecordRow),
				createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
			}));
	}
	if (type === 'deals') {
		return (await db.select().from(deals).orderBy(desc(deals.createdAt)).limit(limit))
			.map(d => ({
				id: d.id, customerId: d.customerId, title: d.title, amount: d.amount,
				status: d.status, plannedStart: d.plannedStart, plannedEnd: d.plannedEnd,
				notes: d.notes,
				...(JSON.parse(d.custom ?? '{}') as RecordRow),
				createdAt: toTs(d.createdAt), updatedAt: toTs(d.updatedAt)
			}));
	}
	if (type === 'activities') {
		return (await db.select().from(activities)
			.orderBy(desc(sql`COALESCE(${activities.activityDate}, ${activities.createdAt})`))
			.limit(limit))
			.map(a => ({
				id: a.id, customerId: a.customerId,
				type: a.type, content: a.content,
				activityDate: toTs(a.activityDate),
				...(JSON.parse(a.custom ?? '{}') as RecordRow),
				createdAt: toTs(a.createdAt)
			}));
	}

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
	if (type === 'customers') {
		const [c] = await db.select().from(customers).where(eq(customers.id, id));
		if (!c) return null;
		return {
			id: c.id, name: c.name, email: c.email, phone: c.phone,
			postalCode: c.postalCode, address: c.address, website: c.website,
			status: c.status, notes: c.notes,
			...(JSON.parse(c.custom ?? '{}') as RecordRow),
			createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
		};
	}
	if (type === 'contacts') {
		const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
		if (!c) return null;
		return {
			id: c.id, customerId: c.customerId, name: c.name, nameKana: c.nameKana, email: c.email,
			phone: c.phone, role: c.role, department: c.department, notes: c.notes,
			...(JSON.parse(c.custom ?? '{}') as RecordRow),
			createdAt: toTs(c.createdAt), updatedAt: toTs(c.updatedAt)
		};
	}
	if (type === 'deals') {
		const [d] = await db.select().from(deals).where(eq(deals.id, id));
		if (!d) return null;
		return {
			id: d.id, customerId: d.customerId, title: d.title, amount: d.amount,
			status: d.status, plannedStart: d.plannedStart, plannedEnd: d.plannedEnd,
			notes: d.notes,
			...(JSON.parse(d.custom ?? '{}') as RecordRow),
			createdAt: toTs(d.createdAt), updatedAt: toTs(d.updatedAt)
		};
	}
	if (type === 'activities') {
		const [a] = await db.select().from(activities).where(eq(activities.id, id));
		if (!a) return null;
		return {
			id: a.id, customerId: a.customerId,
			type: a.type, content: a.content,
			activityDate: toTs(a.activityDate),
			...(JSON.parse(a.custom ?? '{}') as RecordRow),
			createdAt: toTs(a.createdAt)
		};
	}

	const [e] = await db.select().from(entities).where(eq(entities.id, id));
	if (!e) return null;
	return {
		id: e.id,
		...(JSON.parse(e.data ?? '{}') as RecordRow),
		createdAt: toTs(e.createdAt), updatedAt: toTs(e.updatedAt)
	};
}

export async function recordActivity(
	db: Db,
	customerId: string,
	type: 'note' | 'call' | 'email' | 'meeting' | 'deal_created',
	content: string,
	createdBy?: string
): Promise<void> {
	await db.insert(activities).values({ id: crypto.randomUUID(), customerId, type, content, createdBy: createdBy ?? '' });
}

/**
 * 案件登録時の活動履歴の insert クエリを構築する（未実行）。
 * 案件insertと合わせて `db.batch([...])` で原子的に実行するために使う。
 */
export function dealRegisteredActivityInsert(db: Db, customerId: string, dealTitle: string, createdBy?: string) {
	return db.insert(activities).values({
		id: crypto.randomUUID(),
		customerId,
		type: 'deal_created' as const,
		content: `案件「${dealTitle}」を登録しました`,
		createdBy: createdBy ?? ''
	});
}

export async function createRecord(db: Db, type: string, data: Record<string, unknown>): Promise<RecordRow> {
	const id = crypto.randomUUID();
	const s = (k: string) => (data[k] != null && data[k] !== '' ? String(data[k]) : null);
	const n = (k: string) => (data[k] != null && data[k] !== '' ? Number(data[k]) : null);

	if (type === 'customers') {
		const customData = extractCustomData('customers', data);
		await db.insert(customers).values({
			id, name: String(data.name ?? ''),
			email: s('email'), phone: s('phone'),
			postalCode: s('postalCode'), address: s('address'), website: s('website'),
			status: (data.status as 'active' | 'inactive') ?? 'active',
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'customers', id))!;
	}
	if (type === 'contacts') {
		const customData = extractCustomData('contacts', data);
		await db.insert(contacts).values({
			id, customerId: String(data.customerId ?? ''), name: String(data.name ?? ''),
			nameKana: s('nameKana'),
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const customData = extractCustomData('deals', data);
		await db.batch([
			db.insert(deals).values({
				id, customerId: String(data.customerId ?? ''), title: String(data.title ?? ''),
				amount: n('amount'), status: (data.status as 'open' | 'won' | 'lost') ?? 'open',
				plannedStart: s('plannedStart'), plannedEnd: s('plannedEnd'),
				notes: s('notes'), custom: JSON.stringify(customData)
			}),
			dealRegisteredActivityInsert(db, String(data.customerId ?? ''), String(data.title ?? ''))
		]);
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const customData = extractCustomData('activities', data);
		const actDate = data.activityDate ? parseJstDatetime(String(data.activityDate)) : null;
		await db.insert(activities).values({
			id,
			customerId: String(data.customerId ?? ''),
			type: (data.type as 'note' | 'call' | 'email' | 'meeting' | 'deal_created') ?? 'note',
			content: String(data.content ?? ''),
			...(actDate !== null ? { activityDate: actDate } : {}),
			custom: JSON.stringify(customData)
		});
		return (await getRecord(db, 'activities', id))!;
	}

	const [et] = await db.select().from(entityTypes).where(eq(entityTypes.name, type));
	if (!et) throw new Error(`Table not found: ${type}`);

	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.insert(entities).values({ id, entityTypeId: et.id, data: JSON.stringify(entityData) });
	return (await getRecord(db, type, id))!;
}

export async function updateRecord(db: Db, type: string, id: string, data: Record<string, unknown>): Promise<RecordRow> {
	const s = (k: string) => (data[k] != null && data[k] !== '' ? String(data[k]) : null);
	const n = (k: string) => (data[k] != null && data[k] !== '' ? Number(data[k]) : null);

	if (type === 'customers') {
		const [existing] = await db.select({ custom: customers.custom }).from(customers).where(eq(customers.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('customers', data) };
		await db.update(customers).set({
			...(data.name != null ? { name: String(data.name) } : {}),
			email: s('email'), phone: s('phone'),
			postalCode: s('postalCode'), address: s('address'), website: s('website'),
			...(data.status != null ? { status: data.status as 'active' | 'inactive' } : {}),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(customers.id, id));
		return (await getRecord(db, 'customers', id))!;
	}
	if (type === 'contacts') {
		const [existing] = await db.select({ custom: contacts.custom }).from(contacts).where(eq(contacts.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('contacts', data) };
		await db.update(contacts).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.name != null ? { name: String(data.name) } : {}),
			nameKana: s('nameKana'),
			email: s('email'), phone: s('phone'), role: s('role'), department: s('department'),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(contacts.id, id));
		return (await getRecord(db, 'contacts', id))!;
	}
	if (type === 'deals') {
		const [existing] = await db.select({ custom: deals.custom }).from(deals).where(eq(deals.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('deals', data) };
		// ステータス変更に応じて closedAt を更新する（ツール経路 handleUpdateDeal と挙動を揃える）
		const closedAt =
			data.status === 'won' || data.status === 'lost'
				? new Date()
				: data.status === 'open'
					? null
					: undefined;
		await db.update(deals).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.title != null ? { title: String(data.title) } : {}),
			amount: n('amount'),
			...(data.status != null ? { status: data.status as 'open' | 'won' | 'lost' } : {}),
			...(data.plannedStart !== undefined ? { plannedStart: s('plannedStart') } : {}),
			...(data.plannedEnd !== undefined ? { plannedEnd: s('plannedEnd') } : {}),
			...(closedAt !== undefined ? { closedAt } : {}),
			notes: s('notes'), custom: JSON.stringify(mergedCustom), updatedAt: new Date()
		}).where(eq(deals.id, id));
		return (await getRecord(db, 'deals', id))!;
	}
	if (type === 'activities') {
		const [existing] = await db.select({ custom: activities.custom }).from(activities).where(eq(activities.id, id));
		const existingCustom = JSON.parse(existing?.custom ?? '{}') as Record<string, unknown>;
		const mergedCustom = { ...existingCustom, ...extractCustomData('activities', data) };
		const actDate = data.activityDate
			? (String(data.activityDate) !== '' ? parseJstDatetime(String(data.activityDate)) : null)
			: undefined;
		await db.update(activities).set({
			...(data.customerId != null ? { customerId: String(data.customerId) } : {}),
			...(data.type != null ? { type: data.type as 'note' | 'call' | 'email' | 'meeting' | 'deal_created' } : {}),
			...(data.content != null ? { content: String(data.content) } : {}),
			...(actDate !== undefined ? { activityDate: actDate } : {}),
			custom: JSON.stringify(mergedCustom)
		}).where(eq(activities.id, id));
		return (await getRecord(db, 'activities', id))!;
	}

	const { id: _, entityTypeId: __, createdAt: ___, updatedAt: ____, ...entityData } = data;
	await db.update(entities).set({
		data: JSON.stringify(entityData), updatedAt: new Date()
	}).where(eq(entities.id, id));
	return (await getRecord(db, type, id))!;
}

export async function deleteRecord(db: Db, type: string, id: string): Promise<void> {
	if (type === 'customers') { await db.delete(customers).where(eq(customers.id, id)); return; }
	if (type === 'contacts') { await db.delete(contacts).where(eq(contacts.id, id)); return; }
	if (type === 'deals') { await db.delete(deals).where(eq(deals.id, id)); return; }
	if (type === 'activities') { await db.delete(activities).where(eq(activities.id, id)); return; }
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
