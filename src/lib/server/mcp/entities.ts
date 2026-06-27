import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { entityTypes, entityFields, entities } from '../db/schema';
import { createApp, createEntityType, createRecord, createPage, updateAppSpec } from '../db/table-service';
import type { PageComponent } from '../db/table-service';
import { parseJson, now } from './shared';

export const tools: Tool[] = [
	{
		name: 'list_entity_types',
		description: 'ユーザーが定義したカスタムテーブル（エンティティ種別）の一覧を取得する。',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'create_app',
		description:
			'チャットで「○○管理アプリを作って」のような業務アプリ作成の依頼を受けた場合に使う。カスタムテーブル（エンティティ種別）とそのフィールド定義を一括で作成し、任意でサンプルデータも登録する。作成後はアプリ画面（/apps/{id}）でテーブルのデータ（一覧・登録・編集）を管理できる。既存のカスタムテーブルにフィールドを追加したいだけの場合は add_entity_field を使う。',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'テーブルの識別名（英小文字・数字・アンダースコアのみ、例: sales_pipeline）'
				},
				label: { type: 'string', description: 'アプリ・テーブルの表示名（例: 販売管理）' },
				icon: { type: 'string', description: 'アイコン（絵文字推奨 例: 📈）' },
				fields: {
					type: 'array',
					description: 'フィールド定義の一覧（表示順）',
					items: {
						type: 'object',
						properties: {
							key: {
								type: 'string',
								description: 'フィールドキー（英小文字・数字・アンダースコアのみ）'
							},
							label: { type: 'string', description: 'フィールドの表示名' },
							type: {
								type: 'string',
								enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'],
								description:
									'フィールドの型。recordSelect は他テーブルのレコードを参照する関係フィールド'
							},
							required: { type: 'boolean', description: '必須フィールドかどうか' },
							options: {
								type: 'array',
								items: {
									type: 'object',
									properties: { value: { type: 'string' }, label: { type: 'string' } }
								},
								description: 'type が select のときの選択肢'
							},
							ref_table: {
								type: 'string',
								description:
									'type が recordSelect のときの関係先テーブル名。list_entity_types で取得したテーブルの name を指定する'
							}
						},
						required: ['key', 'label']
					}
				},
				seed_records: {
					type: 'array',
					items: { type: 'object', description: 'フィールドキー: 値の組' },
					description: '初期投入するサンプルデータ（任意。デモでの即時運用感のため2〜3件程度を推奨）'
				}
			},
			required: ['name', 'label', 'fields']
		}
	},
	{
		name: 'get_entity_fields',
		description: '指定したカスタムテーブルのフィールド定義を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity_type',
		description:
			'ユーザー定義のカスタムテーブルを新規作成する。例: 在庫管理・プロジェクト管理など。',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'テーブルの識別名（英小文字・アンダースコア推奨）' },
				label: { type: 'string', description: 'テーブルの表示名（例: 在庫管理）' },
				icon: { type: 'string', description: 'アイコン（絵文字推奨 例: 📦）' }
			},
			required: ['name', 'label']
		}
	},
	{
		name: 'add_entity_field',
		description: 'カスタムテーブルにフィールドを追加する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				key: { type: 'string', description: 'フィールドキー（英小文字・アンダースコア推奨）' },
				label: { type: 'string', description: 'フィールドの表示名' },
				type: {
					type: 'string',
					enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'],
					description:
						'フィールドの型。recordSelect は他テーブルのレコードを参照する関係フィールド'
				},
				required: { type: 'boolean', description: '必須フィールドかどうか' },
				options: {
					type: 'array',
					items: {
						type: 'object',
						properties: { value: { type: 'string' }, label: { type: 'string' } }
					},
					description: 'type が select のときの選択肢'
				},
				ref_table: {
					type: 'string',
					description:
						'type が recordSelect のときの関係先テーブル名。list_entity_types で取得したテーブルの name を指定する'
				}
			},
			required: ['entity_type_id', 'key', 'label']
		}
	},
	{
		name: 'get_entities',
		description: 'カスタムテーブルのレコード一覧を取得する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				limit: { type: 'number', description: '取得件数の上限（デフォルト: 50）' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity',
		description: 'カスタムテーブルにレコードを登録する。',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'エンティティ種別のID（必須）' },
				data: { type: 'object', description: 'レコードのデータ（フィールドキー: 値）' }
			},
			required: ['entity_type_id', 'data']
		}
	},
	{
		name: 'update_entity',
		description: 'カスタムテーブルのレコードを更新する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'レコードID（必須）' },
				data: { type: 'object', description: '更新するデータ（既存データとマージされる）' }
			},
			required: ['id', 'data']
		}
	},
	{
		name: 'create_table',
		description:
			'現在編集中のアプリにテーブルを追加する。テーブル名・フィールド定義を指定して新しいデータテーブルを作成する。ページは自動生成されないため、テーブルを画面表示したい場合は別途 create_page でページを作成する。',
		input_schema: {
			type: 'object',
			properties: {
				app_id: { type: 'string', description: '追加先のアプリID' },
				name: {
					type: 'string',
					description: 'テーブルの識別名（英小文字・数字・アンダースコアのみ、例: customers）'
				},
				label: { type: 'string', description: 'テーブルの表示名（例: 顧客）' },
				icon: { type: 'string', description: 'アイコン（絵文字推奨 例: 👥）' },
				fields: {
					type: 'array',
					description: 'フィールド定義の一覧（表示順）',
					items: {
						type: 'object',
						properties: {
							key: { type: 'string', description: 'フィールドキー（英小文字・数字・アンダースコアのみ）' },
							label: { type: 'string', description: 'フィールドの表示名' },
							type: {
								type: 'string',
								enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'],
								description: 'フィールドの型'
							},
							required: { type: 'boolean', description: '必須フィールドかどうか' },
							options: {
								type: 'array',
								items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
								description: 'type が select のときの選択肢'
							},
							ref_table: {
								type: 'string',
								description: 'type が recordSelect のときの関係先テーブル名'
							}
						},
						required: ['key', 'label']
					}
				}
			},
			required: ['app_id', 'name', 'label', 'fields']
		}
	},
	{
		name: 'create_page',
		description:
			'現在編集中のアプリにページを追加する。コンポーネント（list: 一覧表示, form: 入力フォーム）を配置して画面を定義する。create_table 実行後に呼ぶ。',
		input_schema: {
			type: 'object',
			properties: {
				app_id: { type: 'string', description: 'アプリID' },
				label: { type: 'string', description: 'ページの表示名（例: 顧客一覧, 顧客登録）' },
				components: {
					type: 'array',
					description: 'ページに配置するコンポーネント一覧',
					items: {
						type: 'object',
						properties: {
							type: {
								type: 'string',
								enum: ['list', 'form'],
								description: 'list: レコード一覧表示（表・編集可）, form: 新規登録フォーム'
							},
							table_id: { type: 'string', description: '対象テーブルのID（create_table の結果の id）' },
							title: { type: 'string', description: 'コンポーネントのタイトル（省略時はテーブル名）' },
							fields: {
								type: 'array',
								items: { type: 'string' },
								description: '表示するフィールドキーの一覧（省略時は全フィールド）'
							},
							actions: {
								type: 'array',
								items: { type: 'string', enum: ['create', 'edit', 'delete'] },
								description: '使用可能なアクション（デフォルト: 全て）'
							}
						},
						required: ['type', 'table_id']
					}
				}
			},
			required: ['app_id', 'label', 'components']
		}
	},
	{
		name: 'update_app_spec',
		description:
			'現在編集中のアプリの仕様書（spec）を作成・更新し、画面の仕様書欄に反映する。ユーザーから仕様書の作成・修正を求められたら、会話で内容を述べるだけで済ませず、必ずこのツールで仕様書の全文（Markdown）を書き込むこと。部分的な追記ではなく、常に置き換え後の完成形の全文を渡す。',
		input_schema: {
			type: 'object',
			properties: {
				app_id: { type: 'string', description: '対象のアプリID' },
				spec: {
					type: 'string',
					description: '仕様書の全文（Markdown形式）。既存の内容を置き換える完成形を渡す。'
				}
			},
			required: ['app_id', 'spec']
		}
	}
];

const createEntityTypeSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional()
});

const getEntityFieldsSchema = z.object({ entity_type_id: z.string() });

const addEntityFieldSchema = z.object({
	entity_type_id: z.string(),
	key: z.string().min(1).regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z
		.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'])
		.default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([]),
	ref_table: z.string().optional()
});

const getEntitiesSchema = z.object({
	entity_type_id: z.string(),
	limit: z.number().int().positive().default(50)
});

const createEntitySchema = z.object({
	entity_type_id: z.string(),
	data: z.record(z.string(), z.unknown())
});

const updateEntitySchema = z.object({
	id: z.string(),
	data: z.record(z.string(), z.unknown())
});

const createTableSchema = z.object({
	app_id: z.string(),
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(
		z.object({
			key: z.string().min(1).regex(/^[a-z0-9_]+$/),
			label: z.string().min(1),
			type: z
				.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'])
				.default('text'),
			required: z.boolean().default(false),
			options: z.array(z.object({ value: z.string(), label: z.string() })).optional().default([]),
			ref_table: z.string().optional()
		})
	)
});

const pageComponentInputSchema = z.object({
	type: z.enum(['list', 'form']),
	table_id: z.string(),
	title: z.string().optional(),
	fields: z.array(z.string()).optional(),
	actions: z.array(z.enum(['create', 'edit', 'delete'])).optional()
});

