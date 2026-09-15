import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

// Infers and plans an app structure (tables/fields) from a file (a spec memo such as txt/md, etc.).
// Finalizing (applying it to the DB) is done deterministically by import-apply.ts.
// The LLM only ever produces a "design proposal" — deterministic code handles things like bulk record insertion.

const FIELD_TYPES = ['text', 'number', 'select', 'date', 'email', 'tel', 'textarea', 'recordSelect', 'account'] as const;

const fieldSchema = z.object({
	key: z.string().regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	type: z.enum(FIELD_TYPES).default('text'),
	required: z.boolean().default(false),
	options: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
	ref_table: z.string().optional()
});

const tableSchema = z.object({
	name: z.string().regex(/^[a-z0-9_]+$/),
	label: z.string().min(1),
	icon: z.string().optional(),
	fields: z.array(fieldSchema).min(1)
});

export const importPlanSchema = z.object({
	app: z.object({
		name: z.string().regex(/^[a-z0-9_]+$/),
		label: z.string().min(1),
		icon: z.string().optional()
	}),
	tables: z.array(tableSchema).min(1),
	// Workflows are not auto-created even if included in the plan right now (informational display only).
	workflows: z.array(z.object({ name: z.string(), description: z.string().optional() })).default([])
});

export type ImportPlan = z.infer<typeof importPlanSchema>;

const PLAN_TOOL: Tool = {
	name: 'emit_app_plan',
	description: 'Outputs the app structure (tables/fields) designed from the file contents.',
	input_schema: {
		type: 'object',
		properties: {
			app: {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The app\'s identifier name (lowercase letters, digits, and underscores only, e.g. customer_management)' },
					label: { type: 'string', description: 'The app\'s display name (e.g. Customer Management)' },
					icon: { type: 'string', description: 'Icon (an emoji is recommended, e.g. 📇)' }
				},
				required: ['name', 'label']
			},
			tables: {
				type: 'array',
				description: 'The list of tables to include in the app',
				items: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'The table\'s identifier name (lowercase letters, digits, and underscores only, e.g. customers)' },
						label: { type: 'string', description: 'The table\'s display name (e.g. Customer Master)' },
						icon: { type: 'string', description: 'Icon (an emoji is recommended)' },
						fields: {
							type: 'array',
							description: 'Field definitions (in display order)',
							items: {
								type: 'object',
								properties: {
									key: { type: 'string', description: 'Field key (lowercase letters, digits, and underscores only)' },
									label: { type: 'string', description: 'The field\'s display name' },
									type: {
										type: 'string',
										enum: [...FIELD_TYPES],
										description: 'The field\'s type. recordSelect is a relationship field referencing a record in another table. account is a relationship field referencing an account (user); ref_table isn\'t needed for it (it automatically references accounts, and displays the account name in views and choices)'
									},
									required: { type: 'boolean' },
									options: {
										type: 'array',
										items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } } },
										description: 'The choices when type is select'
									},
									ref_table: { type: 'string', description: 'The name of the referenced table when type is recordSelect (specify the name of one of the tables in this plan)' }
								},
								required: ['key', 'label', 'type']
							}
						}
					},
					required: ['name', 'label', 'fields']
				}
			},
			workflows: {
				type: 'array',
				description: 'If the file mentions any, list the name and summary of workflows (automated processes) (these are not created by this plan, and are added manually later).',
				items: {
					type: 'object',
					properties: { name: { type: 'string' }, description: { type: 'string' } },
					required: ['name']
				}
			}
		},
		required: ['app', 'tables']
	}
};

const SYSTEM_PROMPT = `You are the design assistant for Boann, a no-code app platform.
Read the spec memo (text/Markdown) or Excel file (with sheet names, header rows, and sample rows extracted) the user uploaded, and design the structure of a business app.
Content derived from Excel is passed in the form "--- Sheet: <name> ---" "Headers: ..." "Example: ...". As a rule, treat one sheet as one table, and design the headers as fields (you may infer the field type from the sample row values).

Design rules:
- Design exactly the tables and fields needed from the file's contents, no more and no less.
- Display names (label) are in English; identifier names (name/key) are lowercase letters, digits, and underscores only.
- Express relationships between tables with a recordSelect-type field, specifying the referenced table's name in ref_table.
- Supplement common fields a typical business app needs (e.g. name, date, assignee, status) as appropriate, even if not explicitly stated in the text.
- If the file mentions workflows (automated processes), list them in workflows (don't create them).
- Always call the emit_app_plan tool to return the result.`;

