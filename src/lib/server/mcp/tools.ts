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
import { buildEntityDataSchema, toJsonSchema } from './field-schema';

export type McpTool = { name: string; description: string; inputSchema: Record<string, unknown> };
export type McpToolResult = { content: { type: 'text'; text: string }[]; isError?: true };

const LIST_ARGS_SCHEMA = z.object({ limit: z.number().int().positive().max(200).optional() });
const ID_ARGS_SCHEMA = z.object({ id: z.string().min(1) });

async function getAppTablesWithFields(db: Db, appId: string): Promise<TableInfo[]> {
	const cards = await getTablesByAppId(db, appId);
	const tables = await Promise.all(cards.map((c) => getTableInfo(db, c.name, appId)));
	return tables.filter((t): t is TableInfo => !!t);
}

export async function listAppMcpTools(db: Db, appId: string): Promise<McpTool[]> {
	const tables = await getAppTablesWithFields(db, appId);
	return tables.flatMap((t) => [
		{
			name: `list_${t.id}`,
			description: `${t.label}のレコード一覧を取得する。`,
			inputSchema: toJsonSchema(LIST_ARGS_SCHEMA)
		},
		{
			name: `get_${t.id}`,
			description: `${t.label}のレコードを1件取得する。`,
			inputSchema: toJsonSchema(ID_ARGS_SCHEMA)
		},
		{
			name: `create_${t.id}`,
			description: `${t.label}にレコードを登録する。`,
			inputSchema: toJsonSchema(buildEntityDataSchema(t.fields, 'create'))
		},
		{
			name: `update_${t.id}`,
			description: `${t.label}のレコードを更新する（指定したフィールドのみ既存データにマージ）。`,
			inputSchema: toJsonSchema(z.object({ id: z.string().min(1) }).extend(buildEntityDataSchema(t.fields, 'update').shape))
		},
		{
			name: `delete_${t.id}`,
			description: `${t.label}のレコードを削除する。`,
			inputSchema: toJsonSchema(ID_ARGS_SCHEMA)
		}
	]);
}

function toolOk(data: unknown): McpToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string): McpToolResult {
	return { content: [{ type: 'text', text: message }], isError: true };
}

function formatZodError(e: z.ZodError): string {
	return e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
}

const TOOL_NAME_RE = /^(list|get|create|update|delete)_(.+)$/;

/**
 * レコードが本当にこのテーブルに属するかを確認する。get/update/deleteはid単独で操作できてしまう
 * table-service.ts の既存実装をそのまま使うため、外部トークンという新しい信頼境界をまたぐこの層で
 * 必ずテーブル所有権を検証してから実処理に入る（他アプリ・他テーブルのレコードIDを渡された場合に
 * 誤って読み書き・削除してしまうのを防ぐ）。
 */
async function assertOwnedByTable(db: Db, table: TableInfo, id: string): Promise<boolean> {
	return (await getRecordOwnerEntityTypeId(db, id)) === table.entityTypeId;
}

export async function callAppMcpTool(
	db: Db,
	appId: string,
	toolName: string,
	rawArgs: unknown
): Promise<McpToolResult> {
	const m = TOOL_NAME_RE.exec(toolName);
	if (!m) return toolError(`Unknown tool: ${toolName}`);
	const [, action, tableId] = m;

	const tables = await getAppTablesWithFields(db, appId);
	const table = tables.find((t) => t.id === tableId);
	if (!table) return toolError(`Unknown table: ${tableId}`);

	const NOT_FOUND = 'レコードが見つかりません';

	switch (action) {
		case 'list': {
			const parsed = LIST_ARGS_SCHEMA.safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			return toolOk(await listRecordsByEntityTypeId(db, table.entityTypeId, parsed.data.limit ?? 50));
		}
		case 'get': {
			const parsed = ID_ARGS_SCHEMA.safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			if (!(await assertOwnedByTable(db, table, parsed.data.id))) return toolError(NOT_FOUND);
			return toolOk(await getRecord(db, table.id, parsed.data.id));
		}
		case 'create': {
			const parsed = buildEntityDataSchema(table.fields, 'create').safeParse(rawArgs);
			if (!parsed.success) return toolError(formatZodError(parsed.error));
			return toolOk(await createRecordByEntityTypeId(db, table.entityTypeId, parsed.data));
		}
		case 'update': {
			const idParsed = ID_ARGS_SCHEMA.safeParse(rawArgs);
			if (!idParsed.success) return toolError(formatZodError(idParsed.error));
			const { id, ...rest } = (rawArgs as Record<string, unknown>) ?? {};
			const dataParsed = buildEntityDataSchema(table.fields, 'update').safeParse(rest);
			if (!dataParsed.success) return toolError(formatZodError(dataParsed.error));
			if (!(await assertOwnedByTable(db, table, idParsed.data.id))) return toolError(NOT_FOUND);
			// updateRecordByEntityTypeId は既存データとマージせず渡したフィールドで data 列を丸ごと
			// 上書きするため（内部AIツールの handleUpdateEntity とは異なる挙動）、ここで明示的にマージする。
			const existing = await getRecord(db, table.id, idParsed.data.id);
			return toolOk(
				await updateRecordByEntityTypeId(db, table.entityTypeId, idParsed.data.id, { ...existing, ...dataParsed.data })
			);
		}
		case 'delete': {
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
