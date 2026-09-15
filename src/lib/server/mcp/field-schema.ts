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
			// ID of the referenced record. Phase1 does not perform referential integrity checks.
			base = z.string().min(1);
			break;
		default:
			// text / tel / textarea
			// When required, also reject an empty string (validate not just the key's presence but the value's presence too)
			base = f.required ? z.string().min(1) : z.string();
	}
	if (f.description || f.label) base = base.describe(f.description || f.label);
	return f.required ? base : base.optional();
}

/**
 * Builds a Zod schema from entity_fields definitions to validate MCP tool tools/call arguments.
 * create: required fields stay required. update: all fields become optional to support partial updates.
 * Unknown keys are an error (to make an LLM self-correct typos — record.data values themselves
 * can still be stored loosely as before, but input coming through MCP tools is strictly rejected
 * by this schema).
 */
export function buildEntityDataSchema(fields: FieldDef[], mode: 'create' | 'update') {
	const shape: Record<string, z.ZodTypeAny> = {};
	for (const f of fields) {
		const schema = fieldToZod(f);
		shape[f.key] = mode === 'update' ? schema.optional() : schema;
	}
	return z.object(shape).strict();
}

/**
 * Builds a Zod schema from entity_fields definitions describing an MCP tool's tools/call result
 * (outputSchema). Unlike buildEntityDataSchema (for input validation), this describes the actual
 * data of an existing record, so every field is made optional (data can be missing) and
 * .passthrough() is used instead of .strict() (to allow additional properties, since old keys
 * removed from the field definitions may still remain in the actual data).
 */
export function buildRecordOutputSchema(fields: FieldDef[]) {
	const dataShape = buildEntityDataSchema(fields, 'update').shape;
	return z
		.object({
			id: z.string(),
			...dataShape,
			createdAt: z.number().nullable(),
			updatedAt: z.number().nullable(),
			createdBy: z.string().nullable(),
			updatedBy: z.string().nullable()
		})
		.passthrough();
}

/**
 * Converts to a plain JSON Schema to pass as tools/list's inputSchema/outputSchema (the $schema
 * field is stripped). MCP's Tool.inputSchema/outputSchema is itself a JSON Schema object (spec:
 * https://modelcontextprotocol.io/specification/2025-06-18/server/tools), so the conversion
 * itself is an MCP-derived requirement. However, as a Zod-side behavior, z.toJSONSchema() emits
 * additionalProperties:false by default regardless of whether .strict() was used (a Zod-core
 * behavior, unrelated to MCP). buildRecordOutputSchema's explicit .passthrough() is a workaround
 * for this Zod behavior.
 */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
	return rest;
}
