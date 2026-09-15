import { z } from 'zod';
import type { Db } from '../db';
import {
	getTablesByAppId,
	getTableInfo,
	listRecordsByEntityTypeId,
	createRecordByEntityTypeId,
	updateRecordByEntityTypeId,
	deleteRecord,
	getRecord,
	getRecordOwnerEntityTypeId,
	type TableInfo
} from '../db/table-service';
import { buildEntityDataSchema, buildRecordOutputSchema, toJsonSchema } from './field-schema';
import { listWorkflowsByAppId, type WorkflowRow } from '../db/workflow-service';
import { runWorkflowNow } from '../workflow/run';
import type { ToolEnv } from '../tools/shared';
import { RECORD_VIEW_URI } from './ui-resources';

// The field names themselves (readOnlyHint and the other 3) are vocabulary defined by the
// MCP spec's Tool Annotations — Boann did not name them. Deciding which value goes on which
// tool is Boann's own design.
// Spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools#annotations
export type McpToolAnnotations = {
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
};

// The McpTool type itself mirrors the shape of an MCP tools/list result (a Tool object).
// Only the _meta.ui key is an extension from MCP Apps (SEP-1865, see the comment in
// ui-resources.ts) — a field that doesn't exist in the plain MCP spec.
export type McpTool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	outputSchema?: Record<string, unknown>;
	annotations?: McpToolAnnotations;
	_meta?: { ui: { resourceUri: string; visibility?: ('model' | 'app')[] } };
};

// The values themselves are Boann's own judgment call (the spec only defines the
// vocabulary, not how values get assigned).
// Annotations for the table CRUD tools. Uniformly openWorldHint:false since these only
// operate on closed-world data within the app.
const READ_ANNOTATIONS: McpToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const CREATE_ANNOTATIONS: McpToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const UPDATE_ANNOTATIONS: McpToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DELETE_ANNOTATIONS: McpToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
// Workflows can perform arbitrary operations within their steps (external API calls,
// deletes, etc.), so default to conservative annotations.
const WORKFLOW_ANNOTATIONS: McpToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

/** Shared MCP Apps template for rendering list_<table>/get_<table> results as a table/detail view in the chat. */
const RECORD_VIEW_META = { ui: { resourceUri: RECORD_VIEW_URI } };
export type McpToolResult = {
	content: { type: 'text'; text: string }[];
	structuredContent?: unknown;
	isError?: true;
};

const LIST_ARGS_SCHEMA = z.object({ limit: z.number().int().positive().max(200).optional() });
const ID_ARGS_SCHEMA = z.object({ id: z.string().min(1) });

async function getAppTablesWithFields(db: Db, appId: string): Promise<TableInfo[]> {
	const cards = await getTablesByAppId(db, appId);
	const tables = await Promise.all(cards.map((c) => getTableInfo(db, c.name, appId)));
	return tables.filter((t): t is TableInfo => !!t);
}

/**
 * Returns the workflows callable as MCP tools (triggerType: 'mcp_tool' and enabled).
 * workflow.name is unique within the app but has no alphanumeric restriction, so it can't
 * be used directly as a tool name (there's no slug like entity_types.name has). Instead we
 * use the first 8 hex characters of the id (the collision probability is negligible).
 */
async function getAppWorkflowTools(db: Db, appId: string): Promise<WorkflowRow[]> {
	const rows = await listWorkflowsByAppId(db, appId);
	return rows.filter((w) => w.triggerType === 'mcp_tool' && w.enabled);
}

const WORKFLOW_TOOL_RE = /^run_workflow_([a-f0-9]{8})$/;

