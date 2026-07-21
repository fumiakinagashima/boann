import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import type { ToolEnv } from './shared';
import { createWorkflow, updateWorkflow, listWorkflows, listWorkflowsByAppId, getWorkflow, type WorkflowRow } from '../db/workflow-service';
import { listEntityTypesForWorkflow, type FieldDef } from '../db/table-service';
import { listSlackIntegrationsForWorkflow } from '../slack';
import { validateWorkflow } from '$lib/workflow-validation';
import { runWorkflowNow } from '../workflow/run';
import { listWorkflowRuns } from '../db/workflow-run-service';
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

const workflowInputFieldSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z.string(),
	required: z.boolean().optional(),
	options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
	description: z.string().optional()
});

const saveWorkflowInputSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	triggerType: z.enum(['schedule', 'event', 'mcp_tool']).optional(),
	triggerHour: z.number().int().min(0).max(23),
	triggerMinute: z.number().int().min(0).max(59),
	triggerEvent: z.enum(['create', 'update', 'delete']).nullable().optional(),
	triggerEntityTypeId: z.string().nullable().optional(),
	inputSchema: z.array(workflowInputFieldSchema).optional(),
	steps: z.array(workflowStepSchema)
});

export const tools: Tool[] = [
	{
		name: 'save_workflow',
		description:
			'ワークフロー定義をDBに保存する。提案した workflow コンポーネントの内容をそのまま保存する場合に使う（ユーザーがUIで編集した後の保存は「保存」ボタンで行われるため、AIがこのツールを呼ぶ必要はない）。既存ワークフローを編集した場合は、get_workflowで取得したidを必ず指定する（idを省略すると新規作成になり、重複してしまう）。保存後はアプリのワークフロー一覧で確認・管理できる（新規作成時は実行には別途有効化が必要）。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '既存ワークフローを更新する場合のID（get_workflowで取得した値）。新規作成時は指定しない' },
				name: { type: 'string', description: 'ワークフロー名' },
				triggerType: { type: 'string', enum: ['schedule', 'event', 'mcp_tool'], description: 'トリガー種別。schedule=毎日指定時刻、event=レコード操作時、mcp_tool=外部MCPエージェントからの呼び出し時（スケジュール・イベントの設定は不要）。省略時はmcp_tool' },
				triggerHour: { type: 'number', description: '実行時刻（時、0-23、JST）。schedule時のみ有効' },
				triggerMinute: { type: 'number', description: '実行時刻（分、0-59、JST）。schedule時のみ有効' },
				triggerEvent: { type: 'string', enum: ['create', 'update', 'delete'], description: 'event時のみ。対象操作（create=作成、update=更新、delete=削除）' },
				triggerEntityTypeId: { type: 'string', description: 'event時のみ。監視するテーブルのentity_types.id（UUIDキー）' },
				inputSchema: {
					type: 'array',
					description: '宣言する入力パラメータの一覧（呼び出す側が渡す値）。各要素は{key, label, type, required, options, description}。ステップ内で@input:<key>として参照できる',
					items: {
						type: 'object',
						properties: {
							key: { type: 'string' },
							label: { type: 'string' },
							type: { type: 'string', enum: ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea'] },
							required: { type: 'boolean' },
							options: { type: 'array', items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } } },
							description: { type: 'string' }
						},
						required: ['key', 'label', 'type']
					}
				},
				steps: {
					type: 'array',
					description: 'ステップの配列（action または condition）。eventトリガーでは@trigger:idで操作されたレコードのID、@trigger:eventでイベント種別、@trigger:<フィールドキー>（例: @trigger:createdBy）でそのレコードの他のフィールド値を、条件の判定対象（先頭ステップの条件でも）を含め参照できる。@self:account_idはワークフロー登録者自身のアカウントIDを表し、@trigger:createdBy != @self:account_id のように「自分以外が操作したか」を判定できる。inputSchemaで宣言した入力パラメータは@input:<key>で参照できる'
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
	},
	{
		name: 'run_workflow',
		description:
			'指定したワークフローを今すぐ実行する。「〇〇ワークフローを実行して」「今すぐ動かして」などの依頼に使う。実行結果（成功/失敗・エラー内容）を返す。get_workflowのinputSchemaに入力パラメータがある場合はinputArgsで値を渡す。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '実行するワークフローのID（list_workflows または get_workflow で取得）' },
				inputArgs: { type: 'object', description: 'get_workflowのinputSchemaで宣言されている入力パラメータのkeyと値のペア（例: {"customer_name": "田中"}）。入力パラメータがないワークフローでは不要' }
			},
			required: ['id']
		}
	},
	{
		name: 'get_workflow_run_logs',
		description:
			'ワークフローの実行ログ（最近の実行履歴）を取得する。「最後に実行した結果は？」「エラーの詳細を見せて」などの依頼に使う。各ステップの成否も含む。',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: '対象ワークフローのID' },
				limit: { type: 'number', description: '取得する件数（デフォルト: 5）' }
			},
			required: ['id']
		}
	}
];

