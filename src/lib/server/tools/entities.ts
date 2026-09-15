import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { entityTypes, entityFields, entities } from '../db/schema';
import { createApp, createEntityType, createRecord, refColumns } from '../db/table-service';
import { parseJson, now } from './shared';

export const tools: Tool[] = [
	{
		name: 'list_entity_types',
		description: 'Get the list of custom tables (entity types) defined by the user.',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'create_app',
		description:
			'Use this when receiving a request to build a business app in chat, such as "create a ○○ management app". Creates a custom table (entity type) and its field definitions in one batch, and optionally registers sample data as well. After creation, the table\'s data (list/create/edit) can be managed from the app screen (/apps/{id}). If you just want to add a field to an existing custom table, use add_entity_field instead.',
		input_schema: {
			type: 'object',
			properties: {
				name: {
					type: 'string',
					description: 'Identifier name for the table (lowercase letters, digits, underscores only, e.g. sales_pipeline)'
				},
				label: { type: 'string', description: 'Display name for the app/table (e.g. Sales Management)' },
				icon: { type: 'string', description: 'Icon (emoji recommended, e.g. 📈)' },
				fields: {
					type: 'array',
					description: 'List of field definitions (display order)',
					items: {
						type: 'object',
						properties: {
							key: {
								type: 'string',
								description: 'Field key (lowercase letters, digits, underscores only)'
							},
							label: { type: 'string', description: 'Display name of the field' },
							type: {
								type: 'string',
								enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'],
								description:
									'Field type. recordSelect is a relational field that references a record in another table. account is a relational field that references an account (user); ref_table is not needed for it (it automatically references accounts, and the display/options show the account name)'
							},
							required: { type: 'boolean', description: 'Whether the field is required' },
							options: {
								type: 'array',
								items: {
									type: 'object',
									properties: { value: { type: 'string' }, label: { type: 'string' } }
								},
								description: 'Choices to use when type is select'
							},
							ref_table: {
								type: 'string',
								description:
									'The name of the related table when type is recordSelect. Specify the name of a table obtained from list_entity_types'
							}
						},
						required: ['key', 'label']
					}
				},
				seed_records: {
					type: 'array',
					items: { type: 'object', description: 'Field key: value pairs' },
					description: 'Sample data to seed initially (optional; 2-3 records recommended so a demo feels immediately usable)'
				}
			},
			required: ['name', 'label', 'fields']
		}
	},
	{
		name: 'get_entity_fields',
		description: 'Get the field definitions of the specified custom table.',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'ID of the entity type' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity_type',
		description:
			'Create a new user-defined custom table. Examples: inventory management, project management, etc.',
		input_schema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Identifier name for the table (lowercase letters and underscores recommended)' },
				label: { type: 'string', description: 'Display name for the table (e.g. Inventory Management)' },
				icon: { type: 'string', description: 'Icon (emoji recommended, e.g. 📦)' }
			},
			required: ['name', 'label']
		}
	},
	{
		name: 'add_entity_field',
		description: 'Add a field to a custom table.',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'ID of the entity type (required)' },
				key: { type: 'string', description: 'Field key (lowercase letters and underscores recommended)' },
				label: { type: 'string', description: 'Display name of the field' },
				type: {
					type: 'string',
					enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'],
					description:
						'Field type. recordSelect is a relational field that references a record in another table. account is a relational field that references an account (user); ref_table is not needed for it (it automatically references accounts, and the display/options show the account name)'
				},
				required: { type: 'boolean', description: 'Whether the field is required' },
				options: {
					type: 'array',
					items: {
						type: 'object',
						properties: { value: { type: 'string' }, label: { type: 'string' } }
					},
					description: 'Choices to use when type is select'
				},
				ref_table: {
					type: 'string',
					description:
						'The name of the related table when type is recordSelect. Specify the name of a table obtained from list_entity_types'
				}
			},
			required: ['entity_type_id', 'key', 'label']
		}
	},
	{
		name: 'get_entities',
		description: 'Get the list of records in a custom table.',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'ID of the entity type (required)' },
				limit: { type: 'number', description: 'Maximum number of records to retrieve (default: 50)' }
			},
			required: ['entity_type_id']
		}
	},
	{
		name: 'create_entity',
		description: 'Register a record in a custom table.',
		input_schema: {
			type: 'object',
			properties: {
				entity_type_id: { type: 'string', description: 'ID of the entity type (required)' },
				data: { type: 'object', description: 'Record data (field key: value)' }
			},
			required: ['entity_type_id', 'data']
		}
	},
	{
		name: 'update_entity',
		description: 'Update a record in a custom table.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Record ID (required)' },
				data: { type: 'object', description: 'Data to update (merged with the existing data)' }
			},
			required: ['id', 'data']
		}
	},
	{
		name: 'create_table',
		description:
			'Add a table to the app currently being edited. Creates a new data table with the specified table name and field definitions. Once created, the data management screen becomes automatically available.',
		input_schema: {
			type: 'object',
			properties: {
				app_id: { type: 'string', description: 'ID of the app to add the table to' },
				name: {
					type: 'string',
					description: 'Identifier name for the table (lowercase letters, digits, underscores only, e.g. customers)'
				},
				label: { type: 'string', description: 'Display name for the table (e.g. Customers)' },
				icon: { type: 'string', description: 'Icon (emoji recommended, e.g. 👥)' },
				fields: {
					type: 'array',
					description: 'List of field definitions (display order)',
					items: {
						type: 'object',
						properties: {
							key: { type: 'string', description: 'Field key (lowercase letters, digits, underscores only)' },
							label: { type: 'string', description: 'Display name of the field' },
							type: {
								type: 'string',
								enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'],
								description: 'Field type. account is a relational field that references an account (user) (ref_table not needed)'
							},
							required: { type: 'boolean', description: 'Whether the field is required' },
							options: {
								type: 'array',
								items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
								description: 'Choices to use when type is select'
							},
							ref_table: {
								type: 'string',
								description: 'The name of the related table when type is recordSelect'
							}
						},
						required: ['key', 'label']
					}
				}
			},
			required: ['app_id', 'name', 'label', 'fields']
		}
	}
];

const createEntityTypeSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits, and underscores are allowed'),
	label: z.string().min(1),
	icon: z.string().optional()
});

const getEntityFieldsSchema = z.object({ entity_type_id: z.string() });

const addEntityFieldSchema = z.object({
	entity_type_id: z.string(),
	key: z.string().min(1).regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z
		.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'])
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
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits, and underscores are allowed'),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(
		z.object({
			key: z.string().min(1).regex(/^[a-z0-9_]+$/),
			label: z.string().min(1),
			type: z
				.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'])
				.default('text'),
			required: z.boolean().default(false),
			options: z.array(z.object({ value: z.string(), label: z.string() })).optional().default([]),
			ref_table: z.string().optional()
		})
	)
});

const createAppFieldSchema = z.object({
	key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits, and underscores are allowed'),
	label: z.string().min(1),
	type: z
		.enum(['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'])
		.default('text'),
	required: z.boolean().default(false),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional()
		.default([]),
	ref_table: z.string().optional()
});

const createAppSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, digits, and underscores are allowed'),
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
		await createRecord(db, data.name, record, undefined, app.id);
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
	if (!type) throw new Error(`Entity type not found: ${data.entity_type_id}`);

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
		...refColumns({ type: data.type, refTable: data.ref_table }),
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

export async function handleCreateEntity(db: Db, input: unknown, accountId?: string) {
	const { entity_type_id, data } = createEntitySchema.parse(input);
	const id = crypto.randomUUID();
	await db
		.insert(entities)
		.values({ id, entityTypeId: entity_type_id, data: JSON.stringify(data), createdBy: accountId ?? null, updatedBy: accountId ?? null });
	const [row] = await db.select().from(entities).where(eq(entities.id, id));
	return { ...row, data: parseJson(row.data) };
}

export async function handleUpdateEntity(db: Db, input: unknown, accountId?: string) {
	const { id, data } = updateEntitySchema.parse(input);
	const [existing] = await db.select().from(entities).where(eq(entities.id, id));
	if (!existing) throw new Error(`Record not found: ${id}`);

	const merged = JSON.stringify({ ...parseJson(existing.data), ...data });
	const set: Record<string, unknown> = { data: merged, updatedAt: now() };
	if (accountId !== undefined) set.updatedBy = accountId;
	await db.update(entities).set(set).where(eq(entities.id, id));
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
