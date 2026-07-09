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
			runWorkflowNow(db, wf.id, env, { event, recordId, entityTypeId, data }).catch(() => {
				// 1件のワークフロー実行失敗（例: 実行直前に削除された）で Promise.all 全体を
				// reject させない。reject すると worker.ts の queue ハンドラが ack せず、
				// メッセージが再配信されて同バッチ内の他の（既に成功した）ワークフローまで
				// 再実行され、通知やレコード操作が重複してしまうため。個々の失敗は
				// executeWorkflow 内で workflow_runs に記録済み。
			})
		)
	);
}
