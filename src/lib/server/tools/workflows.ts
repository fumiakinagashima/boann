import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import type { ToolEnv } from './shared';
import { createWorkflow, updateWorkflow, listWorkflows, listWorkflowsByAppId, getWorkflow, type WorkflowRow } from '../db/workflow-service';
import { listEntityTypesForWorkflow, type FieldDef } from '../db/table-service';
import { listSlackIntegrationsForWorkflow } from '../slack';
import { listExternalApiConnectionsForWorkflow } from '../db/external-api-connection-service';
import { validateWorkflow } from '$lib/workflow-validation';
import { runWorkflowNow } from '../workflow/run';
import { listWorkflowRuns } from '../db/workflow-run-service';
import { WORKFLOW_MAX_RETRIES } from '$lib/constants';
import type { WorkflowStep } from '$lib/types/chat';

const workflowStepSchema: z.ZodType<WorkflowStep> = z.lazy(() =>
	z.union([
		z.object({
			id: z.string(),
			kind: z.literal('action'),
			label: z.string(),
			tool: z.string(),
			params: z.record(z.string(), z.string()).optional(),
			category: z.string().optional(),
			maxRetries: z.number().int().min(0).max(WORKFLOW_MAX_RETRIES).optional(),
			continueOnError: z.boolean().optional()
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
	description: z.string().optional(),
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
			'Save a workflow definition to the DB. Use this to persist the content of a proposed workflow component as-is (saving after the user has edited it in the UI is done via the "Save" button, so the AI does not need to call this tool for that). When editing an existing workflow, you must always specify the id obtained from get_workflow (omitting id creates a new workflow, resulting in a duplicate). After saving, it can be checked/managed from the app\'s workflow list (for a newly created workflow, it must be separately enabled before it will run).',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ID to use when updating an existing workflow (the value obtained from get_workflow). Do not specify when creating a new one' },
				name: { type: 'string', description: 'Workflow name' },
				description: { type: 'string', description: 'Description of what this workflow does. This is the material an external MCP agent uses to decide whether to call this workflow, so write it concretely when triggerType is mcp_tool (e.g. "Sends the specified customer a notification that the quote has been completed")' },
				triggerType: { type: 'string', enum: ['schedule', 'event', 'mcp_tool'], description: 'Trigger type. schedule = a fixed time every day, event = on record operations, mcp_tool = when called by an external MCP agent (no schedule/event settings needed). Defaults to mcp_tool if omitted' },
				triggerHour: { type: 'number', description: 'Execution hour (0-23, JST). Only applies for schedule' },
				triggerMinute: { type: 'number', description: 'Execution minute (0-59, JST). Only applies for schedule' },
				triggerEvent: { type: 'string', enum: ['create', 'update', 'delete'], description: 'Only for event. The target operation (create = creation, update = update, delete = deletion)' },
				triggerEntityTypeId: { type: 'string', description: 'Only for event. The entity_types.id (UUID key) of the table to watch' },
				inputSchema: {
					type: 'array',
					description: 'The list of input parameters to declare (values supplied by the caller). Each element is {key, label, type, required, options, description}. Can be referenced within steps as @input:<key>',
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
					description: 'Array of steps (action or condition). For an event trigger, you can reference the ID of the record that was operated on via @trigger:id, the event type via @trigger:event, and other field values of that record via @trigger:<field key> (e.g. @trigger:createdBy) — including as the target of a condition (even in the first step). @self:account_id represents the account ID of the person who registered the workflow, letting you check things like "was this operated on by someone other than me" via @trigger:createdBy != @self:account_id. Input parameters declared in inputSchema can be referenced via @input:<key>'
				}
			},
			required: ['name', 'triggerHour', 'triggerMinute', 'steps']
		}
	},
	{
		name: 'list_workflows',
		description:
			'Get the list of saved workflows. Use this for things like "what workflows are configured" or "I want to check the scheduled-run settings".',
		input_schema: { type: 'object', properties: {} }
	},
	{
		name: 'get_workflow',
		description:
			'Get a single existing workflow by name or ID. Use this when there is a request to check or edit an existing workflow, such as "edit the ○○ workflow" or "fix the settings for ○○". Display the retrieved content with the workflow component (specifying the same id), and propose an updated configuration according to the user\'s instructions.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Workflow ID (if known)' },
				name: { type: 'string', description: 'Workflow name (partial match). Use this when the id is not known' }
			},
			required: []
		}
	},
	{
		name: 'run_workflow',
		description:
			'Run the specified workflow right now. Use this for requests like "run the ○○ workflow" or "run it now". Returns the execution result (success/failure and error details). If get_workflow\'s inputSchema has input parameters, pass their values via inputArgs.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ID of the workflow to run (obtained from list_workflows or get_workflow)' },
				inputArgs: { type: 'object', description: 'Key/value pairs for the input parameters declared in get_workflow\'s inputSchema (e.g. {"customer_name": "Tanaka"}). Not needed for workflows without input parameters' }
			},
			required: ['id']
		}
	},
	{
		name: 'get_workflow_run_logs',
		description:
			'Get a workflow\'s execution logs (recent run history). Use this for requests like "what was the result of the last run?" or "show me the error details". Includes the success/failure of each step.',
		input_schema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'ID of the target workflow' },
				limit: { type: 'number', description: 'Number of records to retrieve (default: 5)' }
			},
			required: ['id']
		}
	}
];