export async function listAppMcpTools(db: Db, appId: string): Promise<McpTool[]> {
	const tables = await getAppTablesWithFields(db, appId);
	const workflows = await getAppWorkflowTools(db, appId);
	const workflowTools: McpTool[] = workflows.map((w) => ({
		name: `run_workflow_${w.id.slice(0, 8)}`,
		description: w.description?.trim() || `Runs the workflow "${w.name}".`,
		inputSchema: toJsonSchema(buildEntityDataSchema(w.inputSchema, 'create')),
		// result is an arbitrary set of key/value pairs assembled by the set_result action
		// (an empty object for workflows that don't use it).
		outputSchema: toJsonSchema(z.object({ ok: z.boolean(), name: z.string(), result: z.record(z.string(), z.unknown()) })),
		annotations: WORKFLOW_ANNOTATIONS
	}));
	const tableTools = tables.flatMap((t) => [
		...(t.mcpRead ? [{
			name: `list_${t.id}`,
			description: `Fetches a list of records from ${t.label}.`,
			inputSchema: toJsonSchema(LIST_ARGS_SCHEMA),
			// structuredContent must be an object per the MCP spec (an array is rejected by
			// some clients' validation — confirmed in practice: a Pydantic-based client raised
			// a "structuredContent Input should be a valid dictionary" error).
			// Spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
			// (structuredContent: `{ [key: string]: unknown }`. Arrays are not an allowed type.)
			outputSchema: toJsonSchema(z.object({ records: z.array(buildRecordOutputSchema(t.fields)) })),
			annotations: READ_ANNOTATIONS,
			_meta: RECORD_VIEW_META
		}, {
			name: `get_${t.id}`,
			description: `Fetches a single record from ${t.label}.`,
			inputSchema: toJsonSchema(ID_ARGS_SCHEMA),
			outputSchema: toJsonSchema(buildRecordOutputSchema(t.fields)),
			annotations: READ_ANNOTATIONS,
			_meta: RECORD_VIEW_META
		}] : []),
		...(t.mcpCreate ? [{
			name: `create_${t.id}`,
			description: `Creates a record in ${t.label}.`,
			inputSchema: toJsonSchema(buildEntityDataSchema(t.fields, 'create')),
			outputSchema: toJsonSchema(buildRecordOutputSchema(t.fields)),
			annotations: CREATE_ANNOTATIONS
		}] : []),
		...(t.mcpUpdate ? [{
			name: `update_${t.id}`,
			description: `Updates a record in ${t.label} (only the given fields are merged into the existing data).`,
			inputSchema: toJsonSchema(z.object({ id: z.string().min(1) }).extend(buildEntityDataSchema(t.fields, 'update').shape)),
			outputSchema: toJsonSchema(buildRecordOutputSchema(t.fields)),
			annotations: UPDATE_ANNOTATIONS
		}] : []),
		...(t.mcpDelete ? [{
			name: `delete_${t.id}`,
			description: `Deletes a record from ${t.label}.`,
			inputSchema: toJsonSchema(ID_ARGS_SCHEMA),
			outputSchema: toJsonSchema(z.object({ deleted: z.boolean(), id: z.string() })),
			annotations: DELETE_ANNOTATIONS
		}] : [])
	]);
	return [...tableTools, ...workflowTools];
}

function toolOk(data: unknown): McpToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

function toolError(message: string): McpToolResult {
	return { content: [{ type: 'text', text: message }], isError: true };
}

