<script lang="ts">
	import { untrack } from 'svelte';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { EntityTypeForWorkflow, FieldDef, EditableField } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';
	import type { ExternalApiConnectionOption } from '$lib/server/db/external-api-connection-service';
	import { triggerFieldsFor, buildResultPreview, formatResultPreview } from '$lib/workflow-tools';
	import WorkflowStepList from './WorkflowStepList.svelte';
	import WorkflowInputSchemaDrawer from '$lib/components/database/WorkflowInputSchemaDrawer.svelte';

	export type WorkflowState = {
		name: string;
		description?: string | null;
		triggerType?: 'schedule' | 'event' | 'mcp_tool';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		inputSchema?: FieldDef[];
		steps: WorkflowStep[];
	};

	type Props = {
		name: string;
		description?: string | null;
		triggerType?: 'schedule' | 'event' | 'mcp_tool';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		inputSchema?: FieldDef[];
		steps: WorkflowStep[];
		onsave?: (def: WorkflowState) => void;
		editable?: boolean;
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
		integrations?: ExternalApiConnectionOption[];
	};

	let {
		name: initName,
		description: initDescription = null,
		triggerType: initTriggerType = 'schedule',
		triggerHour: initHour,
		triggerMinute: initMinute,
		triggerEvent: initTriggerEvent = null,
		triggerEntityTypeId: initTriggerEntityTypeId = null,
		inputSchema: initInputSchema = [],
		steps: initSteps,
		onsave,
		editable = true,
		entityTypes = [],
		slackIntegrations = [],
		integrations = []
	}: Props = $props();

	function withLocalId(fields: FieldDef[]): EditableField[] {
		return fields.map((f) => ({ ...f, _id: crypto.randomUUID() }));
	}

	function stripLocalId(fields: EditableField[]): FieldDef[] {
		return fields.map(({ _id: _drop, ...f }) => f);
	}

	// Values from the chat's $state can be deeply reactive Proxies, which the browser's native
	// structuredClone doesn't recognize, causing a DataCloneError — so we clone via JSON
	// serialization instead (safe since WorkflowStep is always plain JSON data).
	function cloneSteps(steps: WorkflowStep[]): WorkflowStep[] {
		return JSON.parse(JSON.stringify(steps));
	}

	let name = $state(untrack(() => initName));
	let description = $state(untrack(() => initDescription ?? ''));
	let triggerType = $state<'schedule' | 'event' | 'mcp_tool'>(untrack(() => initTriggerType));
	let triggerHour = $state(untrack(() => initHour));
	let triggerMinute = $state(untrack(() => initMinute));
	let triggerEvent = $state<'create' | 'update' | 'delete' | null>(untrack(() => initTriggerEvent));
	let triggerEntityTypeId = $state<string | null>(untrack(() => initTriggerEntityTypeId));
	let inputSchema = $state<EditableField[]>(untrack(() => withLocalId(JSON.parse(JSON.stringify(initInputSchema)))));
	let steps = $state<WorkflowStep[]>(untrack(() => cloneSteps(initSteps)));
	let inputSchemaDrawerOpen = $state(false);

	export function getState(): WorkflowState {
		return { name, description: description || null, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId, inputSchema: stripLocalId(inputSchema), steps };
	}

	/** Reflects state proposed from an external source (e.g. the AI assistant panel). */
	export function setState(def: WorkflowState) {
		name = def.name;
		description = def.description ?? '';
		triggerType = def.triggerType ?? 'schedule';
		triggerHour = def.triggerHour;
		triggerMinute = def.triggerMinute;
		triggerEvent = def.triggerEvent ?? null;
		triggerEntityTypeId = def.triggerEntityTypeId ?? null;
		inputSchema = withLocalId(def.inputSchema ?? []);
		steps = cloneSteps(def.steps);
	}

	export function openInputSchemaDrawer() {
		inputSchemaDrawerOpen = true;
	}

	// List of fields referenceable within steps as @trigger:<field> on an event trigger
	// (system fields like id/event plus the custom fields of the selected table)
	const triggerFields = $derived(
		triggerType === 'event' ? triggerFieldsFor(entityTypes, triggerEntityTypeId) : []
	);

	// Declared input parameters. List referenceable within steps as @input:<key> (key and label only).
	const inputFields = $derived(inputSchema.map((f) => ({ key: f.key, label: f.label })));

	// Pre-execution preview assembled from the result step's configuration (references like @step: are left as tokens, not resolved).
	const resultPreview = $derived(buildResultPreview(steps));
	const hasResultPreview = $derived(Object.keys(resultPreview).length > 0);
</script>

<div class="wf-wrap">
	<div class="wf-header">
		{#if editable}
			<input type="text" class="wf-name-input" bind:value={name} placeholder="Workflow name" />
		{:else}
			<span class="wf-name">{name}</span>
		{/if}
		<!-- Trigger configuration UI is hidden during the MCP-only phase (triggerType's own data/logic is kept as-is) -->
		{#if onsave}
			<button class="btn-save" onclick={() => onsave?.(getState())}>Save</button>
		{/if}
	</div>

	{#if editable || description}
		<div class="wf-description-row">
			{#if editable}
				<textarea
					class="wf-description-input"
					bind:value={description}
					placeholder="Describe what this workflow does (used by external AI agents to decide when to call it as an MCP tool)"
					rows="4"
				></textarea>
			{:else}
				<p class="wf-description">{description}</p>
			{/if}
		</div>
	{/if}

	<div class="wf-body">
		<WorkflowStepList
			{steps}
			visibleBefore={[]}
			listVisibleBefore={[]}
			itemScopes={[]}
			{editable}
			depth={0}
			{entityTypes}
			{slackIntegrations}
			{integrations}
			{triggerFields}
			{inputFields}
		/>
	</div>

	{#if hasResultPreview}
		<div class="wf-result-preview">
			<div class="wf-result-preview-title">Result preview</div>
			<pre class="wf-result-preview-json">{formatResultPreview(resultPreview)}</pre>
		</div>
	{/if}
</div>

<WorkflowInputSchemaDrawer
	open={inputSchemaDrawerOpen}
	bind:fields={inputSchema}
	onclose={() => (inputSchemaDrawerOpen = false)}
/>

<style lang="scss">
	.wf-wrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 12px 14px;
		background: var(--color-background);
	}

	.wf-header {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.wf-name-input {
		font-size: 0.9375rem;
		font-weight: 600;
		padding: 4px 8px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-surface);
		color: var(--color-text);
		min-width: 160px;
		&:focus {
			outline: none;
			border-color: var(--color-primary);
		}
	}

	.wf-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.wf-description-row {
		padding-bottom: 4px;
	}

	.wf-description-input {
		width: 100%;
		box-sizing: border-box;
		padding: 6px 8px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.8125rem;
		font-family: inherit;
		resize: vertical;
		outline: none;
		&:focus { border-color: var(--color-primary); }
		&::placeholder { color: var(--color-text-muted); opacity: 0.7; }
	}

	.wf-description {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.btn-save {
		margin-left: auto;
		padding: 4px 14px;
		border-radius: 5px;
		font-size: 0.8125rem;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		&:hover {
			opacity: 0.85;
		}
	}

	.wf-body {
		display: flex;
		flex-direction: column;
	}

	.wf-result-preview {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
		padding: 10px 12px;
		border: 1px dashed var(--color-border);
		border-radius: 6px;
	}

	.wf-result-preview-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.wf-result-preview-json {
		margin: 0;
		padding: 8px 10px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
	}
</style>
