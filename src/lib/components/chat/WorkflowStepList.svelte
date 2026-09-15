<script lang="ts">
	import type { WorkflowStep } from '$lib/types/chat';
	import {
		WORKFLOW_ACTION_CATEGORIES,
		WORKFLOW_OPERATORS,
		getWorkflowActionTool,
		findWorkflowActionCategory,
		parseStepRef,
		makeTriggerRef,
		makeInputRef,
		entityListItemFields,
		SELF_ACCOUNT_ID_REF,
		type WorkflowListResultField
	} from '$lib/workflow-tools';
	import { WORKFLOW_MAX_RETRIES } from '$lib/constants';
	import type { VisibleStep, VisibleListStep } from '$lib/workflow-validation';
	import type { EntityTypeForWorkflow } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';
	import type { ExternalApiConnectionOption } from '$lib/server/db/external-api-connection-service';
	import GripVertical from '$lib/components/icon/GripVertical.svelte';
	import InfoCircle from '$lib/components/icon/InfoCircle.svelte';
	import WorkflowStepList from './WorkflowStepList.svelte';

	/** The "current item" scope for one level of a nested foreach. Inside the body, this whole stack (all ancestor foreachs) can be referenced.
	 *  itemFields===null means the field structure isn't known in advance (e.g. when call_external_api is specified as the source via @step:<id>.<path>). */
	type ItemScope = { foreachStepId: string; label: string; itemFields: WorkflowListResultField[] | null };

	type Props = {
		steps: WorkflowStep[];
		visibleBefore: VisibleStep[];
		listVisibleBefore: VisibleListStep[];
		itemScopes: ItemScope[];
		editable: boolean;
		depth: number;
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
		integrations?: ExternalApiConnectionOption[];
		/** List of fields referenceable as @trigger:<field> on an event trigger (empty if the trigger is schedule) */
		triggerFields?: WorkflowListResultField[];
		/** List of declared input parameters, referenceable as @input:<key> */
		inputFields?: WorkflowListResultField[];
	};

	let {
		steps,
		visibleBefore,
		listVisibleBefore,
		itemScopes,
		editable,
		depth,
		entityTypes = [],
		slackIntegrations = [],
		integrations = [],
		triggerFields = [],
		inputFields = []
	}: Props = $props();

	// Step ids are often entered manually via @step:<id>, makeItemRef, etc., so use short alphanumerics
	// instead of UUIDs (the id itself must not contain a dot, since parseStepRef uses the first "." as the id/path separator).
	const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

	function randomShortId(length = 4): string {
		let s = '';
		for (let i = 0; i < length; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
		return s;
	}

	function collectAllStepIds(list: WorkflowStep[]): Set<string> {
		const ids = new Set<string>();
		function walk(l: WorkflowStep[]) {
			for (const s of l) {
				ids.add(s.id);
				if (s.kind === 'condition') walk(s.then);
				else if (s.kind === 'foreach') walk(s.body);
			}
		}
		walk(list);
		return ids;
	}

	function makeId(): string {
		// This component instance only holds the current scope (steps), but ids must be unique across
		// the whole workflow, which would require walking back up to the caller's root to collect every
		// step id. Since there's no way to traverse the whole tree from visibleBefore etc., in practice
		// we only avoid collisions within this scope (4 chars, 36^4 combinations, so the chance of
		// colliding with another scope is negligible).
		const existing = collectAllStepIds(steps);
		let id = randomShortId();
		while (existing.has(id)) id = randomShortId();
		return id;
	}

	function addStep(kind: 'action' | 'condition' | 'foreach' | 'result') {
		if (kind === 'action') {
			steps.push({ id: makeId(), kind: 'action', label: 'New action', tool: '', params: {} });
		} else if (kind === 'condition') {
			steps.push({
				id: makeId(),
				kind: 'condition',
				label: 'New condition',
				left: '',
				operator: '==',
				right: '',
				then: []
			});
		} else if (kind === 'result') {
			steps.push({ id: makeId(), kind: 'result', label: 'New response setting', key: '', valueType: 'scalar', value: '' });
		} else {
			steps.push({ id: makeId(), kind: 'foreach', label: 'New loop', source: '', body: [] });
		}
	}

	function removeStep(index: number) {
		const step = steps[index];
		if (!confirm(`Delete "${step.label}"? Are you sure?`)) return;
		steps.splice(index, 1);
	}

	function visibleUpTo(index: number): VisibleStep[] {
		const visible = [...visibleBefore];
		for (let i = 0; i < index; i++) {
			const s = steps[i];
			if (s.kind === 'action') {
				const tool = getWorkflowActionTool(s.tool);
				if (tool?.resultType) {
					visible.push({ id: s.id, label: s.label, resultType: tool.resultType, resultDesc: tool.resultDesc });
				}
			}
		}
		return visible;
	}

	function visibleListUpTo(index: number): VisibleListStep[] {
		const visible = [...listVisibleBefore];
		for (let i = 0; i < index; i++) {
			const s = steps[i];
			if (s.kind === 'action') {
				const tool = getWorkflowActionTool(s.tool);
				if (tool?.listResult) {
					// get_entities' fields differ per table, so resolve them dynamically from the selected entity_type_id
					const itemFields =
						s.tool === 'get_entities' ? entityListItemFields(entityTypes, s.params?.entity_type_id) : tool.listResult.itemFields;
					visible.push({ id: s.id, label: s.label, itemFields });
				}
				// call_external_api is not listed here: it's not shown in the list via `@step:<id>` (no path);
				// when referenced with a path as `@step:<id>.<path>`, it's separately allowed on the foreach's source side.
			}
		}
		return visible;
	}

	/**
	 * Flattens the "current item" fields referenceable at this step's position, from all ancestor
	 * foreachs (itemScopes), into a single list (for display in the "Available variables here" help
	 * panel only — values must still be entered directly).
	 */
	type ItemOption = { foreachStepId: string; field: WorkflowListResultField; scopeLabel: string };

	function flatItemOptions(): ItemOption[] {
		return itemScopes.flatMap((scope) =>
			(scope.itemFields ?? []).map((f) => ({ foreachStepId: scope.foreachStepId, field: f, scopeLabel: scope.label }))
		);
	}

	function itemToken(opt: ItemOption): string {
		return `@item:${opt.foreachStepId}:${opt.field.key}`;
	}

	function triggerToken(field: WorkflowListResultField): string {
		return makeTriggerRef(field.key);
	}

	function inputToken(field: WorkflowListResultField): string {
		return makeInputRef(field.key);
	}

	// Temporary state for remembering the category of a step that is mid-category-selection
	// (target not yet selected and tool still empty). Once tool is set, the category can always be
	// looked up from it, so this is only used while it's undetermined.
	let pendingCategory = $state<Record<string, string>>({});

	// Optional parameters the user has explicitly opened (step id -> Set of parameter keys)
	let openedParams = $state<Record<string, Set<string>>>({});

	function isParamShown(
		stepId: string,
		fieldKey: string,
		hasValue: boolean,
		required: boolean,
		alwaysShow: boolean
	): boolean {
		if (required || alwaysShow) return true;
		if (hasValue) return true;
		return openedParams[stepId]?.has(fieldKey) ?? false;
	}

	function openParam(stepId: string, key: string) {
		if (!openedParams[stepId]) openedParams[stepId] = new Set();
		openedParams[stepId] = new Set([...openedParams[stepId], key]);
	}

	// result step only: the "value" field. When valueType is 'array', step.value is kept as a
	// JSON-stringified array of strings (the editor always quotes correctly, so run.ts just needs to JSON.parse it).
	function parseResultArrayValue(raw: string | undefined): string[] {
		if (!raw) return [''];
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) && parsed.length > 0 ? parsed.map((v) => String(v)) : [''];
		} catch {
			return [''];
		}
	}

	function writeResultArrayValue(step: { value: string }, items: string[]) {
		step.value = JSON.stringify(items);
	}

	function updateResultArrayItem(step: { value: string }, index: number, value: string) {
		const items = parseResultArrayValue(step.value);
		items[index] = value;
		writeResultArrayValue(step, items);
	}

	function addResultArrayItem(step: { value: string }) {
		const items = parseResultArrayValue(step.value);
		items.push('');
		writeResultArrayValue(step, items);
	}

	function removeResultArrayItem(step: { value: string }, index: number) {
		const items = parseResultArrayValue(step.value);
		items.splice(index, 1);
		writeResultArrayValue(step, items.length > 0 ? items : ['']);
	}

	function closeParam(step: { id: string; params?: Record<string, string> }, key: string) {
		if (step.params) delete step.params[key];
		const s = openedParams[step.id];
		if (s) {
			s.delete(key);
			openedParams[step.id] = new Set(s);
		}
	}

	// When the same tool is referenced from multiple categories, step.category remembers which
	// category to display it under after reload. Unset (AI-generated or legacy data) falls back to looking it up from tool.
	function currentCategoryKey(step: { id: string; tool: string; category?: string }): string {
		if (step.tool) return step.category ?? findWorkflowActionCategory(step.tool)?.key ?? '';
		return pendingCategory[step.id] ?? '';
	}

	/** The category's list of targets. When includeEntityTargets/includeSlackTargets/includeIntegrationTargets
	 *  are set, adds tables, Slack integrations, and external API integrations alongside the fixed targets. */
	function effectiveTargets(category: {
		targets: { value: string; label: string; tool: string }[];
		includeEntityTargets?: boolean;
		entityTargetTool?: string;
		includeSlackTargets?: boolean;
		includeIntegrationTargets?: boolean;
	}) {
		const base = category.targets.map((t) => ({ value: t.tool, label: t.label }));
		const entityTargets = category.includeEntityTargets
			? entityTypes.map((et) => ({ value: `entity:${et.id}`, label: et.label }))
			: [];
		const slackTargets = category.includeSlackTargets
			? slackIntegrations.map((s) => ({ value: `slack:${s.id}`, label: s.name }))
			: [];
		const integrationTargets = category.includeIntegrationTargets
			? integrations.map((it) => ({ value: `api:${it.id}`, label: it.name }))
			: [];
		return [...base, ...entityTargets, ...slackTargets, ...integrationTargets];
	}

	const ENTITY_WRITE_TOOLS = new Set(['get_entities', 'create_entity', 'update_entity', 'delete_entity']);

	/** The target select's current value. For entity-operation tools, converts from params to `entity:<id>` form. */
	function currentTargetValue(step: { tool: string; params?: Record<string, string> }): string {
		if (ENTITY_WRITE_TOOLS.has(step.tool)) return `entity:${step.params?.entity_type_id ?? ''}`;
		if (step.tool === 'send_slack_notification') return `slack:${step.params?.integration_id ?? ''}`;
		if (step.tool === 'call_external_api') return `api:${step.params?.integration_id ?? ''}`;
		return step.tool;
	}

	function applyTargetSelection(
		step: { tool: string; params?: Record<string, string>; category?: string },
		value: string,
		categoryKey: string
	) {
		if (value.startsWith('entity:')) {
			const category = WORKFLOW_ACTION_CATEGORIES.find((c) => c.key === categoryKey);
			step.tool = category?.entityTargetTool ?? 'get_entities';
			step.params = { entity_type_id: value.slice('entity:'.length) };
		} else if (value.startsWith('slack:')) {
			step.tool = 'send_slack_notification';
			step.params = { integration_id: value.slice('slack:'.length) };
		} else if (value.startsWith('api:')) {
			step.tool = 'call_external_api';
			step.params = { integration_id: value.slice('api:'.length) };
		} else {
			step.tool = value;
			step.params = {};
		}
		step.category = categoryKey;
	}

	// Open/closed state of the "Available variables here" help panel (per step)
	let helpOpenFor = $state<Record<string, boolean>>({});

	function toggleHelp(stepId: string) {
		helpOpenFor[stepId] = !helpOpenFor[stepId];
	}

	// Drag-and-drop reordering (within the same steps array, i.e. the same scope only)
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, index: number) {
		draggedIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (draggedIndex === null) return;
		e.preventDefault();
		dragOverIndex = index;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, to: number) {
		e.preventDefault();
		const from = draggedIndex;
		draggedIndex = null;
		dragOverIndex = null;
		if (from === null || from === to) return;
		const [moved] = steps.splice(from, 1);
		const insertIndex = from < to ? to - 1 : to;
		steps.splice(insertIndex, 0, moved);
	}
