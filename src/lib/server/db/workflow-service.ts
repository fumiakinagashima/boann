import { asc, eq, or, isNull, desc, and } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { workflows, workflowRuns } from './schema';
import type { Db } from '.';
import type { WorkflowStep } from '$lib/types/chat';
import type { FieldDef } from './table-service';

export type WorkflowRow = {
	id: string;
	name: string;
	description: string | null;
	steps: WorkflowStep[];
	inputSchema: FieldDef[];
	triggerType: 'schedule' | 'event' | 'mcp_tool';
	triggerHour: number;
	triggerMinute: number;
	triggerEvent: 'create' | 'update' | 'delete' | null;
	triggerEntityTypeId: string | null;
	enabled: boolean;
	accountId: string | null;
	appId: string | null;
	createdAt: Date;
	updatedAt: Date;
};

function toRow(r: typeof workflows.$inferSelect): WorkflowRow {
	return {
		id: r.id,
		name: r.name,
		description: r.description ?? null,
		steps: JSON.parse(r.steps) as WorkflowStep[],
		inputSchema: JSON.parse(r.inputSchema) as FieldDef[],
		triggerType: (r.triggerType ?? 'schedule') as 'schedule' | 'event' | 'mcp_tool',
		triggerHour: r.triggerHour,
		triggerMinute: r.triggerMinute,
		triggerEvent: (r.triggerEvent ?? null) as 'create' | 'update' | 'delete' | null,
		triggerEntityTypeId: r.triggerEntityTypeId ?? null,
		enabled: r.enabled,
		accountId: r.accountId,
		appId: r.appId ?? null,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt
	};
}

export async function createWorkflow(
	db: Db,
	input: {
		name: string;
		description?: string | null;
		steps: WorkflowStep[];
		inputSchema?: FieldDef[];
		triggerType?: 'schedule' | 'event' | 'mcp_tool';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		accountId?: string;
		appId?: string;
	}
): Promise<WorkflowRow> {
	const id = crypto.randomUUID();
	const now = new Date();
	// Appended to the end within the app
	const appId = input.appId ?? null;
	const [maxRow] = await db
		.select({ s: workflows.sortOrder })
		.from(workflows)
		.where(appId === null ? isNull(workflows.appId) : eq(workflows.appId, appId))
		.orderBy(desc(workflows.sortOrder))
		.limit(1);
	const sortOrder = (maxRow?.s ?? -1) + 1;
	await db.insert(workflows).values({
		id,
		name: input.name,
		description: input.description ?? null,
		steps: JSON.stringify(input.steps),
		inputSchema: JSON.stringify(input.inputSchema ?? []),
		triggerType: input.triggerType ?? 'mcp_tool',
		triggerHour: input.triggerHour,
		triggerMinute: input.triggerMinute,
		triggerEvent: input.triggerEvent ?? null,
		triggerEntityTypeId: input.triggerEntityTypeId ?? null,
		enabled: false,
		accountId: input.accountId ?? null,
		appId,
		sortOrder,
		createdAt: now,
		updatedAt: now
	});
	const [row] = await db.select().from(workflows).where(eq(workflows.id, id));
	return toRow(row);
}

export async function listWorkflows(db: Db, accountId?: string): Promise<WorkflowRow[]> {
	const rows = accountId
		? await db
				.select()
				.from(workflows)
				.where(or(eq(workflows.accountId, accountId), isNull(workflows.accountId)))
				.orderBy(desc(workflows.createdAt))
		: await db.select().from(workflows).orderBy(desc(workflows.createdAt));
	return rows.map(toRow);
}

export async function listWorkflowsByAppId(db: Db, appId: string): Promise<WorkflowRow[]> {
	const rows = await db
		.select()
		.from(workflows)
		.where(eq(workflows.appId, appId))
		.orderBy(asc(workflows.sortOrder));
	return rows.map(toRow);
}

// App settings' workflow tab: reflects the drag-and-drop order into sortOrder.
export async function reorderWorkflows(db: Db, appId: string, orderedIds: string[]): Promise<void> {
	if (orderedIds.length === 0) return;
	const queries: BatchItem<'sqlite'>[] = orderedIds.map((id, i) =>
		db.update(workflows).set({ sortOrder: i }).where(eq(workflows.id, id))
	);
	await db.batch(queries as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
}

export async function getWorkflow(db: Db, id: string): Promise<WorkflowRow | null> {
	const [row] = await db.select().from(workflows).where(eq(workflows.id, id));
	return row ? toRow(row) : null;
}

export async function getEnabledWorkflows(db: Db): Promise<WorkflowRow[]> {
	const rows = await db.select().from(workflows).where(eq(workflows.enabled, true));
	return rows.map(toRow);
}

export async function updateWorkflow(
	db: Db,
	id: string,
	input: {
		name: string;
		description?: string | null;
		steps: WorkflowStep[];
		inputSchema?: FieldDef[];
		triggerType?: 'schedule' | 'event' | 'mcp_tool';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		enabled?: boolean;
	}
): Promise<WorkflowRow> {
	await db
		.update(workflows)
		.set({
			name: input.name,
			description: input.description ?? null,
			steps: JSON.stringify(input.steps),
			inputSchema: JSON.stringify(input.inputSchema ?? []),
			triggerType: input.triggerType ?? 'schedule',
			triggerHour: input.triggerHour,
			triggerMinute: input.triggerMinute,
			triggerEvent: input.triggerEvent ?? null,
			triggerEntityTypeId: input.triggerEntityTypeId ?? null,
			...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
			updatedAt: new Date()
		})
		.where(eq(workflows.id, id));
	const [row] = await db.select().from(workflows).where(eq(workflows.id, id));
	return toRow(row);
}

export async function listEnabledEventWorkflows(
	db: Db,
	entityTypeId: string,
	event: 'create' | 'update' | 'delete'
): Promise<WorkflowRow[]> {
	const rows = await db.select().from(workflows).where(
		and(
			eq(workflows.enabled, true),
			eq(workflows.triggerType, 'event'),
			eq(workflows.triggerEntityTypeId, entityTypeId),
			eq(workflows.triggerEvent, event)
		)
	);
	return rows.map(toRow);
}

export async function deleteWorkflow(db: Db, id: string): Promise<void> {
	await db.batch([
		db.delete(workflowRuns).where(eq(workflowRuns.workflowId, id)),
		db.delete(workflows).where(eq(workflows.id, id))
	]);
}

function stepsReferenceEntityType(steps: WorkflowStep[], entityTypeId: string): boolean {
	for (const step of steps) {
		if (step.kind === 'action') {
			if (step.tool === 'get_entities' && step.params?.entity_type_id === entityTypeId) return true;
		} else if (step.kind === 'condition') {
			if (stepsReferenceEntityType(step.then, entityTypeId)) return true;
		} else if (step.kind === 'foreach') {
			if (stepsReferenceEntityType(step.body, entityTypeId)) return true;
		}
	}
	return false;
}

/** For checking before deleting a custom table: finds workflows that reference this entity_type_id in a `get_entities` step. */
export async function findWorkflowsUsingEntityType(
	db: Db,
	entityTypeId: string
): Promise<{ id: string; name: string }[]> {
	const all = await listWorkflows(db);
	return all.filter((w) => stepsReferenceEntityType(w.steps, entityTypeId)).map((w) => ({ id: w.id, name: w.name }));
}
