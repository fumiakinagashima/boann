// Catalog of tools selectable for a workflow "action" step.
// Referenced by both the client (editor UI) and server (execution engine), so it must not carry server-only dependencies like the DB.
import type { WorkflowResultType, WorkflowStep } from './types/chat';

export type WorkflowParamField = {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'number' | 'select' | 'date';
	required?: boolean;
	/** true for an optional parameter that should always be shown in the UI even though it can be left blank (i.e. not hidden behind "+ Add option") */
	alwaysShow?: boolean;
	/** if true, validates at save time that the value is valid JSON (parseable with JSON.parse after preQuoteReferences is applied) — the same rule run.ts uses when it JSON.parses the value at runtime */
	jsonFormat?: boolean;
	/** choices when type: 'select' */
	options?: { value: string; label: string }[];
};

export type WorkflowListResultField = { key: string; label: string };

/** An array-shaped result that can be referenced as a foreach's source. */
export type WorkflowListResultDef = {
	desc: string;
	/** the fields referenceable inside `body` as `@item:<key>` (used for UI/AI guidance) */
	itemFields: WorkflowListResultField[];
	/** extracts the list (an array of objects) from the tool's raw return value */
	extractList: (raw: unknown) => Record<string, unknown>[];
};

export type WorkflowActionToolDef = {
	value: string;
	label: string;
	/** parameters the user enters (excludes values that are auto-filled, e.g. `to` for send_email is not included) */
	params: WorkflowParamField[];
	/** set when this action returns a scalar result referenceable from conditions/other steps' arguments */
	resultType?: WorkflowResultType;
	resultDesc?: string;
	/** extracts the scalar result from the tool's raw return value (required when resultType is set) */
	extractResult?: (raw: unknown) => boolean | number | string;
	/** set when this action returns an array result usable as a foreach source (can be combined with resultType) */
	listResult?: WorkflowListResultDef;
	/** supplementary note appended to the AI-facing description (e.g. explaining auto-filled values). Not shown in the UI */
	note?: string;
};

