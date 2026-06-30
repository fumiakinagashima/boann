import { desc, eq } from 'drizzle-orm';
import { workflowRuns } from './schema';
import type { Db } from '.';

export type StepLog = {
	id: string;
	label: string;
	ok: boolean;
	result?: string;
	error?: string;
	ms: number;
};

export type WorkflowRunRow = {
	id: string;
	workflowId: string;
	ok: boolean;
	error: string | null;
	log: StepLog[] | null;
	startedAt: Date;
	finishedAt: Date;
};

function toRow(r: typeof workflowRuns.$inferSelect): WorkflowRunRow {
	return {
		id: r.id,
		workflowId: r.workflowId,
		ok: r.ok,
		error: r.error,
		log: r.log ? (JSON.parse(r.log) as StepLog[]) : null,
		startedAt: r.startedAt,
		finishedAt: r.finishedAt
	};
}

export async function recordWorkflowRun(
	db: Db,
	input: { workflowId: string; ok: boolean; error?: string | null; log?: StepLog[]; startedAt: Date; finishedAt: Date }
): Promise<void> {
	await db.insert(workflowRuns).values({
		id: crypto.randomUUID(),
		workflowId: input.workflowId,
		ok: input.ok,
		error: input.error ?? null,
		log: input.log ? JSON.stringify(input.log) : null,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt
	});
}

export async function listWorkflowRuns(
	db: Db,
	workflowId: string,
	limit = 20
): Promise<WorkflowRunRow[]> {
	const rows = await db
		.select()
		.from(workflowRuns)
		.where(eq(workflowRuns.workflowId, workflowId))
		.orderBy(desc(workflowRuns.startedAt))
		.limit(limit);
	return rows.map(toRow);
}
