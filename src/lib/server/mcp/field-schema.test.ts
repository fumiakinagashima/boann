import { describe, it, expect } from 'vitest';
import { buildEntityDataSchema, toJsonSchema } from './field-schema';
import type { FieldDef } from '../db/table-service';

const fields: FieldDef[] = [
	{ key: 'name', label: '名前', type: 'text', required: true },
	{ key: 'age', label: '年齢', type: 'number', required: false },
	{ key: 'status', label: 'ステータス', type: 'select', required: true, options: [{ value: 'open', label: '対応中' }, { value: 'done', label: '完了' }] },
	{ key: 'due', label: '期日', type: 'date', required: false },
	{ key: 'customer', label: '顧客', type: 'recordSelect', required: true, refTable: 'customers' }
];

describe('buildEntityDataSchema', () => {
	it('requires required fields and rejects missing ones in create mode', () => {
		const schema = buildEntityDataSchema(fields, 'create');
		const result = schema.safeParse({ age: 20 });
		expect(result.success).toBe(false);
	});

	it('accepts a valid full payload in create mode', () => {
		const schema = buildEntityDataSchema(fields, 'create');
		const result = schema.safeParse({ name: '田中', age: 20, status: 'open', due: '2026-08-01', customer: 'cust-1' });
		expect(result.success).toBe(true);
	});

	it('rejects an invalid select value', () => {
		const schema = buildEntityDataSchema(fields, 'create');
		const result = schema.safeParse({ name: '田中', status: 'unknown', customer: 'cust-1' });
		expect(result.success).toBe(false);
	});

	it('rejects unknown keys (strict)', () => {
		const schema = buildEntityDataSchema(fields, 'create');
		const result = schema.safeParse({ name: '田中', status: 'open', customer: 'cust-1', extra: 'nope' });
		expect(result.success).toBe(false);
	});

	it('makes every field optional in update mode, including normally-required ones', () => {
		const schema = buildEntityDataSchema(fields, 'update');
		const result = schema.safeParse({ age: 25 });
		expect(result.success).toBe(true);
	});
});

describe('toJsonSchema', () => {
	it('produces a plain JSON Schema object without the $schema field', () => {
		const schema = buildEntityDataSchema(fields, 'create');
		const jsonSchema = toJsonSchema(schema);
		expect(jsonSchema.$schema).toBeUndefined();
		expect(jsonSchema.type).toBe('object');
		const properties = jsonSchema.properties as Record<string, unknown>;
		expect(properties.name).toBeDefined();
		expect(jsonSchema.required).toEqual(expect.arrayContaining(['name', 'status', 'customer']));
	});
});
