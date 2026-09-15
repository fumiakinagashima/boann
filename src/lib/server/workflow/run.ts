import type { Db } from '../db';
import type { ToolEnv } from '../tools/shared';
import { dispatchTool, type ToolName } from '../tools';
import { getEnabledWorkflows, getWorkflow, type WorkflowRow } from '../db/workflow-service';
import { recordWorkflowRun, type StepLog } from '../db/workflow-run-service';
import { getAccount } from '../db/account-service';
import { getJstHourMinute } from '$lib/datetime';
import { getWorkflowActionTool, parseStepRef, parseItemRef, resolveJsonPath, preQuoteReferences, isReferenceOperand, setResultPath } from '$lib/workflow-tools';
import { WORKFLOW_FOREACH_MAX_ITEMS, WORKFLOW_MAX_ACTIONS_PER_RUN, WORKFLOW_MAX_RETRIES, WORKFLOW_RETRY_DELAY_MS } from '$lib/constants';
import { createRecordByEntityTypeId, updateRecordByEntityTypeId, deleteRecord } from '../db/table-service';
import { getExternalApiConnection, callExternalApiConnection } from '../db/external-api-connection-service';
import type {
	WorkflowStep,
	WorkflowActionStep,
	WorkflowForeachStep,
	WorkflowResultType
} from '$lib/types/chat';

export type TriggerEvent = 'create' | 'update' | 'delete';
export type TriggerContext = {
	event: TriggerEvent;
	recordId: string;
	entityTypeId: string;
	/** Snapshot of the triggering record's field values (referenced via @trigger:<field>). */
	data?: Record<string, unknown>;
};

/** Info about the workflow's own registrant. selfEmail is used as the recipient for send_email, accountId to resolve @self:account_id. */
type SelfContext = { email: string | null; accountId: string | null };

/**
 * raw holds the "raw value before extraction" (object/array/etc.) for property access via
 * `@step:<id>.<path>`. Currently only call_external_api sets this (other actions' results are
 * already scalar, so there's no point decomposing them).
 */
type StepResult = { type: WorkflowResultType; value: boolean | number | string; raw?: unknown };
type ListResults = Map<string, Record<string, unknown>[]>;
/** Stack of the "current item" for nested foreach, keyed per foreach id. The end of the array is the innermost foreach. */
type ItemStack = { foreachStepId: string; item: Record<string, unknown> }[];

/** Error used to immediately abort workflow execution (e.g. referencing an undefined variable, an unsupported tool, etc.). */
class WorkflowAbortError extends Error {}

/**
 * The remaining budget of action executions allowed across a single run, used to prevent a
 * combinatorial explosion from nested foreach (e.g. a 3-level nest of 50 x 50 x 50 items).
 * A single instance is shared across the whole runSteps/runForeach recursion.
 */
type Budget = { remaining: number };