export async function handleSaveWorkflow(db: Db, input: unknown, env?: ToolEnv) {
	const { id, name, description, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId, inputSchema, steps } = saveWorkflowInputSchema.parse(input);
	const [entityTypes, slackIntegrations, integrations] = await Promise.all([
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db),
		listExternalApiConnectionsForWorkflow(db)
	]);
	const validation = validateWorkflow(triggerType ?? 'schedule', triggerHour, triggerMinute, triggerEntityTypeId, steps, entityTypes, slackIntegrations, inputSchema ?? [], integrations);
	if (!validation.ok) {
		throw new Error(`There is a problem with the workflow content: ${validation.errors.join(' / ')}`);
	}

	if (id) {
		const existing = await getWorkflow(db, id);
		if (!existing) throw new Error(`Workflow not found (id: ${id})`);
		if (existing.accountId && existing.accountId !== env?.accountId) {
			throw new Error('You do not have permission to update this workflow.');
		}
		const workflow = await updateWorkflow(db, id, { name, description: description ?? existing.description, steps, inputSchema: inputSchema as FieldDef[] | undefined, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId });
		return {
			id: workflow.id,
			name: workflow.name,
			stepCount: workflow.steps.length,
			message: `Updated workflow "${workflow.name}" (${workflow.steps.length} step(s)).`
		};
	}

	const workflow = await createWorkflow(db, {
		name,
		description,
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
		message: `Saved workflow "${workflow.name}" (${workflow.steps.length} step(s)). It will run once enabled from the app's workflow list.`
	};
}

export async function handleListWorkflows(db: Db, env?: ToolEnv) {
	const rows = env?.appId
		? await listWorkflowsByAppId(db, env.appId)
		: await listWorkflows(db, env?.accountId);
	if (rows.length === 0) {
		return { workflows: [], message: 'There are no saved workflows.' };
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
		description: row.description,
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
	if (!id && !name) throw new Error('Specify either id or name.');

	if (id) {
		const row = await getWorkflow(db, id);
		if (!row) throw new Error(`Workflow not found (id: ${id})`);
		if (row.accountId && row.accountId !== env?.accountId) {
			throw new Error(`Workflow not found (id: ${id})`);
		}
		return toGetWorkflowResult(row);
	}

	const rows = await listWorkflows(db, env?.accountId);
	const matches = rows.filter((r) => r.name.includes(name!));
	if (matches.length === 0) {
		throw new Error(`No workflow matching "${name}" was found.`);
	}
	if (matches.length > 1) {
		return {
			ambiguous: true,
			message: `There are multiple workflows matching "${name}". Please confirm which one to edit.`,
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
	if (!row) throw new Error(`Workflow not found (id: ${id})`);
	const result = await runWorkflowNow(db, id, env, undefined, inputArgs);
	return {
		id: result.id,
		name: result.name,
		ok: result.ok,
		...(result.error ? { error: result.error } : {}),
		...(Object.keys(result.result).length > 0 ? { result: result.result } : {}),
		message: result.ok
			? `Ran workflow "${result.name}".`
			: `Failed to run workflow "${result.name}": ${result.error}`
	};
}

const getWorkflowRunLogsInputSchema = z.object({
	id: z.string(),
	limit: z.number().int().min(1).max(50).optional()
});

export async function handleGetWorkflowRunLogs(db: Db, input: unknown) {
	const { id, limit } = getWorkflowRunLogsInputSchema.parse(input);
	const row = await getWorkflow(db, id);
	if (!row) throw new Error(`Workflow not found (id: ${id})`);
	const runs = await listWorkflowRuns(db, id, limit ?? 5);
	if (runs.length === 0) {
		return { runs: [], message: `There are no run logs yet for workflow "${row.name}".` };
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
