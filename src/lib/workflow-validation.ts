import type { WorkflowStep, WorkflowResultType } from './types/chat';
import {
	getWorkflowActionTool,
	parseStepRef,
	parseItemRef,
	parseTriggerRef,
	parseInputRef,
	entityListItemFields,
	triggerFieldsFor,
	preQuoteReferences,
	SELF_ACCOUNT_ID_REF,
	type WorkflowListResultField
} from './workflow-tools';
import { WORKFLOW_MAX_RETRIES } from './constants';

type EntityTypeForValidation = { id: string; fields?: WorkflowListResultField[] };
type SlackIntegrationForValidation = { id: string };
type IntegrationForValidation = { id: string };

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type VisibleStep = {
	id: string;
	label: string;
	resultType: WorkflowResultType;
	resultDesc?: string;
};

export type VisibleListStep = {
	id: string;
	label: string;
	/** null = the field structure isn't known in advance (e.g. when call_external_api is referenced as a foreach source via @step:<id>.<path>). Skips the @item reference existence check. */
	itemFields: WorkflowListResultField[] | null;
};

/** For one level of a nested foreach, the "current item" scope. Inside the body, the entire stack (all ancestor foreachs) is visible. */
export type ItemScope = {
	foreachStepId: string;
	/** null = the field structure isn't known in advance (e.g. when call_external_api is referenced as a foreach source via @step:<id>.<path>). Skips the @item reference existence check. */
	itemFields: WorkflowListResultField[] | null;
};

/**
 * For each step's position, collects the "preceding steps that can be referenced (only actions with scalar results)".
 * Results created only inside a condition's `then` or a foreach's `body` are not visible to sibling steps
 * after that block ends (because there's no guarantee the branch/loop actually ran).
 */
export function collectVisibility(
	steps: WorkflowStep[],
	visibleBefore: VisibleStep[] = []
): Map<string, VisibleStep[]> {
	const out = new Map<string, VisibleStep[]>();
	walk(steps, visibleBefore, out);
	return out;
}

function walk(steps: WorkflowStep[], visibleBefore: VisibleStep[], out: Map<string, VisibleStep[]>) {
	let visible = visibleBefore;
	for (const step of steps) {
		out.set(step.id, visible);
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (tool?.resultType) {
				visible = [...visible, { id: step.id, label: step.label, resultType: tool.resultType, resultDesc: tool.resultDesc }];
			}
		} else if (step.kind === 'condition') {
			walk(step.then, visible, out);
			// After leaving `then`, results created inside it are not exposed (visible is not updated here)
		} else if (step.kind === 'foreach') {
			walk(step.body, visible, out);
			// After leaving `body`, results created inside it are not exposed (visible is not updated here)
		}
	}
}

/** Collects the "preceding actions that return a list" that can be referenced as a foreach's `source`. Scoping rules are the same as collectVisibility. */
export function collectListVisibility(
	steps: WorkflowStep[],
	visibleBefore: VisibleListStep[] = [],
	entityTypes: EntityTypeForValidation[] = []
): Map<string, VisibleListStep[]> {
	const out = new Map<string, VisibleListStep[]>();
	walkList(steps, visibleBefore, out, entityTypes);
	return out;
}

function walkList(
	steps: WorkflowStep[],
	visibleBefore: VisibleListStep[],
	out: Map<string, VisibleListStep[]>,
	entityTypes: EntityTypeForValidation[]
) {
	let visible = visibleBefore;
	for (const step of steps) {
		out.set(step.id, visible);
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (tool?.listResult) {
				// get_entities has different fields per table, so resolve them dynamically from the selected entity_type_id
				const itemFields =
					step.tool === 'get_entities'
						? entityListItemFields(
								entityTypes.map((e) => ({ id: e.id, fields: e.fields ?? [] })),
								step.params?.entity_type_id
							)
						: tool.listResult.itemFields;
				visible = [...visible, { id: step.id, label: step.label, itemFields }];
			}
			// call_external_api is not added to listVisible: referencing `@step:<id>` (no path) does not list it,
			// and referencing it with a path (`@step:<id>.<path>`) is separately allowed in checkStep's foreach branch.
		} else if (step.kind === 'condition') {
			walkList(step.then, visible, out, entityTypes);
		} else if (step.kind === 'foreach') {
			walkList(step.body, visible, out, entityTypes);
		}
	}
}