export async function generateImportPlan(opts: {
	apiKey: string;
	model: string;
	content: string;
	filename: string;
}): Promise<ImportPlan> {
	const anthropic = new Anthropic({ apiKey: opts.apiKey });
	const response = await anthropic.messages.create({
		model: opts.model,
		max_tokens: 4096,
		system: SYSTEM_PROMPT,
		tools: [PLAN_TOOL],
		tool_choice: { type: 'tool', name: 'emit_app_plan' },
		messages: [
			{ role: 'user', content: `File name: ${opts.filename}\n\n--- File content ---\n${opts.content}` }
		]
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('Failed to generate a plan');
	}
	return importPlanSchema.parse(block.input);
}

const REFINE_SYSTEM_PROMPT = `You are the design assistant for Boann, a no-code app platform.
Given an already-designed app plan (JSON), output the **entire new plan** reflecting the user's requested changes.

Rules:
- Reflect only the requested change, and keep the rest of the structure and naming as unchanged as possible.
- Display names (label) are in English; identifier names (name/key) are lowercase letters, digits, and underscores only.
- Express relationships between tables with a recordSelect-type field (ref_table holding the referenced table's name).
- Always return the entire plan via the emit_app_plan tool (a full new plan, not a diff).`;

export async function refineImportPlan(opts: {
	apiKey: string;
	model: string;
	currentPlan: ImportPlan;
	content: string | null;
	message: string;
	history: { role: 'user' | 'assistant'; text: string }[];
}): Promise<ImportPlan> {
	const anthropic = new Anthropic({ apiKey: opts.apiKey });
	const pastRequests = opts.history
		.filter((m) => m.role === 'user')
		.map((m) => `- ${m.text}`)
		.join('\n');

	const userText = [
		'Current plan (JSON):',
		'```json',
		JSON.stringify(opts.currentPlan, null, 2),
		'```',
		opts.content ? `\nOriginal file content:\n---\n${opts.content}\n---` : '',
		pastRequests ? `\nPrevious change requests:\n${pastRequests}` : '',
		`\nThis change request:\n${opts.message}`,
		'\nReturn the entire new plan reflecting the above via emit_app_plan.'
	].join('\n');

	const response = await anthropic.messages.create({
		model: opts.model,
		max_tokens: 4096,
		system: REFINE_SYSTEM_PROMPT,
		tools: [PLAN_TOOL],
		tool_choice: { type: 'tool', name: 'emit_app_plan' },
		messages: [{ role: 'user', content: userText }]
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('Failed to update the plan');
	}
	return importPlanSchema.parse(block.input);
}

// A deterministic plan for MOCK_AI (a customer-management example).
export function mockImportPlan(_content: string): ImportPlan {
	return importPlanSchema.parse({
		app: { name: 'customer_management', label: 'Customer Management', icon: '📇' },
		tables: [
			{
				name: 'customers',
				label: 'Customer Master',
				icon: '🏢',
				fields: [
					{ key: 'name', label: 'Customer name', type: 'text', required: true },
					{ key: 'email', label: 'Email', type: 'email' },
					{ key: 'phone', label: 'Phone number', type: 'tel' },
					{ key: 'status', label: 'Status', type: 'select', options: [
						{ value: 'active', label: 'Active' },
						{ value: 'prospect', label: 'Prospect' }
					] }
				]
			},
			{
				name: 'activities',
				label: 'Activity History',
				icon: '📝',
				fields: [
					{ key: 'customer', label: 'Customer', type: 'recordSelect', ref_table: 'customers', required: true },
					{ key: 'occurred_on', label: 'Date', type: 'date' },
					{ key: 'memo', label: 'Notes', type: 'textarea' },
					{ key: 'shared_with', label: 'Shared with', type: 'text' }
				]
			}
		],
		workflows: [
			{ name: 'Activity history share notification', description: 'Sends a notification to the shared-with party when an activity history entry is registered' }
		]
	});
}