export const WORKFLOW_ACTION_TOOLS: WorkflowActionToolDef[] = [
	{
		value: 'send_email',
		label: 'Send email (to yourself)',
		params: [
			{ key: 'subject', label: 'Subject', type: 'text', required: true },
			{ key: 'body', label: 'Body', type: 'textarea', required: true }
		],
		note: 'The recipient is automatically the user\'s own email address (no `to` parameter needed)'
	},
	{
		value: 'send_notification',
		label: 'Notify via notification center',
		params: [
			{ key: 'title', label: 'Title', type: 'text', required: true },
			{ key: 'body', label: 'Body', type: 'textarea', required: true }
		],
		note: 'The recipient is automatically the workflow\'s owner'
	},
	{
		value: 'send_slack_notification',
		label: 'Notify via Slack',
		params: [{ key: 'body', label: 'Body', type: 'textarea', required: true }],
		note: 'The destination is fixed to the Slack integration chosen as the "target" (integration_id is set directly by the target selection, so the AI cannot specify it via params)'
	},
	{
		value: 'get_entities',
		label: 'Search a custom table',
		params: [{ key: 'limit', label: 'Max records to fetch', type: 'number' }],
		resultType: 'number',
		resultDesc: 'the number of matching records',
		extractResult: (raw) => (Array.isArray(raw) ? raw.length : 0),
		note: 'The target table is determined by the "target" selection (each custom table appears as a target choice; entity_type_id cannot be specified directly via params)',
		listResult: {
			desc: 'the list of matching records (used to process them one by one in a foreach)',
			// Actual fields differ per table, so this is just a placeholder. The UI and validation use
			// entityListItemFields() to dynamically resolve the list from this step's entity_type_id
			// (this itemFields value is only a fallback).
			itemFields: [{ key: 'id', label: 'ID' }],
			extractList: (raw) =>
				Array.isArray(raw)
					? (raw as { id: string; data?: Record<string, unknown> }[]).map((r) => ({
							id: r.id,
							...(r.data ?? {})
						}))
					: []
		}
	},
	{
		value: 'create_entity',
		label: 'Create a record in a custom table',
		params: [{ key: 'data', label: 'Field values (JSON)', type: 'textarea', required: true }],
		note: 'The target table is determined by the "target" selection. `data` is a JSON object of field keys and values (e.g. {"name":"Tanaka","status":"active"})'
	},
	{
		value: 'update_entity',
		label: 'Update a record in a custom table',
		params: [
			{ key: 'id', label: 'Record ID', type: 'text', required: true },
			{ key: 'data', label: 'Updated field values (JSON)', type: 'textarea', required: true }
		],
		note: 'The target table is determined by the "target" selection. `id` is the ID of the record to update (e.g. @item:id), and `data` is a JSON object of the field keys and values to update'
	},
	{
		value: 'delete_entity',
		label: 'Delete a record from a custom table',
		params: [{ key: 'id', label: 'Record ID', type: 'text', required: true }],
		note: 'The target table is determined by the "target" selection. `id` is the ID of the record to delete'
	},
	{
		value: 'call_external_api',
		label: 'Call an external API',
		params: [
			{ key: 'endpoint', label: 'Endpoint (path or URL)', type: 'text', required: true },
			{
				key: 'method',
				label: 'HTTP method',
				type: 'select',
				required: true,
				options: [
					{ value: 'GET', label: 'GET' },
					{ value: 'POST', label: 'POST' },
					{ value: 'PUT', label: 'PUT' },
					{ value: 'PATCH', label: 'PATCH' },
					{ value: 'DELETE', label: 'DELETE' }
				]
			},
			{ key: 'body', label: 'Request body (JSON)', type: 'textarea', alwaysShow: true, jsonFormat: true }
		],
		resultType: 'string',
		resultDesc: 'the entire response body (objects are JSON-stringified). To get a specific field, reference it with @step:<id>.<path> (e.g. @step:sef.data.id)',
		// No extractResult/listResult. The result always keeps the full raw response body (see run.ts);
		// field extraction/array access is done at the reference site via @step:<id>.<path>, not at step
		// definition time.
		note: 'The call destination is determined by the "target" selection (a configured external API integration; integration_id is set directly by the target selection, so the AI cannot specify it via params). To inspect the response contents, pass this value into a console_log action (for debugging) to see the raw response. Reference a specific field with @step:<id>.<path> (e.g. @step:sef.data.id), or an array as a foreach source with @step:<id>.<path> (e.g. @step:sfw.data.items) — each element can then be referenced as @item:<key> if it\'s an object, or @item:value if it\'s a plain value. Unlike tables, Boann has no advance knowledge of an external API\'s response shape, so field name choices cannot be offered (manual entry is required)'
	},
	{
		value: 'console_log',
		label: '(Debug) Console output',
		params: [{ key: 'value', label: 'Value to output', type: 'text', required: true }],
		resultType: 'string',
		resultDesc: 'the output value (as-is)',
		note: 'A temporary debugging action for workflow validation. console.logs the specified value (with @step: etc. references resolved) to the dev server terminal. The same value is also shown in the result column of the execution log. Meaningless in production, so it\'s fine to delete once no longer needed'
	}
];

export function getWorkflowActionTool(tool: string): WorkflowActionToolDef | undefined {
	return WORKFLOW_ACTION_TOOLS.find((t) => t.value === tool);
}

export type WorkflowActionCategoryTarget = { value: string; label: string; tool: string };

export type WorkflowActionCategory = {
	key: string;
	label: string;
	targets: WorkflowActionCategoryTarget[];
	/** if true, each custom table (entity_type) is added as a target choice */
	includeEntityTargets?: boolean;
	/** the tool to use when includeEntityTargets is set (defaults to get_entities if unspecified) */
	entityTargetTool?: string;
	/** if true, configured Slack integrations (incoming webhooks) are added as individual target choices (fixed to send_slack_notification) */
	includeSlackTargets?: boolean;
	/** if true, configured external API integrations are added as individual target choices (fixed to call_external_api) */
	includeIntegrationTargets?: boolean;
};

/**
 * Grouping used to present a two-step "category -> target" selection in the editor.
 * The catalog itself (WORKFLOW_ACTION_TOOLS) is unchanged; this is a display-only structure layered on top of it,
 * to avoid the tool list growing flatly every time a new target choice is added.
 */