function resolveOperandType(
	operand: string,
	visible: VisibleStep[],
	itemScopes: ItemScope[],
	triggerFields: WorkflowListResultField[] | null,
	inputFields: WorkflowListResultField[]
): { ok: true; type: WorkflowResultType } | { ok: false; error: string } {
	const itemRef = parseItemRef(operand);
	if (itemRef !== null) {
		const scope = itemRef.foreachStepId
			? itemScopes.find((s) => s.foreachStepId === itemRef.foreachStepId)
			: itemScopes[itemScopes.length - 1];
		if (!scope) return { ok: false, error: `The @item reference can only be used inside a foreach: ${operand}` };
		// itemFields===null means the structure is unknown (e.g. when call_external_api is referenced as a foreach
		// source via @step:<id>.<path>); skip the existence check in that case
		if (scope.itemFields && !scope.itemFields.some((f) => f.key === itemRef.field)) {
			return { ok: false, error: `No such item field: ${itemRef.field}` };
		}
		return { ok: true, type: 'string' };
	}
	const triggerField = parseTriggerRef(operand);
	if (triggerField !== null) {
		if (!triggerFields) return { ok: false, error: `The @trigger reference can only be used with an event trigger: ${operand}` };
		if (!triggerFields.some((f) => f.key === triggerField)) {
			return { ok: false, error: `No such field on the trigger record: ${triggerField}` };
		}
		return { ok: true, type: 'string' };
	}
	const inputField = parseInputRef(operand);
	if (inputField !== null) {
		if (!inputFields.some((f) => f.key === inputField)) {
			return { ok: false, error: `Undeclared input parameter: ${inputField}` };
		}
		return { ok: true, type: 'string' };
	}
	if (operand === SELF_ACCOUNT_ID_REF) return { ok: true, type: 'string' };
	const stepRef = parseStepRef(operand);
	if (stepRef === null) return { ok: true, type: 'string' }; // treat literals as strings
	const found = visible.find((v) => v.id === stepRef.id);
	if (!found) return { ok: false, error: `Referenced step not found (or is out of scope): ${stepRef.id}` };
	// A path reference (@step:<id>.<path>) can't have its type determined statically, so treat it as string
	// (existence check skipped too, same policy as the @item unknown-structure case). Runtime errors
	// (e.g. missing field) are caught on the run.ts side.
	if (stepRef.path !== null) return { ok: true, type: 'string' };
	return { ok: true, type: found.resultType };
}