function consumeBudget(budget: Budget): void {
	if (budget.remaining <= 0) {
		throw new WorkflowAbortError(
			`The limit on the number of actions allowed in a single run (${WORKFLOW_MAX_ACTIONS_PER_RUN}) was exceeded. Please reduce foreach nesting or retry counts`
		);
	}
	budget.remaining--;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The result object assembled by set_result for the whole workflow run (used in the run_workflow_* MCP response and the "run now" result display). */
type ResultObject = Record<string, unknown>;

/**
 * Resolves the value field of set_result. scalar is a single operand (references such as @step:
 * are also allowed); array is a JSON array (only string elements are resolved as @refs, everything
 * else is passed through as-is). Assumes the value written by the editor (a JSON.stringify'd string
 * array in the array case), so preQuoteReferences-style quote completion is not needed (the editor
 * always writes correctly quoted JSON).
 */
export function computeSetResultValue(
	valueType: 'scalar' | 'array',
	rawValue: string,
	label: string,
	results: Map<string, StepResult>,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	self?: SelfContext,
	inputArgs?: Record<string, unknown>
): unknown {
	if (valueType === 'array') {
		let items: unknown[];
		try {
			items = JSON.parse(rawValue || '[]');
		} catch {
			throw new WorkflowAbortError(`The value of "${label}" is not in array format`);
		}
		if (!Array.isArray(items)) throw new WorkflowAbortError(`The value of "${label}" must be specified as an array`);
		return items.map((v) =>
			typeof v === 'string' ? resolveOperand(v, results, itemStack, triggerContext, self, inputArgs).value : v
		);
	}
	return rawValue ? resolveOperand(rawValue, results, itemStack, triggerContext, self, inputArgs).value : '';
}

/**
 * Converts a value (of unknown type) extracted by resolveJsonPath — whether from the response body
 * of call_external_api (when storing the result) or via a `@step:<id>.<path>` reference — into a
 * StepResult. Anything other than boolean/number/string (object, array, null, undefined) is dropped
 * to its JSON string representation (a stringified value is more useful than one you can't inspect).
 */
function coerceScalarResult(value: unknown): StepResult {
	if (typeof value === 'boolean') return { type: 'boolean', value };
	if (typeof value === 'number') return { type: 'number', value };
	if (typeof value === 'string') return { type: 'string', value };
	if (value === undefined || value === null) return { type: 'string', value: '' };
	return { type: 'string', value: JSON.stringify(value) };
}

// preQuoteReferences is defined in $lib/workflow-tools (a shared catalog with no server-only dependencies).
// run.test.ts historically imports it from './run', so it is re-exported here for backward compatibility.
export { preQuoteReferences };

/** Resolves @references contained in string values within an already-JSON.parse'd data object. */
function resolveDataValues(
	data: Record<string, unknown>,
	results: Map<string, StepResult>,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	self?: SelfContext,
	inputArgs?: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (isReferenceOperand(v)) {
			out[k] = resolveOperand(v, results, itemStack, triggerContext, self, inputArgs).value;
		} else {
			out[k] = v;
		}
	}
	return out;
}

