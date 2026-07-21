import { z } from 'zod';
import type { FieldDef } from '../db/table-service';

function fieldToZod(f: FieldDef): z.ZodTypeAny {
	let base: z.ZodTypeAny;
	switch (f.type) {
		case 'number':
			base = z.number();
			break;
		case 'email':
			base = z.string().email();
			break;
		case 'date':
			base = z.iso.date();
			break;
		case 'select':
			base = f.options?.length ? z.enum(f.options.map((o) => o.value) as [string, ...string[]]) : z.string();
			break;
		case 'recordSelect':
		case 'account':
			// 参照先レコードのID。Phase1では参照整合性チェックは行わない。
			base = z.string().min(1);
			break;
		default:
			// text / tel / textarea
			base = z.string();
	}
	if (f.description || f.label) base = base.describe(f.description || f.label);
	return f.required ? base : base.optional();
}

/**
 * entity_fields の定義から、MCPツールのtools/call引数を検証するZodスキーマを組み立てる。
 * create: 必須フィールドは必須のまま。update: 差分更新に対応するため全フィールドを任意にする。
 * 未知キーはエラーにする（LLMのタイプミスを自己修正させるため、record.dataの値自体は
 * 従来どおり緩く保存できるが、MCPツール経由の入力はこのスキーマで厳格に弾く）。
 */
export function buildEntityDataSchema(fields: FieldDef[], mode: 'create' | 'update') {
	const shape: Record<string, z.ZodTypeAny> = {};
	for (const f of fields) {
		const schema = fieldToZod(f);
		shape[f.key] = mode === 'update' ? schema.optional() : schema;
	}
	return z.object(shape).strict();
}

/** tools/list の inputSchema として渡す素のJSON Schemaに変換する（$schemaフィールドは除去）。 */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
	return rest;
}
