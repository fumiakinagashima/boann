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
	/** Set only when attempted two or more times (omitted if it succeeded/failed on the first try). */
	attempts?: number;
	/** True if it ultimately failed but execution continued due to continueOnError. */
	continued?: boolean;
};

export type WorkflowRunRow = {
	id: string;
	workflowId: string;
	ok: boolean;
	error: string | null;
	log: StepLog[] | null;
	/** Result object built by the set_result action. Null for workflows that don't use it. */
	result: Record<string, unknown> | null;
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
		result: r.result ? (JSON.parse(r.result) as Record<string, unknown>) : null,
		startedAt: r.startedAt,
		finishedAt: r.finishedAt
	};
}

export async function recordWorkflowRun(
	db: Db,
	input: {
		workflowId: string;
		ok: boolean;
		error?: string | null;
		log?: StepLog[];
		result?: Record<string, unknown>;
		startedAt: Date;
		finishedAt: Date;
	}
): Promise<void> {
	await db.insert(workflowRuns).values({
		id: crypto.randomUUID(),
		workflowId: input.workflowId,
		ok: input.ok,
		error: input.error ?? null,
		log: input.log ? JSON.stringify(input.log) : null,
		result: input.result && Object.keys(input.result).length > 0 ? JSON.stringify(input.result) : null,
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
