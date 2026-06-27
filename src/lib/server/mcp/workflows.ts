import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import type { ToolEnv } from './shared';
import { createWorkflow, updateWorkflow, listWorkflows, listWorkflowsByAppId, getWorkflow, type WorkflowRow } from '../db/workflow-service';
import { listEntityTypesForWorkflow } from '../db/table-service';
import { listSlackIntegrationsForWorkflow } from '../slack';
import { validateWorkflow } from '$lib/workflow-validation';
import type { WorkflowStep } from '$lib/types/chat';

const workflowStepSchema: z.ZodType<WorkflowStep> = z.lazy(() =>
	z.union([
		z.object({
			id: z.string(),
			kind: z.literal('action'),
			label: z.string(),
			tool: z.string(),
			params: z.record(z.string(), z.string()).optional()
		}),
		z.object({
			id: z.string(),
			kind: z.literal('condition'),
			label: z.string(),
			left: z.string(),
			operator: z.enum(['==', '!=', '>', '<', '>=', '<=']),
			right: z.string(),
			then: z.array(workflowStepSchema)
		})
	])
);

const saveWorkflowInputSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	triggerHour: z.number().int().min(0).max(23),
	triggerMinute: z.number().int().min(0).max(59),
	steps: z.array(workflowStepSchema)
});

export const tools: Tool[] = [
	{
		name: 'save_workflow',
		description:
			'ワークフロー定義をDBに保存する。提案した workflow コンポーネントの内容をそのまま保存する場合に使う（ユーザーがUIで編集した後の保存は「保存」ボタンで行われるため、AIがこのツールを呼ぶ必要はない）。既存ワークフローを編集した場合は、get_workflowで取得したidを必ず指定する（idを省略すると新規作成になり、重複してしまう）。保存後は /workflows で確認・管理できる（新規作成時は実行には別途有効化が必要）。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '既存ワークフローを更新する場合のID（get_workflowで取得した値）。新規作成時は指定しない' },
				name: { type: 'string', description: 'ワークフロー名' },
				triggerHour: { type: 'number', description: '実行時刻（時、0-23、JST）' },
				triggerMinute: { type: 'number', description: '実行時刻（分、0-59、JST）' },
				steps: {
					type: 'array',
					description: 'ステップの配列（action または condition）'
				}
			},
			required: ['name', 'triggerHour', 'triggerMinute', 'steps']
		}
	},
	{
		name: 'list_workflows',
		description:
			'保存済みのワークフロー一覧を取得する。「どんなワークフローが設定されているか」「定期実行の設定を確認したい」などに使う。',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'get_workflow',
		description:
			'既存のワークフローを名前またはIDで1件取得する。「〇〇ワークフローを編集して」「〇〇の設定を直して」など既存ワークフローの確認・編集依頼があった場合に使う。取得した内容は workflow コンポーネント（同じidを指定）で表示し、ユーザーの指示に応じて更新後の構成を提案する。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ワークフローのID（分かっている場合）' },
				name: { type: 'string', description: 'ワークフロー名（部分一致）。idが分からない場合に使う' }
			},
			required: []
		}
	}
];

export async function handleSaveWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, triggerHour, triggerMinute, steps } = saveWorkflowInputSchema.parse(input);
	const [entityTypes, slackIntegrations] = await Promise.all([
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	const validation = validateWorkflow(triggerHour, triggerMinute, steps, entityTypes, slackIntegrations);
	if (!validation.ok) {
		throw new Error(`ワークフローの内容に問題があります: ${validation.errors.join(' / ')}`);
	}

	if (id) {
		const existing = await getWorkflow(db, id);
		if (!existing) throw new Error(`ワークフローが見つかりません（id: ${id}）`);
		if (existing.accountId && existing.accountId !== env?.accountId) {
			throw new Error('このワークフローを更新する権限がありません。');
		}
		const workflow = await updateWorkflow(db, id, { name, steps, triggerHour, triggerMinute });
		return {
			id: workflow.id,
			name: workflow.name,
			stepCount: workflow.steps.length,
			message: `ワークフロー「${workflow.name}」を更新しました（ステップ${workflow.steps.length}件）。`
		};
	}

	const workflow = await createWorkflow(db, {
		name,
		steps,
		triggerHour,
		triggerMinute,
		accountId: env?.accountId,
		appId: env?.appId
	});
	return {
		id: workflow.id,
		name: workflow.name,
		stepCount: workflow.steps.length,
		message: `ワークフロー「${workflow.name}」を保存しました（ステップ${workflow.steps.length}件）。/workflows から有効化すると実行されます。`
	};
}

export async function handleListWorkflows(db: Db, env?: ToolEnv) {
	const rows = env?.appId
		? await listWorkflowsByAppId(db, env.appId)
		: await listWorkflows(db, env?.accountId);
	if (rows.length === 0) {
		return { workflows: [], message: '保存済みのワークフローはありません。' };
	}
	return {
		workflows: rows.map((r) => ({
			id: r.id,
			name: r.name,
			stepCount: r.steps.length,
			trigger: `${String(r.triggerHour).padStart(2, '0')}:${String(r.triggerMinute).padStart(2, '0')}`,
			enabled: r.enabled,
			createdAt: r.createdAt.toISOString()
		}))
	};
}

const getWorkflowInputSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional()
});

function toGetWorkflowResult(row: WorkflowRow) {
	return {
		id: row.id,
		name: row.name,
		triggerHour: row.triggerHour,
		triggerMinute: row.triggerMinute,
		steps: row.steps,
		enabled: row.enabled
	};
}

export async function handleGetWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name } = getWorkflowInputSchema.parse(input);
	if (!id && !name) throw new Error('id または name のいずれかを指定してください。');

	if (id) {
		const row = await getWorkflow(db, id);
		if (!row) throw new Error(`ワークフローが見つかりません（id: ${id}）`);
		if (row.accountId && row.accountId !== env?.accountId) {
			throw new Error(`ワークフローが見つかりません（id: ${id}）`);
		}
		return toGetWorkflowResult(row);
	}

	const rows = await listWorkflows(db, env?.accountId);
	const matches = rows.filter((r) => r.name.includes(name!));
	if (matches.length === 0) {
		throw new Error(`「${name}」に一致するワークフローが見つかりません。`);
	}
	if (matches.length > 1) {
		return {
			ambiguous: true,
			message: `「${name}」に一致するワークフローが複数あります。どれを編集するか確認してください。`,
			candidates: matches.map((r) => ({ id: r.id, name: r.name }))
		};
	}
	return toGetWorkflowResult(matches[0]);
}
