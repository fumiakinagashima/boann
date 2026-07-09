import type { Db } from '../db';
import type { ToolEnv } from '../mcp/shared';
import { listEnabledEventWorkflows } from '../db/workflow-service';
import { runWorkflowNow, type TriggerEvent } from './run';

export type WorkflowEventMessage = {
	type: 'workflow-event';
	entityTypeId: string;
	event: TriggerEvent;
	recordId: string;
	/** トリガーとなったレコードのフィールド値スナップショット（送信時点のもの）。@trigger:<field> の解決に使う。 */
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
			runWorkflowNow(db, wf.id, env, { event, recordId, entityTypeId, data })
		)
	);
}