function formatZodError(e: z.ZodError): string {
	return e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

const TOOL_NAME_RE = /^(list|get|create|update|delete)_(.+)$/;

/**
 * Verifies that a record actually belongs to this table. Since get/update/delete can
 * operate on a record by id alone using the existing table-service.ts implementation as-is,
 * this layer — which crosses the new trust boundary introduced by external tokens — must
 * always verify table ownership before proceeding to the actual operation (this prevents
 * accidentally reading, writing, or deleting a record when handed a record id belonging to
 * a different app or table).
 */
async function assertOwnedByTable(db: Db, table: TableInfo, id: string): Promise<boolean> {
	return (await getRecordOwnerEntityTypeId(db, id)) === table.entityTypeId;
}

async function callWorkflowMcpTool(
	db: Db,
	appId: string,
	toolName: string,
	rawArgs: unknown,
	env?: ToolEnv
): Promise<McpToolResult | null> {
	const m = WORKFLOW_TOOL_RE.exec(toolName);
	if (!m) return null;
	const [, idPrefix] = m;

	const workflows = await getAppWorkflowTools(db, appId);
	const workflow = workflows.find((w) => w.id.startsWith(idPrefix));
	if (!workflow) return toolError(`Unknown tool: ${toolName}`);

	const parsed = buildEntityDataSchema(workflow.inputSchema, 'create').safeParse(rawArgs);
	if (!parsed.success) return toolError(formatZodError(parsed.error));

	const result = await runWorkflowNow(db, workflow.id, env, undefined, parsed.data);
	if (!result.ok) return toolError(result.error ?? 'Execution failed');
	return toolOk({ ok: true, name: result.name, result: result.result });
}

// TODO: persist a call log for all tool invocations, including table CRUD (2026-07-21,
// requested by the user). Currently workflow_runs only records run_workflow_* calls. This
// is the likely place to add a logging hook.
export async function callAppMcpTool(
	db: Db,
	appId: string,
	toolName: string,
	rawArgs: unknown,
	env?: ToolEnv
): Promise<McpToolResult> {
	const workflowResult = await callWorkflowMcpTool(db, appId, toolName, rawArgs, env);
	if (workflowResult) return workflowResult;

	const m = TOOL_NAME_RE.exec(toolName);
	if (!m) return toolError(`Unknown tool: ${toolName}`);
	const [, action, tableId] = m;

	const tables = await getAppTablesWithFields(db, appId);
	const table = tables.find((t) => t.id === tableId);
	if (!table) return toolError(`Unknown table: ${tableId}`);

	const NOT_FOUND = 'Record not found';

	switch (action) {
		case 'list': {
			if (!table.mcpRead) return toolError(`Unknown tool: ${toolName}`);
			const parsed = LIST_ARGS_SCHEMA.safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			return toolOk({ records: await listRecordsByEntityTypeId(db, table.entityTypeId, parsed.data.limit ?? 50) });
		}
		case 'get': {
			if (!table.mcpRead) return toolError(`Unknown tool: ${toolName}`);
			const parsed = ID_ARGS_SCHEMA.safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			if (!(await assertOwnedByTable(db, table, parsed.data.id))) return toolError(NOT_FOUND);
			return toolOk(await getRecord(db, table.id, parsed.data.id));
		}
		case 'create': {
			if (!table.mcpCreate) return toolError(`Unknown tool: ${toolName}`);
			const parsed = buildEntityDataSchema(table.fields, 'create').safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			return toolOk(await createRecordByEntityTypeId(db, table.entityTypeId, parsed.data));
		}
		case 'update': {
			if (!table.mcpUpdate) return toolError(`Unknown tool: ${toolName}`);
			const idParsed = ID_ARGS_SCHEMA.safeParse(rawArgs);
			if (!idParsed.success) return toolError(formatZodError(idParsed.error));
			const { id, ...rest } = (rawArgs as Record<string, unknown>) ?? {};
			const dataParsed = buildEntityDataSchema(table.fields, 'update').safeParse(rest);
			if (!dataParsed.success) return toolError(formatZodError(dataParsed.error));
			if (!(await assertOwnedByTable(db, table, idParsed.data.id))) return toolError(NOT_FOUND);
			// updateRecordByEntityTypeId overwrites the entire data column with the fields
			// passed in, rather than merging with existing data (this differs from the
			// internal AI tool's handleUpdateEntity), so we merge explicitly here.
			const existing = await getRecord(db, table.id, idParsed.data.id);
			return toolOk(
				await updateRecordByEntityTypeId(db, table.entityTypeId, idParsed.data.id, { ...existing, ...dataParsed.data })
			);
		}
		case 'delete': {
			if (!table.mcpDelete) return toolError(`Unknown tool: ${toolName}`);
			const parsed = ID_ARGS_SCHEMA.safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			if (!(await assertOwnedByTable(db, table, parsed.data.id))) return toolError(NOT_FOUND);
			await deleteRecord(db, table.id, parsed.data.id);
			return toolOk({ deleted: true, id: parsed.data.id });
		}
		default:
			return toolError(`Unknown tool: ${toolName}`);
	}
}