export const WORKFLOW_ACTION_CATEGORIES: WorkflowActionCategory[] = [
	{
		key: 'notify',
		label: 'Notify',
		targets: [
			{ value: 'notification', label: 'Notification center', tool: 'send_notification' },
			{ value: 'email', label: 'Email', tool: 'send_email' }
		],
		includeSlackTargets: true
	},
	{
		key: 'search',
		label: 'Search',
		targets: [],
		includeEntityTargets: true
	},
	{
		key: 'data_create',
		label: 'Create data',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'create_entity'
	},
	{
		key: 'data_update',
		label: 'Update data',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'update_entity'
	},
	{
		key: 'data_delete',
		label: 'Delete data',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'delete_entity'
	},
	{
		key: 'external_api',
		label: 'External API',
		targets: [],
		includeIntegrationTargets: true
	},
	{
		key: 'debug',
		label: 'Debug',
		targets: [{ value: 'console_log', label: 'Console output', tool: 'console_log' }]
	}
];

export function findWorkflowActionCategory(tool: string): WorkflowActionCategory | undefined {
	if (tool === 'get_entities') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeEntityTargets && !c.entityTargetTool);
	if (tool === 'create_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'create_entity');
	if (tool === 'update_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'update_entity');
	if (tool === 'delete_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'delete_entity');
	if (tool === 'send_slack_notification') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeSlackTargets);
	if (tool === 'call_external_api') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeIntegrationTargets);
	return WORKFLOW_ACTION_CATEGORIES.find((c) => c.targets.some((t) => t.tool === tool));
}

/**
 * Builds a get_entities step's foreach itemFields dynamically from the selected table's actual field definitions.
 * The catalog (WORKFLOW_ACTION_TOOLS) has no knowledge of per-table differences, so entityTypes is used to resolve it here.
 * Always includes `id` first.
 */
export function entityListItemFields(
	entityTypes: { id: string; fields: WorkflowListResultField[] }[],
	entityTypeId: string | undefined
): WorkflowListResultField[] {
	const idField: WorkflowListResultField = { key: 'id', label: 'ID' };
	const match = entityTypes.find((e) => e.id === entityTypeId);
	return match ? [idField, ...match.fields] : [idField];
}

/**
 * A simple JSON path resolver that walks an object/array using a dot-separated path (e.g. `data.items.0.id`).
 * Does not support JSONPath-style wildcards or filter expressions. Used from the `@step:<id>.<path>` reference
 * and the foreach source path (run.ts's resolveOperand/resolveForeachSource). Returns value as-is if path is empty.
 * Returns undefined if the path can't be walked.
 */
export function resolveJsonPath(value: unknown, path: string): unknown {
	const trimmed = path.trim();
	if (!trimmed) return value;
	let current: unknown = value;
	for (const segment of trimmed.split('.')) {
		if (current === null || current === undefined) return undefined;
		if (Array.isArray(current)) {
			const idx = Number(segment);
			current = Number.isInteger(idx) ? current[idx] : undefined;
		} else if (typeof current === 'object') {
			current = (current as Record<string, unknown>)[segment];
		} else {
			return undefined;
		}
	}
	return current;
}

/**
 * Interprets a result step's key as nesting via dot notation (e.g. "user.name") and sets the value by digging
 * into an object within target. If an intermediate path already has a value that isn't a plain object
 * (a scalar, array, or unset), it's replaced with a new object — this consistently extends to nesting the
 * existing policy (for the non-nested case) that setting the same key again overwrites it (last write wins).
 * Object-typed values (specifying nested keys directly) are still unsupported; only dot notation on the key
 * side expresses nesting.
 */
export function setResultPath(target: Record<string, unknown>, key: string, value: unknown): void {
	const segments = key.split('.');
	let current = target;
	for (let i = 0; i < segments.length - 1; i++) {
		const seg = segments[i];
		const existing = current[seg];
		if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
			current[seg] = {};
		}
		current = current[seg] as Record<string, unknown>;
	}
	current[segments[segments.length - 1]] = value;
}

/**
 * A static preview build for the workflow builder, to show "what a result step would assemble" without
 * running it (unlike run.ts's resolveOperand at execution time, references like @step: are not resolved and
 * are kept as tokens). Also walks into result steps inside condition/foreach, without considering whether that
 * branch/loop would actually execute (this is simply a map of "what result steps exist in this workflow").
 */