export function resolveOperand(
	operand: string,
	results: Map<string, StepResult>,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	self?: SelfContext,
	inputArgs?: Record<string, unknown>
): StepResult {
	if (operand.startsWith('@trigger:')) {
		if (!triggerContext) throw new WorkflowAbortError('@trigger references can only be used with an event trigger');
		const field = operand.slice('@trigger:'.length);
		if (field === 'id') return { type: 'string', value: triggerContext.recordId };
		if (field === 'event') return { type: 'string', value: triggerContext.event };
		const v = triggerContext.data?.[field];
		if (v === undefined) throw new WorkflowAbortError(`This field does not exist on the trigger record: ${field}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	if (operand.startsWith('@self:')) {
		const field = operand.slice('@self:'.length);
		if (field === 'account_id') {
			if (!self?.accountId) throw new WorkflowAbortError('@self:account_id cannot be used because the workflow\'s registrant could not be identified');
			return { type: 'string', value: self.accountId };
		}
		throw new WorkflowAbortError(`Unknown @self reference: ${field}`);
	}
	if (operand.startsWith('@input:')) {
		const key = operand.slice('@input:'.length);
		const v = inputArgs?.[key];
		if (v === undefined) throw new WorkflowAbortError(`Input parameter not supplied: ${key}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	const itemRef = parseItemRef(operand);
	if (itemRef !== null) {
		const scope = itemRef.foreachStepId
			? itemStack.find((s) => s.foreachStepId === itemRef.foreachStepId)
			: itemStack[itemStack.length - 1];
		if (!scope) throw new WorkflowAbortError(`@item reference can only be used inside a foreach: ${operand}`);
		const v = scope.item[itemRef.field];
		if (v === undefined) throw new WorkflowAbortError(`This field does not exist on the current item: ${itemRef.field}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	const stepRef = parseStepRef(operand);
	if (stepRef === null) return { type: 'string', value: operand };
	const found = results.get(stepRef.id);
	if (!found) throw new WorkflowAbortError(`Could not find the result of the referenced step: ${stepRef.id}`);
	if (stepRef.path === null) return found;
	// `@step:<id>.<path>` — for an action with no raw (most tools return only an already-scalar
	// value that doesn't need decomposing), specifying a path is an error (the same treatment as
	// an @item reference to a field that doesn't exist).
	if (found.raw === undefined) {
		throw new WorkflowAbortError(`The result of "${stepRef.id}" cannot be referenced by field (only call_external_api supports this): ${operand}`);
	}
	const resolved = resolveJsonPath(found.raw, stepRef.path);
	if (resolved === undefined) throw new WorkflowAbortError(`The specified field was not found: ${operand}`);
	return coerceScalarResult(resolved);
}

export function compare(left: StepResult, operator: string, right: StepResult): boolean {
	let rv: boolean | number | string = right.value;
	if (left.type === 'number') rv = typeof rv === 'number' ? rv : Number(rv);
	else if (left.type === 'boolean') {
		rv = typeof rv === 'boolean' ? rv : typeof rv === 'number' ? rv !== 0 : rv === 'true';
	}
	const lv = left.value;
	if (operator === '==') return lv === rv;
	if (operator === '!=') return lv !== rv;
	if (operator !== '>' && operator !== '<' && operator !== '>=' && operator !== '<=') {
		throw new WorkflowAbortError(`Unsupported operator: ${operator}`);
	}
	// Order comparison: even when left.type is 'string', compare numerically if both sides can be
	// interpreted as numbers. This avoids misjudging cases where numbers have been stringified (e.g.
	// via CSV import or create_entity's JSON data) using plain JS string comparison (lexicographic,
	// where e.g. "10" > "9" would be false).
	const ln = typeof lv === 'number' ? lv : Number(lv);
	const rn = typeof rv === 'number' ? rv : Number(rv);
	const numeric = !Number.isNaN(ln) && !Number.isNaN(rn);
	const lc: number | string | boolean = numeric ? ln : lv;
	const rc: number | string | boolean = numeric ? rn : rv;
	switch (operator) {
		case '>':
			return lc > rc;
		case '<':
			return lc < rc;
		case '>=':
			return lc >= rc;
		default:
			return lc <= rc;
	}
}

/**
 * Runs a step exactly once (the unit of retry). A configuration problem (no target selected,
 * malformed JSON, etc.) throws WorkflowAbortError so it is not retried. Any other exception (e.g. an
 * external API call failure) is treated by the caller's (runAction's) retry loop as a possibly
 * transient failure that may be retried.
 */
async function performAction(
	db: Db,
	step: WorkflowActionStep,
	toolDef: NonNullable<ReturnType<typeof getWorkflowActionTool>>,
	resolvedParams: Record<string, string | number>,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<{ result?: string }> {
	// For verification only (temporary): a debug action that just console.logs the resolved value to
	// the dev server's terminal. Meaningless in production (its output only goes to the local dev
	// terminal), so it's fine to remove once no longer needed.
	if (step.tool === 'console_log') {
		const value = resolvedParams['value'];
		console.log(`[workflow debug] "${step.label}":`, value);
		return { result: String(value) };
	}

	// Entity write operations call the DB service directly, bypassing the MCP tools
	if (step.tool === 'create_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`No target table is selected for "${step.label}"`);
		const rawDataStr = step.params?.['data'] ?? '';
		if (!rawDataStr) throw new WorkflowAbortError(`No data is specified for "${step.label}"`);
		let data: Record<string, unknown>;
		try { data = JSON.parse(preQuoteReferences(rawDataStr)); } catch { throw new WorkflowAbortError(`The data for "${step.label}" is not in JSON format`); }
		data = resolveDataValues(data, results, itemStack, triggerContext, self, inputArgs);
		const record = await createRecordByEntityTypeId(db, entityTypeId, data, env?.accountId);
		return { result: `Record created (id: ${record.id})` };
	}

	if (step.tool === 'update_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`No target table is selected for "${step.label}"`);
		const recordId = resolvedParams['id'] as string | undefined;
		if (!recordId) throw new WorkflowAbortError(`No record ID is specified for "${step.label}"`);
		const rawDataStr = step.params?.['data'] ?? '';
		if (!rawDataStr) throw new WorkflowAbortError(`No data is specified for "${step.label}"`);
		let data: Record<string, unknown>;
		try { data = JSON.parse(preQuoteReferences(rawDataStr)); } catch { throw new WorkflowAbortError(`The data for "${step.label}" is not in JSON format`); }
		data = resolveDataValues(data, results, itemStack, triggerContext, self, inputArgs);
		await updateRecordByEntityTypeId(db, entityTypeId, recordId, data, env?.accountId);
		return { result: `Record updated (id: ${recordId})` };
	}

	if (step.tool === 'delete_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`No target table is selected for "${step.label}"`);
		const recordId = resolvedParams['id'] as string | undefined;
		if (!recordId) throw new WorkflowAbortError(`No record ID is specified for "${step.label}"`);
		await deleteRecord(db, '', recordId);
		return { result: `Record deleted (id: ${recordId})` };
	}

	// call_external_api references the dedicated external_api_connections table (added 2026-07-22),
	// not the `integrations` table (used for notification-oriented integrations like Slack). This is
	// implemented completely separately from the internal AI tool reached via dispatchTool
	// (call_external_api in tools/integrations.ts, a distinct system with per-authType auth config);
	// it makes the HTTP call directly here.
	if (step.tool === 'call_external_api') {
		// Equivalent to connection_id. Not included in the catalog's params; set directly on step.params via the editor's "target" selector
		const connectionId = step.params?.integration_id;
		if (!connectionId) throw new WorkflowAbortError(`No integration target is selected for "${step.label}"`);
		const connection = await getExternalApiConnection(db, connectionId);
		if (!connection) throw new WorkflowAbortError(`The integration target for "${step.label}" was not found (it may have been deleted)`);

		const rawBodyStr = step.params?.['body'] ?? '';
		let body: Record<string, unknown> | undefined;
		if (rawBodyStr) {
			let parsedBody: Record<string, unknown>;
			try { parsedBody = JSON.parse(preQuoteReferences(rawBodyStr)); } catch { throw new WorkflowAbortError(`The request body for "${step.label}" is not in JSON format`); }
			body = resolveDataValues(parsedBody, results, itemStack, triggerContext, self, inputArgs);
		}

		const raw = await callExternalApiConnection(connection, {
			endpoint: resolvedParams['endpoint'] as string | undefined,
			method: resolvedParams['method'] as string,
			body
		});

		// The scalar result is always the entire response body (coerceScalarResult JSON-stringifies an
		// object). raw retains the pre-decomposition value (object/array/etc.); the reference side
		// walks fields/array elements via `@step:<id>.<path>` (the step-definition-time field
		// extraction settings like result_path/list_path have been removed, since the reference side
		// can specify the path, there's no need to hard-code it on the step side — 2026-07-22).
		results.set(step.id, { ...coerceScalarResult(raw.body), raw: raw.body });

		return { result: `External API call complete (status: ${raw.status})` };
	}

	let input: Record<string, unknown> = resolvedParams;
	if (step.tool === 'send_email') {
		if (!self.email) throw new WorkflowAbortError('Could not identify the recipient (your own email address)');
		input = { ...resolvedParams, to: self.email };
	} else if (step.tool === 'get_entities') {
		// entity_type_id is not included in the catalog's params; it's set directly on step.params via the editor's "target" selector
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`No target table is selected for "${step.label}"`);
		input = { ...resolvedParams, entity_type_id: entityTypeId };
	} else if (step.tool === 'send_slack_notification') {
		// integration_id is not included in the catalog's params; it's set directly on step.params via the editor's "target" selector
		const integrationId = step.params?.integration_id;
		if (!integrationId) throw new WorkflowAbortError(`No Slack integration target is selected for "${step.label}"`);
		input = { ...resolvedParams, integration_id: integrationId };
	}

	const raw = await dispatchTool(db, step.tool as ToolName, input, env);

	if (toolDef.resultType && toolDef.extractResult) {
		results.set(step.id, { type: toolDef.resultType, value: toolDef.extractResult(raw) });
	}
	if (toolDef.listResult) {
		listResults.set(step.id, toolDef.listResult.extractList(raw));
	}
	return {};
}

async function runAction(
	db: Db,
	step: WorkflowActionStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	budget: Budget,
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<{ result?: string; attempts: number }> {
	const toolDef = getWorkflowActionTool(step.tool);
	if (!toolDef) throw new WorkflowAbortError(`Unsupported tool: ${step.tool}`);

	const resolvedParams: Record<string, string | number> = {};
	for (const field of toolDef.params) {
		const raw = step.params?.[field.key];
		if (!raw) continue;
		const value = resolveOperand(raw, results, itemStack, triggerContext, self, inputArgs).value;
		if (field.type === 'number') {
			resolvedParams[field.key] = Number(value);
		} else if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
			// The "YYYY-MM-DD" from <input type="date"> gets interpreted by new Date() as UTC midnight,
			// which is 9 hours off from JST, so explicitly attach an offset to treat it as JST wall-clock
			// time (for "until", use the end-of-day time so the whole day is included).
			resolvedParams[field.key] = `${value}T${field.key === 'until' ? '23:59:59' : '00:00:00'}+09:00`;
		} else {
			resolvedParams[field.key] = String(value);
		}
	}

	// maxRetries comes from user input, so clamp it to the ceiling with WORKFLOW_MAX_RETRIES
	// (validateWorkflow should already reject values exceeding it, but this is a second check as a
	// defense for paths that bypass validation, such as AI-generated data).
	const maxAttempts = 1 + Math.min(Math.max(step.maxRetries ?? 0, 0), WORKFLOW_MAX_RETRIES);
	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		consumeBudget(budget);
		try {
			const { result } = await performAction(db, step, toolDef, resolvedParams, results, listResults, env, self, itemStack, triggerContext, inputArgs);
			return { result, attempts: attempt };
		} catch (e) {
			lastError = e;
			// A configuration problem (no target selected, malformed JSON, etc.) will just produce the
			// same result on retry, so give up immediately.
			if (e instanceof WorkflowAbortError) break;
			if (attempt < maxAttempts) await sleep(WORKFLOW_RETRY_DELAY_MS);
		}
	}
	throw lastError;
}

/**
 * Resolves a foreach's source. `@step:<id>` (no path) uses the list of a step that statically holds
 * a listResult as-is, such as get_entities. `@step:<id>.<path>` uses resolveJsonPath to pull an array
 * out of the raw value of a step that retains raw, such as call_external_api (in place of
 * result_path/list_path — since the reference side can specify the path, there's no need to
 * pre-decide the "field to extract as a list" on the step side — 2026-07-22).
 */
function resolveForeachSource(
	stepRef: { id: string; path: string | null },
	label: string,
	results: Map<string, StepResult>,
	listResults: ListResults
): Record<string, unknown>[] {
	if (stepRef.path === null) {
		const items = listResults.get(stepRef.id);
		if (!items) throw new WorkflowAbortError(`Could not find the list result referenced by "${label}": ${stepRef.id}`);
		return items;
	}
	const found = results.get(stepRef.id);
	if (!found || found.raw === undefined) {
		throw new WorkflowAbortError(`The reference target of "${label}" cannot be referenced by field (only call_external_api supports this): ${stepRef.id}`);
	}
	const resolved = resolveJsonPath(found.raw, stepRef.path);
	if (!Array.isArray(resolved)) throw new WorkflowAbortError(`The reference target of "${label}" is not an array: ${stepRef.id}.${stepRef.path}`);
	return resolved.map((item) =>
		item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : { value: item }
	);
}

async function runForeach(
	db: Db,
	step: WorkflowForeachStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	budget: Budget,
	logs: StepLog[],
	resultObj: ResultObject,
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<void> {
	const stepRef = parseStepRef(step.source);
	if (!stepRef) throw new WorkflowAbortError(`No target is selected for "${step.label}"`);
	const items = resolveForeachSource(stepRef, step.label, results, listResults);
	for (const item of items.slice(0, WORKFLOW_FOREACH_MAX_ITEMS)) {
		await runSteps(db, step.body, results, listResults, env, self, [...itemStack, { foreachStepId: step.id, item }], budget, logs, resultObj, triggerContext, inputArgs);
	}
}

async function runSteps(
	db: Db,
	steps: WorkflowStep[],
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack = [],
	budget: Budget = { remaining: WORKFLOW_MAX_ACTIONS_PER_RUN },
	logs: StepLog[] = [],
	resultObj: ResultObject = {},
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<void> {
	for (const step of steps) {
		if (step.kind === 'action') {
			const start = Date.now();
			try {
				const { result, attempts } = await runAction(db, step, results, listResults, env, self, itemStack, budget, triggerContext, inputArgs);
				logs.push({ id: step.id, label: step.label, ok: true, result, ms: Date.now() - start, ...(attempts > 1 ? { attempts } : {}) });
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				logs.push({ id: step.id, label: step.label, ok: false, error, ms: Date.now() - start, ...(step.continueOnError ? { continued: true } : {}) });
				if (step.continueOnError) continue;
				throw e;
			}
		} else if (step.kind === 'condition') {
			const start = Date.now();
			let matched: boolean;
			try {
				const left = resolveOperand(step.left, results, itemStack, triggerContext, self, inputArgs);
				const right = resolveOperand(step.right, results, itemStack, triggerContext, self, inputArgs);
				matched = compare(left, step.operator, right);
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				logs.push({ id: step.id, label: step.label, ok: false, error, ms: Date.now() - start });
				throw e;
			}
			if (matched) {
				await runSteps(db, step.then, results, listResults, env, self, itemStack, budget, logs, resultObj, triggerContext, inputArgs);
			}
		} else if (step.kind === 'result') {
			const start = Date.now();
			try {
				consumeBudget(budget);
				if (!step.key) throw new WorkflowAbortError(`No key name is specified for "${step.label}"`);
				setResultPath(resultObj, step.key, computeSetResultValue(step.valueType, step.value, step.label, results, itemStack, triggerContext, self, inputArgs));
				logs.push({ id: step.id, label: step.label, ok: true, result: `Set "${step.key}"`, ms: Date.now() - start });
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				logs.push({ id: step.id, label: step.label, ok: false, error, ms: Date.now() - start });
				throw e;
			}
		} else {
			await runForeach(db, step, results, listResults, env, self, itemStack, budget, logs, resultObj, triggerContext, inputArgs);
		}
	}
}

export type WorkflowRunResult = { id: string; name: string; ok: boolean; error?: string; result: ResultObject };

const WORKFLOW_RUN_LOCK_PREFIX = 'workflow-run-lock:';
/**
 * A fail-safe TTL in case a lock is never released (e.g. an abnormal termination). Normally the lock
 * is released immediately via releaseRunLock when the run finishes. Set this generously enough to
 * cover WORKFLOW_MAX_ACTIONS_PER_RUN (which can include external API calls, etc.) — too short and
 * another process could acquire the lock via TTL expiry even while a run is still in progress normally.
 */
const WORKFLOW_RUN_LOCK_TTL_SECONDS = 600;

/**
 * A best-effort lock using KV to prevent "run now" and a Cron tick from running the same workflow
 * simultaneously (e.g. duplicate notification sends). KV does not provide an atomic
 * compare-and-swap, so this is not fully exclusive, but it's enough in practice to prevent the
 * realistic case of concurrent execution (duplicate firing within the same minute, double-clicking).
 * If KV is not configured (e.g. local development), execution is allowed.
 */
async function acquireRunLock(kv: KVNamespace | undefined, workflowId: string): Promise<boolean> {
	if (!kv) return true;
	const key = `${WORKFLOW_RUN_LOCK_PREFIX}${workflowId}`;
	if (await kv.get(key)) return false;
	await kv.put(key, '1', { expirationTtl: WORKFLOW_RUN_LOCK_TTL_SECONDS });
	return true;
}

async function releaseRunLock(kv: KVNamespace | undefined, workflowId: string): Promise<void> {
	if (!kv) return;
	await kv.delete(`${WORKFLOW_RUN_LOCK_PREFIX}${workflowId}`);
}

async function executeWorkflow(db: Db, workflow: WorkflowRow, env?: ToolEnv, triggerContext?: TriggerContext, inputArgs?: Record<string, unknown>): Promise<WorkflowRunResult> {
	if (!(await acquireRunLock(env?.KV, workflow.id))) {
		return {
			id: workflow.id,
			name: workflow.name,
			ok: false,
			error: 'Skipped this time because another process is already running this workflow. Please wait a moment and try again',
			result: {}
		};
	}
	const startedAt = new Date();
	const logs: StepLog[] = [];
	const resultObj: ResultObject = {};
	try {
		const account = workflow.accountId ? await getAccount(db, workflow.accountId) : null;
		// For tools like send_notification that reference env.accountId as "the notification/registration
		// recipient", pass the workflow's registrant through as the account for this run's scope
		const toolEnv: ToolEnv | undefined = workflow.accountId
			? { ...(env ?? {}), accountId: workflow.accountId }
			: env;
		const self: SelfContext = { email: account?.email ?? null, accountId: workflow.accountId ?? null };
		await runSteps(db, workflow.steps, new Map(), new Map(), toolEnv, self, [], { remaining: WORKFLOW_MAX_ACTIONS_PER_RUN }, logs, resultObj, triggerContext, inputArgs);
		await recordWorkflowRun(db, { workflowId: workflow.id, ok: true, log: logs, result: resultObj, startedAt, finishedAt: new Date() });
		return { id: workflow.id, name: workflow.name, ok: true, result: resultObj };
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await recordWorkflowRun(db, { workflowId: workflow.id, ok: false, error, log: logs, result: resultObj, startedAt, finishedAt: new Date() });
		return { id: workflow.id, name: workflow.name, ok: false, error, result: resultObj };
	} finally {
		await releaseRunLock(env?.KV, workflow.id);
	}
}

/** Called from the per-minute Cron. Runs enabled scheduled workflows matching the current JST time. */
export async function processDueWorkflows(
	db: Db,
	env?: ToolEnv,
	now: Date = new Date()
): Promise<WorkflowRunResult[]> {
	const { hour, minute } = getJstHourMinute(now);
	const due = (await getEnabledWorkflows(db)).filter(
		(w) => w.triggerType === 'schedule' && w.triggerHour === hour && w.triggerMinute === minute
	);
	return Promise.all(due.map((workflow) => executeWorkflow(db, workflow, env)));
}

/**
 * For "run now". Ignores the trigger time and enabled flag, and immediately runs the content as
 * saved in the DB as-is (not any unsaved content currently being edited on screen). Used for manual
 * runs for testing purposes, or automatic runs via an event trigger.
 */
export async function runWorkflowNow(db: Db, workflowId: string, env?: ToolEnv, triggerContext?: TriggerContext, inputArgs?: Record<string, unknown>): Promise<WorkflowRunResult> {
	const workflow = await getWorkflow(db, workflowId);
	if (!workflow) throw new Error('Workflow not found');
	return executeWorkflow(db, workflow, env, triggerContext, inputArgs);
}