const createPageSchema = z.object({
	app_id: z.string(),
	label: z.string().min(1),
	components: z.array(pageComponentInputSchema).min(1)
});

const updateAppSpecSchema = z.object({
	app_id: z.string(),
	spec: z.string()
});

const createAppFieldSchema = z.object({
	key: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	type: z
		.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect'])
		.default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([]),
	ref_table: z.string().optional()
});

const createAppSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, '英小文字・数字・アンダースコアのみ使用可'),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(createAppFieldSchema).min(1),
	seed_records: z.array(z.record(z.string(), z.unknown())).optional().default([])
});

export async function handleListEntityTypes(db: Db) {
	return db.select().from(entityTypes).orderBy(entityTypes.label);
}

export async function handleGetEntityFields(db: Db, input: unknown) {
	const { entity_type_id } = getEntityFieldsSchema.parse(input);
	return db
		.select()
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, entity_type_id))
		.orderBy(entityFields.sortOrder, entityFields.createdAt)
		.then((rows) => rows.map((r) => ({ ...r, options: parseJson(r.options) })));
}

export async function handleCreateApp(db: Db, input: unknown) {
	const data = createAppSchema.parse(input);

	const app = await createApp(db, { name: data.name, label: data.label, icon: data.icon });
	await createEntityType(db, {
		name: data.name,
		label: data.label,
		icon: data.icon,
		appId: app.id,
		fields: data.fields.map((f) => ({
			_id: crypto.randomUUID(),
			key: f.key,
			label: f.label,
			type: f.type,
			required: f.required,
			options: f.options,
			refTable: f.ref_table
		}))
	});

	for (const record of data.seed_records) {
		await createRecord(db, data.name, record);
	}

	return {
		name: data.name,
		label: data.label,
		icon: data.icon,
		fieldCount: data.fields.length,
		seedCount: data.seed_records.length,
		url: `/apps/${app.id}`
	};
}

export async function handleCreateEntityType(db: Db, input: unknown) {
	const data = createEntityTypeSchema.parse(input);
	const id = crypto.randomUUID();
	await db.insert(entityTypes).values({ id, name: data.name, label: data.label, icon: data.icon });
	const [row] = await db.select().from(entityTypes).where(eq(entityTypes.id, id));
	return row;
}