export function buildResultPreview(steps: WorkflowStep[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	function walk(list: WorkflowStep[]) {
		for (const step of list) {
			if (step.kind === 'result') {
				if (!step.key) continue;
				let value: unknown;
				if (step.valueType === 'array') {
					try {
						const parsed = JSON.parse(step.value || '[]');
						value = Array.isArray(parsed) ? parsed : step.value;
					} catch {
						value = step.value;
					}
				} else {
					value = step.value;
				}
				setResultPath(out, step.key, value);
			} else if (step.kind === 'condition') {
				walk(step.then);
			} else if (step.kind === 'foreach') {
				walk(step.body);
			}
		}
	}
	walk(steps);
	return out;
}

function formatPreviewValue(value: unknown, indent: string): string {
	if (isReferenceOperand(value)) return value;
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]';
		const inner = value.map((v) => `${indent}  ${formatPreviewValue(v, `${indent}  `)}`).join(',\n');
		return `[\n${inner}\n${indent}]`;
	}
	if (value !== null && typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);
		if (keys.length === 0) return '{}';
		const inner = keys.map((k) => `${indent}  ${JSON.stringify(k)}: ${formatPreviewValue(obj[k], `${indent}  `)}`).join(',\n');
		return `{\n${inner}\n${indent}}`;
	}
	return JSON.stringify(value);
}

/**
 * Formats buildResultPreview's result for display. Reference tokens like @step: are not wrapped in double
 * quotes (a display-only format meant to show they're expressions rather than literal values — this is not
 * syntactically valid JSON).
 */
export function formatResultPreview(preview: Record<string, unknown>): string {
	return formatPreviewValue(preview, '');
}

/**
 * Wraps unquoted @trigger:xxx / @step:xxx / @item:xxx / @self:xxx / @input:xxx references inside a `data`
 * field (JSON text) in quotes so it can be parsed with JSON.parse. Idempotent if already quoted.
 * Only applies at a JSON value position (right after `:` and right before `,`/`}`), to avoid corrupting an
 * existing string value that happens to contain literal text like "@self:account_id".
 * Lives in this file (no server-only dependencies) because it's used both from run.ts (runtime resolution)
 * and workflow-validation.ts (JSON format check at save time).
 */
export function preQuoteReferences(jsonStr: string): string {
	return jsonStr.replace(
		/:(\s*)(@(?:trigger|step|item|self|input):[a-zA-Z0-9_]+(?::[a-zA-Z0-9_]+)*)(\s*)([,}])/g,
		':$1"$2"$3$4'
	);
}

const RESULT_TYPE_LABELS: Record<WorkflowResultType, string> = {
	boolean: 'boolean',
	number: 'number',
	string: 'string'
};

/** Builds the description text for one catalog entry, embedded in the AI system prompt. */
export function describeWorkflowActionToolForAI(t: WorkflowActionToolDef): string {
	const paramsDesc =
		t.params.length > 0
			? JSON.stringify(Object.fromEntries(t.params.map((p) => [p.key, p.label])))
			: 'no params needed';
	const resultDesc = t.resultType
		? `, result is a ${RESULT_TYPE_LABELS[t.resultType]}${t.resultDesc ? ` (${t.resultDesc})` : ''}`
		: '';
	const noteDesc = t.note ? `Note: ${t.note}` : '';
	const listDesc = t.listResult
		? `. Can also be used as a foreach source to get a list (${t.listResult.desc}). Inside body, ${t.listResult.itemFields.map((f) => `@item:${f.key} (${f.label})`).join(' / ')} can be referenced`
		: '';
	return `- \`${t.value}\` (${t.label}${resultDesc}): params = ${paramsDesc}${noteDesc ? ` ${noteDesc}` : ''}${listDesc}`;
}

export const WORKFLOW_OPERATORS: { value: string; label: string }[] = [
	{ value: '==', label: '＝' },
	{ value: '!=', label: '≠' },
	{ value: '>', label: '＞' },
	{ value: '<', label: '＜' },
	{ value: '>=', label: '≧' },
	{ value: '<=', label: '≦' }
];

const REFERENCE_PREFIXES = ['@trigger:', '@step:', '@item:', '@self:', '@input:'] as const;

/** Whether a value uses one of the @trigger:/@step:/@item:/@self:/@input: reference notations. */
export function isReferenceOperand(value: unknown): value is string {
	return typeof value === 'string' && REFERENCE_PREFIXES.some((p) => value.startsWith(p));
}

const STEP_REF_PREFIX = '@step:';

export function makeStepRef(id: string): string {
	return `${STEP_REF_PREFIX}${id}`;
}

