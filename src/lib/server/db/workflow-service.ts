import { desc, asc, eq, or, isNull } from 'drizzle-orm';
import { workflows } from './schema';
import type { Db } from '.';
import type { WorkflowStep } from '$lib/types/chat';

export type WorkflowRow = {
	id: string;
	name: string;
	steps: WorkflowStep[];
	triggerHour: number;
	triggerMinute: number;
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
		steps: JSON.parse(r.steps) as WorkflowStep[],
		triggerHour: r.triggerHour,
		triggerMinute: r.triggerMinute,
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
		steps: WorkflowStep[];
		triggerHour: number;
		triggerMinute: number;
		accountId?: string;
		appId?: string;
	}
): Promise<WorkflowRow> {
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(workflows).values({
		id,
		name: input.name,
		steps: JSON.stringify(input.steps),
		triggerHour: input.triggerHour,
		triggerMinute: input.triggerMinute,
		enabled: false,
		accountId: input.accountId ?? null,
		appId: input.appId ?? null,
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
		.orderBy(asc(workflows.createdAt));
	return rows.map(toRow);
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
	input: { name: string; steps: WorkflowStep[]; triggerHour: number; triggerMinute: number; enabled?: boolean }
): Promise<WorkflowRow> {
	await db
		.update(workflows)
		.set({
			name: input.name,
			steps: JSON.stringify(input.steps),
			triggerHour: input.triggerHour,
			triggerMinute: input.triggerMinute,
			...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
			updatedAt: new Date()
		})
		.where(eq(workflows.id, id));
	const [row] = await db.select().from(workflows).where(eq(workflows.id, id));
	return toRow(row);
}

export async function deleteWorkflow(db: Db, id: string): Promise<void> {
	await db.delete(workflows).where(eq(workflows.id, id));
}

function stepsReferenceEntityType(steps: WorkflowStep[], entityTypeId: string): boolean {
	for (const step of steps) {
		if (step.kind === 'action') {
			if (step.tool === 'get_entities' && step.params?.entity_type_id === entityTypeId) return true;
		} else if (step.kind === 'condition') {
			if (stepsReferenceEntityType(step.then, entityTypeId)) return true;
		} else {
			if (stepsReferenceEntityType(step.body, entityTypeId)) return true;
		}
	}
	return false;
}

/** カスタムテーブル削除前のチェック用: このentity_type_idを `get_entities` ステップで参照しているワークフローを探す。 */
export async function findWorkflowsUsingEntityType(
	db: Db,
	entityTypeId: string
): Promise<{ id: string; name: string }[]> {
	const all = await listWorkflows(db);
	return all.filter((w) => stepsReferenceEntityType(w.steps, entityTypeId)).map((w) => ({ id: w.id, name: w.name }));
}