export async function handleAddEntityField(db: Db, input: unknown) {
	const data = addEntityFieldSchema.parse(input);
	const [type] = await db
		.select()
		.from(entityTypes)
		.where(eq(entityTypes.id, data.entity_type_id));
	if (!type) throw new Error(`エンティティ種別が見つかりません: ${data.entity_type_id}`);

	const [maxRow] = await db
		.select({ sortOrder: entityFields.sortOrder })
		.from(entityFields)
		.where(eq(entityFields.entityTypeId, data.entity_type_id))
		.orderBy(desc(entityFields.sortOrder))
		.limit(1);
	const sortOrder = (maxRow?.sortOrder ?? -1) + 1;

	const id = crypto.randomUUID();
	await db.insert(entityFields).values({
		id,
		entityTypeId: data.entity_type_id,
		key: data.key,
		label: data.label,
		type: data.type,
		required: data.required,
		options: JSON.stringify(data.options),
		refTable: data.ref_table ?? null,
		sortOrder
	});
	const [row] = await db.select().from(entityFields).where(eq(entityFields.id, id));
	return { ...row, options: parseJson(row.options) };
}

export async function handleGetEntities(db: Db, input: unknown) {
	const { entity_type_id, limit } = getEntitiesSchema.parse(input);
	const [[et], rows] = await Promise.all([
		db.select({ name: entityTypes.name }).from(entityTypes).where(eq(entityTypes.id, entity_type_id)),
		db.select().from(entities)
			.where(eq(entities.entityTypeId, entity_type_id))
			.orderBy(desc(entities.createdAt))
			.limit(limit)
	]);
	return {
		entityTypeName: et?.name,
		rows: rows.map((r) => ({ ...r, data: parseJson(r.data) }))
	};
}

export async function handleCreateEntity(db: Db, input: unknown) {
	const { entity_type_id, data } = createEntitySchema.parse(input);
	const id = crypto.randomUUID();
	await db
		.insert(entities)
		.values({ id, entityTypeId: entity_type_id, data: JSON.stringify(data) });
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

export async function handleUpdateEntity(db: Db, input: unknown) {
	const { id, data } = updateEntitySchema.parse(input);
	const [existing] = await db.select().from(entities).where(eq(entities.id, id));
	if (!existing) throw new Error(`レコードが見つかりません: ${id}`);

	const merged = JSON.stringify({ ...parseJson(existing.data), ...data });
	await db.update(entities).set({ data: merged, updatedAt: now() }).where(eq(entities.id, id));
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

export async function handleCreateTable(db: Db, input: unknown) {
	const data = createTableSchema.parse(input);
	const result = await createEntityType(db, {
		name: data.name,
		label: data.label,
		icon: data.icon,
		appId: data.app_id,
		fields: data.fields.map((f) => ({
			_id: crypto.randomUUID(),
			key: f.key,
			label: f.label,
			type: f.type,
			required: f.required,
			options: f.options,
			refTable: f.ref_table
		}))
	});
	return { id: result.id, name: result.name, label: data.label, appId: data.app_id, fieldCount: data.fields.length };
}

export async function handleCreatePage(db: Db, input: unknown) {
	const data = createPageSchema.parse(input);
	const components: PageComponent[] = data.components.map(c => ({
		id: crypto.randomUUID(),
		type: c.type,
		tableId: c.table_id,
		title: c.title ?? null,
		fields: c.fields ?? null,
		actions: c.actions ?? ['create', 'edit', 'delete']
	}));
	const result = await createPage(db, data.app_id, { label: data.label, components });
	return { id: result.id, label: data.label, appId: data.app_id, componentCount: components.length };
}

export async function handleUpdateAppSpec(db: Db, input: unknown) {
	const data = updateAppSpecSchema.parse(input);
	await updateAppSpec(db, data.app_id, data.spec);
	return { ok: true, appId: data.app_id, length: data.spec.length };
}