export function validateWorkflow(
	triggerType: 'schedule' | 'event' | 'mcp_tool' = 'schedule',
	triggerHour: number,
	triggerMinute: number,
	triggerEntityTypeId: string | null | undefined,
	steps: WorkflowStep[],
	entityTypes: EntityTypeForValidation[] = [],
	slackIntegrations: SlackIntegrationForValidation[] = [],
	inputSchema: { key: string; label: string }[] = [],
	integrations: IntegrationForValidation[] = []
): ValidationResult {
	const errors: string[] = [];
	const entityTypeIds = new Set(entityTypes.map((e) => e.id));
	const slackIntegrationIds = new Set(slackIntegrations.map((s) => s.id));
	const integrationIds = new Set(integrations.map((i) => i.id));
	const triggerFields =
		triggerType === 'event'
			? triggerFieldsFor(
					entityTypes.map((e) => ({ id: e.id, fields: e.fields ?? [] })),
					triggerEntityTypeId
				)
			: null;

	if (triggerType === 'schedule') {
		if (!Number.isInteger(triggerHour) || triggerHour < 0 || triggerHour > 23) {
			errors.push('The trigger time (hour) is invalid');
		}
		if (!Number.isInteger(triggerMinute) || triggerMinute < 0 || triggerMinute > 59) {
			errors.push('The trigger time (minute) is invalid');
		}
	}
	if (steps.length === 0) {
		errors.push('There are no steps');
	}

	const visibility = collectVisibility(steps);
	const listVisibility = collectListVisibility(steps, [], entityTypes);

	function checkStep(step: WorkflowStep, itemScopes: ItemScope[]) {
		const visible = visibility.get(step.id) ?? [];
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (!tool) {
				errors.push(`No action is selected for "${step.label}"`);
				return;
			}
			if (tool.value === 'get_entities') {
				const entityTypeId = step.params?.entity_type_id;
				if (!entityTypeId || !entityTypeIds.has(entityTypeId)) {
					errors.push(`The target table for "${step.label}" was not found (it may have been deleted)`);
				}
			}
			if (tool.value === 'send_slack_notification') {
				const integrationId = step.params?.integration_id;
				if (!integrationId || !slackIntegrationIds.has(integrationId)) {
					errors.push(`The Slack integration target for "${step.label}" was not found (it may have been deleted)`);
				}
			}
			if (tool.value === 'call_external_api') {
				const integrationId = step.params?.integration_id;
				if (!integrationId || !integrationIds.has(integrationId)) {
					errors.push(`The external API integration target for "${step.label}" was not found (it may have been deleted)`);
				}
			}
			if (step.maxRetries !== undefined && (!Number.isInteger(step.maxRetries) || step.maxRetries < 0 || step.maxRetries > WORKFLOW_MAX_RETRIES)) {
				errors.push(`The retry count for "${step.label}" must be between 0 and ${WORKFLOW_MAX_RETRIES}`);
			}
			for (const field of tool.params) {
				const value = step.params?.[field.key];
				if (field.required && !value) {
					errors.push(`"${field.label}" is required for "${step.label}"`);
					continue;
				}
				if (value) {
					const resolved = resolveOperandType(value, visible, itemScopes, triggerFields, inputSchema);
					if (!resolved.ok) errors.push(`"${field.label}" of "${step.label}": ${resolved.error}`);
					// Validated at save time using the same rules as run.ts's runtime parsing
					// (preQuoteReferences -> JSON.parse), to catch JSON format issues before runtime.
					if (field.jsonFormat) {
						try {
							JSON.parse(preQuoteReferences(value));
						} catch {
							errors.push(`"${field.label}" of "${step.label}" is not valid JSON`);
						}
					}
				}
			}
		} else if (step.kind === 'condition') {
			if (!step.left) {
				errors.push(`No condition target is selected for "${step.label}"`);
			} else if (
				parseStepRef(step.left) === null &&
				parseItemRef(step.left) === null &&
				parseTriggerRef(step.left) === null &&
				parseInputRef(step.left) === null &&
				step.left !== SELF_ACCOUNT_ID_REF
			) {
				errors.push(`The condition target for "${step.label}" must be one of: a preceding step's result, @item, @trigger, @input, or @self`);
			} else {
				const leftResolved = resolveOperandType(step.left, visible, itemScopes, triggerFields, inputSchema);
				if (!leftResolved.ok) errors.push(`Condition target of "${step.label}": ${leftResolved.error}`);
			}
			if (!step.right) {
				errors.push(`The comparison value for "${step.label}" is empty`);
			} else {
				const rightResolved = resolveOperandType(step.right, visible, itemScopes, triggerFields, inputSchema);
				if (!rightResolved.ok) errors.push(`Comparison value of "${step.label}": ${rightResolved.error}`);
			}
			if (step.then.length === 0) {
				errors.push(`There are no steps for the "Yes" branch of "${step.label}"`);
			}
			for (const child of step.then) checkStep(child, itemScopes);
		} else if (step.kind === 'result') {
			if (!step.key) {
				errors.push(`The key name for "${step.label}" is empty`);
			} else if (step.key.split('.').some((seg) => !seg)) {
				// The key uses dot notation to express nesting (e.g. "user.name"). Empty segments (leading/trailing
				// dot, consecutive dots) are invalid.
				errors.push(`The key name for "${step.label}" has an invalid format (empty segments are not allowed)`);
			}
			if (!step.value) {
				errors.push(`The value for "${step.label}" is empty`);
			} else if (step.valueType === 'array') {
				// The editor always writes a JSON.stringify'd string array, so reject anything else (e.g. AI-generated data) at save time
				let parsedArray: unknown;
				try {
					parsedArray = JSON.parse(step.value);
				} catch {
					parsedArray = undefined;
				}
				if (!Array.isArray(parsedArray) || !parsedArray.every((v) => typeof v === 'string')) {
					errors.push(`The value for "${step.label}" must be an array of strings (in JSON format)`);
				}
			} else {
				const resolved = resolveOperandType(step.value, visible, itemScopes, triggerFields, inputSchema);
				if (!resolved.ok) errors.push(`Value of "${step.label}": ${resolved.error}`);
			}
		} else {
			const stepRef = parseStepRef(step.source);
			const listVisible = listVisibility.get(step.id) ?? [];
			const sourceStep = stepRef !== null && stepRef.path === null ? listVisible.find((v) => v.id === stepRef.id) : undefined;
			// A path reference (@step:<id>.<path>) can't be determined to be an array without running it, so
			// allow it statically (same policy as the @item unknown-structure case; specifying something other
			// than call_external_api etc. will error out on the run.ts side).
			const pathBasedSource = stepRef !== null && stepRef.path !== null;
			if (!step.source) {
				errors.push(`No target (list) is selected for "${step.label}"`);
			} else if (!sourceStep && !pathBasedSource) {
				errors.push(`The target for "${step.label}" must be a preceding step that returns a list`);
			}
			if (step.body.length === 0) {
				errors.push(`There is nothing to repeat for "${step.label}"`);
			}
			const bodyItemScopes = sourceStep
				? [...itemScopes, { foreachStepId: step.id, itemFields: sourceStep.itemFields }]
				: pathBasedSource
					? [...itemScopes, { foreachStepId: step.id, itemFields: null }]
					: itemScopes;
			for (const child of step.body) checkStep(child, bodyItemScopes);
		}
	}

	for (const step of steps) checkStep(step, []);

	return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