</script>

<div class="wf-steps">
	{#each steps as step, i (step.id)}
		{@const visible = visibleUpTo(i)}
		{@const itemOpts = flatItemOptions()}
		<div
			class="wf-step t-{step.kind}"
			class:dragging={editable && draggedIndex === i}
			class:drag-over={editable && dragOverIndex === i && draggedIndex !== i}
			ondragover={editable ? (e) => handleDragOver(e, i) : undefined}
			ondrop={editable ? (e) => handleDrop(e, i) : undefined}
			role="group"
		>
			<div class="wf-step-row">
				{#if editable}
					<span
						class="wf-drag-handle"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, i)}
						ondragend={handleDragEnd}
						title="Drag to reorder"
						role="button"
						tabindex="0"
					>
						<GripVertical size={14} />
					</span>
				{/if}
				<span class="wf-step-no">{i + 1}.</span>
				<input
					type="text"
					class="wf-label-input"
					value={step.label}
					disabled={!editable}
					oninput={(e) => (step.label = e.currentTarget.value)}
				/>

				{#if step.kind === 'action'}
					{@const categoryKey = currentCategoryKey(step)}
					{@const category = WORKFLOW_ACTION_CATEGORIES.find((c) => c.key === categoryKey)}
					<select
						value={categoryKey}
						disabled={!editable}
						onchange={(e) => {
							pendingCategory[step.id] = e.currentTarget.value;
							step.tool = '';
							step.params = {};
							step.category = undefined;
						}}
					>
						<option value="">Select category</option>
						{#each WORKFLOW_ACTION_CATEGORIES as c (c.key)}
							<option value={c.key}>{c.label}</option>
						{/each}
					</select>
					{#if category}
						<select
							value={currentTargetValue(step)}
							disabled={!editable}
							onchange={(e) => applyTargetSelection(step, e.currentTarget.value, categoryKey)}
						>
							<option value="">Select target</option>
							{#each effectiveTargets(category) as t (t.value)}
								<option value={t.value}>{t.label}</option>
							{/each}
						</select>
					{/if}
				{/if}

				<button
					type="button"
					class="wf-help-btn"
					class:active={helpOpenFor[step.id]}
					onclick={() => toggleHelp(step.id)}
					title="View variables available here"
				>
					<InfoCircle size={14} />
				</button>

				{#if editable}
					<button class="wf-del" onclick={() => removeStep(i)}>×</button>
				{/if}
			</div>

			{#if helpOpenFor[step.id]}
				<div class="wf-help-panel">
					<div class="wf-help-title">Variables available here</div>
					<ul class="wf-help-list">
						{#each visible as v (v.id)}
							<li>
								<span class="wf-help-name">{v.label}</span>{v.resultDesc ? `（${v.resultDesc}）` : ''}
								<code class="wf-help-token">@step:{v.id}</code>
							</li>
						{/each}
						{#each itemOpts as opt (opt.foreachStepId + ':' + opt.field.key)}
							<li>
								<span class="wf-help-name">{opt.field.label}</span>
								<code class="wf-help-token">{itemToken(opt)}</code>
							</li>
						{/each}
						{#each itemScopes.filter((s) => s.itemFields === null) as scope (scope.foreachStepId)}
							<li>
								<span class="wf-help-name">{scope.label} item (field structure unknown; type it manually into the "direct input" field below in this format)</span>
								<code class="wf-help-token">@item:{scope.foreachStepId}:&lt;field name&gt;</code>
							</li>
						{/each}
						{#each triggerFields as f, tfi (tfi)}
							<li>
								<span class="wf-help-name">{f.label} (trigger record)</span>
								<code class="wf-help-token">{triggerToken(f)}</code>
							</li>
						{/each}
						{#each inputFields as f, ifi (ifi)}
							<li>
								<span class="wf-help-name">{f.label} (input parameter)</span>
								<code class="wf-help-token">{inputToken(f)}</code>
							</li>
						{/each}
						<li>
							<span class="wf-help-name">Your own (the workflow owner's) account ID</span>
							<code class="wf-help-token">{SELF_ACCOUNT_ID_REF}</code>
						</li>
					</ul>
				</div>
			{/if}

			{#if step.kind === 'action'}
				{@const tool = getWorkflowActionTool(step.tool)}
				{#if tool}
					{#each tool.params as field (field.key)}
						{@const fieldVal = step.params?.[field.key] ?? ''}
						{@const hasValue = fieldVal !== '' && fieldVal != null}
						{@const shown = isParamShown(step.id, field.key, hasValue, !!field.required, !!field.alwaysShow)}
						{#if shown}
							<div class="wf-line wf-param" class:wf-param-optional={!field.required}>
								<label for="wf-param-{step.id}-{field.key}">{field.label}</label>
								{#if field.type === 'select'}
									<select
										id="wf-param-{step.id}-{field.key}"
										value={fieldVal}
										disabled={!editable}
										onchange={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									>
										{#each field.options ?? [] as opt (opt.value)}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else if field.type === 'textarea'}
									<textarea
										id="wf-param-{step.id}-{field.key}"
										value={fieldVal}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									></textarea>
								{:else if field.type === 'number'}
									<input
										id="wf-param-{step.id}-{field.key}"
										type="number"
										value={fieldVal}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
								{:else if field.type === 'date'}
									<input
										id="wf-param-{step.id}-{field.key}"
										type="date"
										value={fieldVal}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
								{:else}
									<input
										id="wf-param-{step.id}-{field.key}"
										type="text"
										value={fieldVal}
										disabled={!editable}
										oninput={(e) => {
											if (!step.params) step.params = {};
											step.params[field.key] = e.currentTarget.value;
										}}
									/>
								{/if}
								{#if editable && !field.required && !field.alwaysShow}
									<button
										class="wf-param-del"
										onclick={() => closeParam(step, field.key)}
										title="Remove this parameter"
									>×</button>
								{/if}
							</div>
						{/if}
					{/each}
					{#if editable}
						{@const hiddenOptional = tool.params.filter(
							(f) => !isParamShown(step.id, f.key, !!(step.params?.[f.key] ?? ''), !!f.required, !!f.alwaysShow)
						)}
						{#if hiddenOptional.length > 0}
							<div class="wf-line wf-add-param">
								<select
									value=""
									onchange={(e) => {
										const key = e.currentTarget.value;
										if (key) {
											openParam(step.id, key);
											e.currentTarget.value = '';
										}
									}}
								>
									<option value="">+ Add option...</option>
									{#each hiddenOptional as f (f.key)}
										<option value={f.key}>{f.label}</option>
									{/each}
								</select>
							</div>
						{/if}
					{/if}

					<div class="wf-line wf-error-handling">
						<label for="wf-retry-{step.id}">Retry count on failure</label>
						<input
							id="wf-retry-{step.id}"
							type="number"
							min="0"
							max={WORKFLOW_MAX_RETRIES}
							value={step.maxRetries ?? 0}
							disabled={!editable}
							oninput={(e) => {
								const n = Number(e.currentTarget.value);
								step.maxRetries = Number.isFinite(n) ? Math.max(0, Math.min(WORKFLOW_MAX_RETRIES, n)) : 0;
							}}
						/>
						<label class="wf-continue-on-error">
							<input
								type="checkbox"
								checked={!!step.continueOnError}
								disabled={!editable}
								onchange={(e) => (step.continueOnError = e.currentTarget.checked)}
							/>
							Continue with subsequent steps even on failure
						</label>
					</div>
				{/if}
			{:else if step.kind === 'condition'}
				<div class="wf-line wf-cond-line">
					<span class="wf-cond-label">Condition:</span>
					<input
						type="text"
						placeholder="e.g. @step:xxx / @item:xxx:yyy"
						value={step.left}
						disabled={!editable}
						oninput={(e) => (step.left = e.currentTarget.value)}
					/>
					<select
						value={step.operator}
						disabled={!editable}
						onchange={(e) => (step.operator = e.currentTarget.value as typeof step.operator)}
					>
						{#each WORKFLOW_OPERATORS as op (op.value)}
							<option value={op.value}>{op.label}</option>
						{/each}
					</select>
					<input
						type="text"
						placeholder="Direct input or e.g. @step:xxx"
						value={step.right}
						disabled={!editable}
						oninput={(e) => (step.right = e.currentTarget.value)}
					/>
				</div>
			{:else if step.kind === 'result'}
				<div class="wf-line wf-result-line">
					<span class="wf-cond-label">Key:</span>
					<input
						type="text"
						placeholder="Response key name (e.g. user.name for nesting)"
						value={step.key}
						disabled={!editable}
						oninput={(e) => (step.key = e.currentTarget.value)}
					/>
					<select
						value={step.valueType}
						disabled={!editable}
						onchange={(e) => {
							step.valueType = e.currentTarget.value as typeof step.valueType;
							step.value = '';
						}}
					>
						<option value="scalar">Scalar</option>
						<option value="array">Array</option>
					</select>
				</div>
				<div class="wf-line wf-result-value">
					<span class="wf-cond-label">Value:</span>
					{#if step.valueType === 'array'}
						<div class="wf-result-array">
							{#each parseResultArrayValue(step.value) as itemVal, idx (idx)}
								<div class="wf-result-array-row">
									<input
										type="text"
										value={itemVal}
										disabled={!editable}
										placeholder="Direct input or e.g. @step:xxx"
										oninput={(e) => updateResultArrayItem(step, idx, e.currentTarget.value)}
									/>
									{#if editable}
										<button
											type="button"
											class="wf-param-del"
											onclick={() => removeResultArrayItem(step, idx)}
											title="Remove this item"
										>×</button>
									{/if}
								</div>
							{/each}
							{#if editable}
								<button type="button" class="wf-result-array-add" onclick={() => addResultArrayItem(step)}>
									+ Add item
								</button>
							{/if}
						</div>
					{:else}
						<input
							type="text"
							class="wf-result-scalar-input"
							value={step.value}
							disabled={!editable}
							placeholder="Direct input or e.g. @step:xxx"
							oninput={(e) => (step.value = e.currentTarget.value)}
						/>
					{/if}
				</div>
			{:else}
				<div class="wf-line wf-foreach-line">
					<span class="wf-cond-label">Target:</span>
					<input
						type="text"
						placeholder="@step:xxx (a step that returns a list), or @step:xxx.data.items (specifying a call_external_api array)"
						value={step.source}
						disabled={!editable}
						oninput={(e) => (step.source = e.currentTarget.value)}
					/>
				</div>
			{/if}

			{#if step.kind === 'condition'}
				<div class="wf-then">
					<WorkflowStepList
						steps={step.then}
						visibleBefore={visible}
						{listVisibleBefore}
						{itemScopes}
						{editable}
						{entityTypes}
						{slackIntegrations}
						{integrations}
						{triggerFields}
						{inputFields}
						depth={depth + 1}
					/>
				</div>
			{:else if step.kind === 'foreach'}
				{@const listVisible = visibleListUpTo(i)}
				{@const stepRef = parseStepRef(step.source)}
				{@const sourceVisible = stepRef && stepRef.path === null ? listVisible.find((v) => v.id === stepRef.id) : undefined}
				{@const pathBasedSource = !!stepRef && stepRef.path !== null}
				<div class="wf-then">
					<WorkflowStepList
						steps={step.body}
						visibleBefore={visible}
						listVisibleBefore={listVisible}
						itemScopes={sourceVisible
							? [...itemScopes, { foreachStepId: step.id, label: step.label, itemFields: sourceVisible.itemFields }]
							: pathBasedSource
								? [...itemScopes, { foreachStepId: step.id, label: step.label, itemFields: null }]
								: itemScopes}
						{editable}
						{entityTypes}
						{slackIntegrations}
						{integrations}
						{triggerFields}
						{inputFields}
						depth={depth + 1}
					/>
				</div>
			{/if}
		</div>
	{/each}

	{#if editable && draggedIndex !== null}
		<div
			class="wf-drop-end"
			class:drag-over={dragOverIndex === steps.length}
			ondragover={(e) => handleDragOver(e, steps.length)}
			ondrop={(e) => handleDrop(e, steps.length)}
			role="group"
		></div>
	{/if}

	{#if editable}
		<div class="wf-add-row">
			<button class="btn-add t-action" onclick={() => addStep('action')}>+ Action</button>
			<button class="btn-add t-condition" onclick={() => addStep('condition')}>+ Condition</button>
			<button class="btn-add t-foreach" onclick={() => addStep('foreach')}>+ Loop</button>
			<button class="btn-add t-result" onclick={() => addStep('result')}>+ Response</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.wf-steps {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.wf-step {
		border-left: 2px solid var(--color-border);
		padding-left: 10px;
		border-radius: 0 4px 4px 0;
		transition: background-color 0.1s, opacity 0.1s;

		&.t-condition {
			border-left-color: #d57c30;
		}

		&.t-foreach {
			border-left-color: var(--color-info);
		}

		&.t-result {
			border-left-color: #6366f1;
		}

		&.dragging {
			opacity: 0.4;
		}

		&.drag-over {
			background: var(--color-primary-soft, rgba(99, 102, 241, 0.08));
			outline: 1px dashed var(--color-primary);
			outline-offset: -1px;
		}
	}

	.wf-step-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		padding: 4px 0;
	}

	.wf-drag-handle {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--color-text-muted);
		cursor: grab;
		&:hover {
			color: var(--color-text);
		}
		&:active {
			cursor: grabbing;
		}
	}

	.wf-step-no {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.wf-label-input {
		font-weight: 600;
		min-width: 140px;
		flex: 1 1 160px;
	}

	.wf-cond-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.wf-line {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		flex-wrap: wrap;
		padding: 2px 0 2px 22px;
	}

	input,
	select,
	textarea {
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.8125rem;
		&:focus {
			outline: none;
			border-color: var(--color-primary);
		}
		&:disabled {
			opacity: 0.7;
		}
	}

	textarea {
		min-width: 220px;
		min-height: 32px;
	}

	.wf-param {
		input[type='text'] {
			min-width: 360px;
			flex: 1 1 360px;
		}
		textarea {
			min-width: 360px;
			min-height: 90px;
			flex: 1 1 360px;
		}
	}

	.wf-param label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.wf-param-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 13px;
		padding: 0 2px;
		line-height: 1;
		margin-left: 2px;
		flex-shrink: 0;
		&:hover { color: #ef4444; }
	}

	.wf-add-param select {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dashed var(--color-border);
		padding: 3px 8px;
		cursor: pointer;
		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}
	}

	.wf-result-array {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 360px;
	}

	.wf-result-array-row {
		display: flex;
		align-items: center;
		gap: 4px;
		input[type='text'] {
			min-width: 360px;
			flex: 1 1 360px;
		}
	}

	.wf-result-scalar-input {
		min-width: 360px;
		flex: 1 1 360px;
	}

	.wf-result-array-add {
		align-self: flex-start;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dashed var(--color-border);
		padding: 3px 8px;
		border-radius: 4px;
		cursor: pointer;
		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}
	}

	.wf-error-handling {
		align-items: center;
		label {
			font-size: 0.75rem;
			color: var(--color-text-muted);
			white-space: nowrap;
		}
		input[type='number'] {
			width: 56px;
		}
		.wf-continue-on-error {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			margin-left: 8px;
			input[type='checkbox'] {
				width: auto;
			}
		}
	}

	.wf-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
		margin-left: auto;
		&:hover {
			color: #ef4444;
		}
	}

	.wf-help-btn {
		display: flex;
		align-items: center;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 2px;
		flex-shrink: 0;
		&:hover,
		&.active {
			color: var(--color-primary);
		}
	}

	.wf-help-panel {
		margin: 2px 0 4px 22px;
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
	}

	.wf-help-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin-bottom: 4px;
	}

	.wf-help-empty {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.wf-help-list {
		margin: 0;
		padding-left: 18px;
		font-size: 0.8125rem;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.wf-help-name {
		font-weight: 600;
	}

	.wf-help-token {
		font-family: ui-monospace, monospace;
		font-size: 0.87rem;
		color: var(--color-text-muted);
	}

	.wf-then {
		margin: 4px 0 8px 16px;
		padding-left: 10px;
		border-left: 1px dashed var(--color-border);
	}

	.wf-drop-end {
		height: 10px;
		border-radius: 4px;
		margin: 2px 0;

		&.drag-over {
			background: var(--color-primary-soft, rgba(99, 102, 241, 0.08));
			outline: 1px dashed var(--color-primary);
			outline-offset: -1px;
		}
	}

	.wf-add-row {
		display: flex;
		gap: 6px;
		margin-top: 2px;
	}

	.btn-add {
		padding: 3px 10px;
		border-radius: 5px;
		font-size: 0.75rem;
		border: 1px solid;
		cursor: pointer;
		color: #fff;
		&:hover {
			opacity: 0.85;
		}
		&.t-action {
			background: #22754e;
			border-color: #22754e;
		}
		&.t-condition {
			background: #d57c30;
			border-color: #d57c30;
		}
		&.t-foreach {
			background: var(--color-info);
			border-color: var(--color-info);
		}
		&.t-result {
			background: #6366f1;
			border-color: #6366f1;
		}
	}
</style>
