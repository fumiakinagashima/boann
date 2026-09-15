import type { Db } from '../db';
import type { ToolEnv } from '../tools/shared';
import { listEnabledEventWorkflows } from '../db/workflow-service';
import { runWorkflowNow, type TriggerEvent } from './run';

export type WorkflowEventMessage = {
	type: 'workflow-event';
	entityTypeId: string;
	event: TriggerEvent;
	recordId: string;
	/** Snapshot of the triggering record's field values (as of send time). Used to resolve @trigger:<field>. */
	data?: Record<string, unknown>;
};

export async function dispatchWorkflowEvents(
	db: Db,
	entityTypeId: string,
	event: TriggerEvent,
	recordId: string,
	data?: Record<string, unknown>,
	env?: ToolEnv
): Promise<void> {
	const workflows = await listEnabledEventWorkflows(db, entityTypeId, event);
	await Promise.all(
		workflows.map((wf) =>
			runWorkflowNow(db, wf.id, env, { event, recordId, entityTypeId, data }).catch(() => {
				// Don't let a single workflow run failure (e.g. deleted right before execution) reject
				// the whole Promise.all. If it rejects, the queue handler in worker.ts won't ack, and the
				// message gets redelivered, causing other (already-succeeded) workflows in the same batch
				// to run again too, duplicating notifications and record operations. Individual failures
				// are already recorded in workflow_runs inside executeWorkflow.
			})
		)
	);
}