export type ParsedStepRef = { id: string; path: string | null };

/**
 * Parses `@step:<id>` (the traditional form, referencing a step's result as-is) or `@step:<id>.<path>`
 * (e.g. `@step:sef.name`, `@step:sfw.0.id`). `path` is used to walk the raw value held by call_external_api
 * etc. (an object/array, StepResult.raw) via resolveJsonPath. Since step ids are generated by shortId()
 * (which never contains a dot), the first dot is treated as the separator between id and path.
 */
export function parseStepRef(value: string | undefined): ParsedStepRef | null {
	if (!value || !value.startsWith(STEP_REF_PREFIX)) return null;
	const rest = value.slice(STEP_REF_PREFIX.length);
	const dotIdx = rest.indexOf('.');
	if (dotIdx === -1) return { id: rest, path: null };
	return { id: rest.slice(0, dotIdx), path: rest.slice(dotIdx + 1) };
}

const ITEM_REF_PREFIX = '@item:';

export type ParsedItemRef = { foreachStepId: string | null; field: string };

/**
 * Notation for referencing a field of the item currently being processed, inside a foreach's body
 * (`@item:<foreach id>:<field>`). Specifying foreachStepId disambiguates which nested foreach's item is
 * meant (the editor always saves in this form). The legacy form omitting foreachStepId (`@item:<field>`) can
 * still be read by parseItemRef, and is interpreted as referring to the innermost foreach.
 */
export function makeItemRef(foreachStepId: string, field: string): string {
	return `${ITEM_REF_PREFIX}${foreachStepId}:${field}`;
}

export function parseItemRef(value: string | undefined): ParsedItemRef | null {
	if (!value || !value.startsWith(ITEM_REF_PREFIX)) return null;
	const rest = value.slice(ITEM_REF_PREFIX.length);
	const sep = rest.indexOf(':');
	if (sep === -1) return { foreachStepId: null, field: rest };
	return { foreachStepId: rest.slice(0, sep), field: rest.slice(sep + 1) };
}

const TRIGGER_REF_PREFIX = '@trigger:';

/**
 * Notation for referencing a field of the record operated on by the event trigger (`@trigger:<field>`).
 * Refers to system fields like id/event, createdBy, etc. as well as table-specific fields.
 */
export function makeTriggerRef(field: string): string {
	return `${TRIGGER_REF_PREFIX}${field}`;
}

export function parseTriggerRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(TRIGGER_REF_PREFIX)) return null;
	return value.slice(TRIGGER_REF_PREFIX.length);
}

const INPUT_REF_PREFIX = '@input:';

/** Notation for referencing a workflow's declared input parameters (inputSchema) (`@input:<key>`). */
export function makeInputRef(key: string): string {
	return `${INPUT_REF_PREFIX}${key}`;
}

export function parseInputRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(INPUT_REF_PREFIX)) return null;
	return value.slice(INPUT_REF_PREFIX.length);
}

/**
 * System fields on an event trigger's target record that are always referenceable regardless of the table's
 * field definitions. Keys match what RecordRow (table-service.getRecord) actually returns (camelCase keys
 * like createdBy).
 */
export const TRIGGER_SYSTEM_FIELDS: WorkflowListResultField[] = [
	{ key: 'id', label: 'Record ID' },
	{ key: 'event', label: 'Event type (create/update/delete)' },
	{ key: 'createdBy', label: 'Creator account ID' },
	{ key: 'updatedBy', label: 'Last updater account ID' },
	{ key: 'createdAt', label: 'Created at' },
	{ key: 'updatedAt', label: 'Updated at' }
];

/**
 * Builds the list of "trigger record fields" selectable in an event trigger's step1 condition, etc.
 * Adds the selected trigger table's custom fields to the system fields (id/event/createdBy, etc.).
 */
export function triggerFieldsFor(
	entityTypes: { id: string; fields: WorkflowListResultField[] }[],
	triggerEntityTypeId: string | null | undefined
): WorkflowListResultField[] {
	const match = entityTypes.find((e) => e.id === triggerEntityTypeId);
	return [...TRIGGER_SYSTEM_FIELDS, ...(match?.fields ?? [])];
}

/** Notation referencing the workflow owner's own account ID. Used to compare against createdBy etc. to check "did I perform this operation". */
export const SELF_ACCOUNT_ID_REF = '@self:account_id';