export async function handleSaveWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId, inputSchema, steps } = saveWorkflowInputSchema.parse(input);
	const [entityTypes, slackIntegrations] = await Promise.all([
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	const validation = validateWorkflow(triggerType ?? 'schedule', triggerHour, triggerMinute, triggerEntityTypeId, steps, entityTypes, slackIntegrations, inputSchema ?? []);
	if (!validation.ok) {
		throw new Error(`ワークフローの内容に問題があります: ${validation.errors.join(' / ')}`);
	}

	if (id) {
		const existing = await getWorkflow(db, id);
		if (!existing) throw new Error(`ワークフローが見つかりません（id: ${id}）`);
		if (existing.accountId && existing.accountId !== env?.accountId) {
			throw new Error('このワークフローを更新する権限がありません。');
		}
		const workflow = await updateWorkflow(db, id, { name, steps, inputSchema: inputSchema as FieldDef[] | undefined, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId });
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
		inputSchema: inputSchema as FieldDef[] | undefined,
		triggerType,
		triggerHour,
		triggerMinute,
		triggerEvent,
		triggerEntityTypeId,
		accountId: env?.accountId,
		appId: env?.appId
	});
	return {
		id: workflow.id,
		name: workflow.name,
		stepCount: workflow.steps.length,
		message: `ワークフロー「${workflow.name}」を保存しました（ステップ${workflow.steps.length}件）。アプリのワークフロー一覧から有効化すると実行されます。`
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
		triggerType: row.triggerType,
		triggerHour: row.triggerHour,
		triggerMinute: row.triggerMinute,
		triggerEvent: row.triggerEvent,
		triggerEntityTypeId: row.triggerEntityTypeId,
		inputSchema: row.inputSchema,
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

const runWorkflowInputSchema = z.object({
	id: z.string(),
	inputArgs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

export async function handleRunWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { id, inputArgs } = runWorkflowInputSchema.parse(input);
	const row = await getWorkflow(db, id);
	if (!row) throw new Error(`ワークフローが見つかりません（id: ${id}）`);
	const result = await runWorkflowNow(db, id, env, undefined, inputArgs);
	return {
		id: result.id,
		name: result.name,
		ok: result.ok,
		...(result.error ? { error: result.error } : {}),
		message: result.ok
			? `ワークフロー「${result.name}」を実行しました。`
			: `ワークフロー「${result.name}」の実行に失敗しました: ${result.error}`
	};
}

const getWorkflowRunLogsInputSchema = z.object({
	id: z.string(),
	limit: z.number().int().min(1).max(50).optional()
});

export async function handleGetWorkflowRunLogs(db: Db, input: unknown) {
	const { id, limit } = getWorkflowRunLogsInputSchema.parse(input);
	const row = await getWorkflow(db, id);
	if (!row) throw new Error(`ワークフローが見つかりません（id: ${id}）`);
	const runs = await listWorkflowRuns(db, id, limit ?? 5);
	if (runs.length === 0) {
		return { runs: [], message: `ワークフロー「${row.name}」の実行ログはまだありません。` };
	}
	return {
		workflowName: row.name,
		runs: runs.map((r) => ({
			id: r.id,
			ok: r.ok,
			...(r.error ? { error: r.error } : {}),
			steps: r.log ?? [],
			startedAt: r.startedAt.toISOString(),
			finishedAt: r.finishedAt.toISOString()
		}))
	};
}
