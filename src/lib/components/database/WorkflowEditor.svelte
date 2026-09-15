<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import Workflow, { type WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import WorkflowChatPanel from './WorkflowChatPanel.svelte';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { WorkflowRunRow, StepLog } from '$lib/server/db/workflow-run-service';
	import type { EntityTypeForWorkflow, FieldDef } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';
	import type { ExternalApiConnectionOption } from '$lib/server/db/external-api-connection-service';

	type WorkflowReviewResult = { summary: string; issues: string[]; suggestions: string[] };

	type Props = {
		id?: string;
		initialName?: string;
		initialDescription?: string | null;
		initialTriggerType?: 'schedule' | 'event' | 'mcp_tool';
		initialTriggerHour?: number;
		initialTriggerMinute?: number;
		initialTriggerEvent?: 'create' | 'update' | 'delete' | null;
		initialTriggerEntityTypeId?: string | null;
		initialInputSchema?: FieldDef[];
		initialSteps?: WorkflowStep[];
		initialEnabled?: boolean;
		runs?: WorkflowRunRow[];
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
		integrations?: ExternalApiConnectionOption[];
		noChatPanel?: boolean;
	};

	let {
		id,
		initialName = 'New Workflow',
		initialDescription = null,
		initialTriggerType = 'schedule',
		initialTriggerHour = 9,
		initialTriggerMinute = 0,
		initialTriggerEvent = null,
		initialTriggerEntityTypeId = null,
		initialInputSchema = [],
		initialSteps = [],
		initialEnabled = false,
		runs = [],
		entityTypes = [],
		slackIntegrations = [],
		integrations = [],
		noChatPanel = false
	}: Props = $props();

	// Since saving doesn't navigate away, keep the id issued when creating a new workflow
	let currentId = $state(untrack(() => id));
	// Always enabled during the MCP-only phase (the toggle UI is hidden, initialEnabled is ignored)
	let enabled = $state(true);

	type WorkflowInstance = {
		getState: () => WorkflowState;
		setState: (def: WorkflowState) => void;
		openInputSchemaDrawer: () => void;
	};
	let wfRef = $state<WorkflowInstance | null>(null);

	function fallbackState(): WorkflowState {
		return { name: initialName, description: initialDescription, triggerType: initialTriggerType, triggerHour: initialTriggerHour, triggerMinute: initialTriggerMinute, triggerEvent: initialTriggerEvent, triggerEntityTypeId: initialTriggerEntityTypeId, inputSchema: initialInputSchema, steps: initialSteps };
	}

	export function getState(): WorkflowState {
		return wfRef?.getState() ?? fallbackState();
	}
	export function setState(s: WorkflowState) {
		wfRef?.setState(s);
	}
	// Exposed so the host side's (build page) save logic can read the enabled flag
	export function getEnabled(): boolean {
		return enabled;
	}

	let aiReview = $state<WorkflowReviewResult | null>(null);
	let aiReviewLoading = $state(false);
	let aiReviewError = $state('');

	let runningNow = $state(false);
	// Result of "Run now" (the response assembled by set_result). Formatted for display beneath the workflow.
	let lastRunResult = $state<Record<string, unknown> | null>(null);

	function collectInputArgs(inputSchema: FieldDef[]): Record<string, unknown> | null {
		const inputArgs: Record<string, unknown> = {};
		for (const f of inputSchema) {
			const optionsHint = f.type === 'select' && f.options?.length ? `\nOptions: ${f.options.map((o) => o.value).join(', ')}` : '';
			let raw: string | null;
			for (;;) {
				raw = prompt(
					`Please enter ${f.label} (${f.required ? 'required' : 'optional'})${f.description ? `\n${f.description}` : ''}${optionsHint}`
				);
				if (raw === null) return null; // cancelled
				if (raw === '' && f.required) {
					alert(`${f.label} is required. Please enter a value.`);
					continue;
				}
				break;
			}
			if (raw === '' && !f.required) continue;
			inputArgs[f.key] = f.type === 'number' ? Number(raw) : raw;
		}
		return inputArgs;
	}

	async function runNow() {
		if (runningNow || !currentId) return;

		let triggerRecordId: string | undefined;
		if (initialTriggerType === 'event') {
			const input = prompt(
				'This is a test run of the event trigger.\nPlease enter the record ID to use as @trigger:id / @trigger:<field> (leave blank to run with an empty string).'
			);
			if (input === null) return; // cancelled
			triggerRecordId = input.trim();
		} else {
			if (!confirm('This will run using the currently saved state. Are you sure?')) return;
		}

		const inputSchema = wfRef?.getState().inputSchema ?? [];
		let inputArgs: Record<string, unknown> | undefined;
		if (inputSchema.length > 0) {
			const collected = collectInputArgs(inputSchema);
			if (collected === null) return; // cancelled
			inputArgs = collected;
		}

		runningNow = true;
		try {
			const body: Record<string, unknown> = {};
			if (triggerRecordId !== undefined) body.triggerRecordId = triggerRecordId;
			if (inputArgs !== undefined) body.inputArgs = inputArgs;
			const hasBody = Object.keys(body).length > 0;
			const res = await fetch(`/api/workflows/${currentId}/run`, {
				method: 'POST',
				headers: hasBody ? { 'Content-Type': 'application/json' } : {},
				body: hasBody ? JSON.stringify(body) : undefined
			});
			const result = (await res.json()) as {
				ok?: boolean;
				name?: string;
				error?: string;
				result?: Record<string, unknown>;
			};
			if (!res.ok) {
				toast.error(result.error ?? 'Run failed');
				return;
			}
			lastRunResult = result.result ?? {};
			if (result.ok) {
				toast.success(`Ran "${result.name}"`);
			} else {
				toast.error(`Failed to run "${result.name}": ${result.error ?? ''}`);
			}
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Run failed');
		} finally {
			runningNow = false;
		}
	}

	async function runAiReview() {
		if (aiReviewLoading || !wfRef) return;
		const state = wfRef.getState();
		if (state.steps.length === 0) {
			aiReviewError = 'There are no steps.';
			return;
		}
		aiReviewLoading = true;
		aiReviewError = '';
		aiReview = null;
		try {
			const res = await fetch('/api/workflows/review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(state)
			});
			const result = (await res.json()) as WorkflowReviewResult & { error?: string };
			if (!res.ok) {
				aiReviewError = result.error ?? 'AI review failed.';
				return;
			}
			aiReview = result;
		} catch (e) {
			aiReviewError = e instanceof Error ? e.message : String(e);
		} finally {
			aiReviewLoading = false;
		}
	}

	let expandedRunId = $state<string | null>(null);

	function toggleRunExpand(runId: string) {
		expandedRunId = expandedRunId === runId ? null : runId;
	}

	function stepLogLabel(log: StepLog): string {
		const status = log.ok ? '✓' : '✗';
		const ms = log.ms < 1000 ? `${log.ms}ms` : `${(log.ms / 1000).toFixed(1)}s`;
		return `${status} ${log.label} (${ms})`;
	}
</script>

<div class="editor-wrap">
	<div class="editor-row1">
		<div class="editor-row1-actions">
			<button class="btn-input-schema" onclick={() => wfRef?.openInputSchemaDrawer()}>
				⚙ Input parameters
			</button>
			{#if currentId}
				<button class="btn-run-now" onclick={runNow} disabled={runningNow}>
					{runningNow ? 'Running...' : '▶ Run now'}
				</button>
			{/if}
			<button class="btn-ai-review" onclick={runAiReview} disabled={aiReviewLoading}>
				{#if aiReviewLoading}
					Reviewing...
				{:else if aiReview}
					✨ Re-review
				{:else}
					✨ AI review
				{/if}
			</button>
		</div>
	</div>

	{#if aiReviewError}
		<p class="ai-review-error">{aiReviewError}</p>
	{/if}
	{#if aiReview}
		<div class="ai-review-box">
			<p class="ai-review-summary">{aiReview.summary}</p>
			{#if aiReview.issues.length > 0}
				<div class="ai-review-group">
					<h3 class="ai-review-group-title">Logical errors / unreachable steps</h3>
					<ul class="ai-review-list">
						{#each aiReview.issues as item}
							<li>{item}</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if aiReview.suggestions.length > 0}
				<div class="ai-review-group">
					<h3 class="ai-review-group-title">Suggested improvements</h3>
					<ul class="ai-review-list">
						{#each aiReview.suggestions as item}
							<li>{item}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}

	<div class="editor-body">
		{#if !noChatPanel}
			<div class="chat-embedded">
				<WorkflowChatPanel
					getCurrent={() => wfRef?.getState() ?? fallbackState()}
					onApply={(state) => wfRef?.setState(state)}
				/>
			</div>
		{/if}
		<div class="editor-canvas">
			<Workflow
				bind:this={wfRef}
				name={initialName}
				description={initialDescription}
				triggerType={initialTriggerType}
				triggerHour={initialTriggerHour}
				triggerMinute={initialTriggerMinute}
				triggerEvent={initialTriggerEvent}
				triggerEntityTypeId={initialTriggerEntityTypeId}
				inputSchema={initialInputSchema}
				steps={initialSteps}
				editable={true}
				{entityTypes}
				{slackIntegrations}
				{integrations}
			/>
		</div>
	</div>

	{#if lastRunResult}
		<div class="run-result-box">
			<div class="run-result-title">Run result (response)</div>
			<pre class="run-result-json">{JSON.stringify(lastRunResult, null, 2)}</pre>
		</div>
	{/if}

	<!-- Run log UI is hidden during the MCP-only phase (the runs/toggleRunExpand logic etc. is kept as-is) -->
</div>

<style lang="scss">
	.editor-wrap {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px 24px;
	}

	.editor-row1 {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.editor-row1-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.btn-input-schema {
		padding: 6px 14px;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
		}
	}

	.btn-run-now {
		padding: 6px 14px;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
		&:hover:not(:disabled) {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
		}
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.btn-ai-review {
		padding: 6px 14px;
		background: none;
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
		&:hover:not(:disabled) {
			background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		}
		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.ai-review-error {
		margin: 0;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: 6px;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.ai-review-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
	}
	.ai-review-summary { margin: 0; font-size: 0.9375rem; line-height: 1.7; }
	.ai-review-group { display: flex; flex-direction: column; gap: 6px; }
	.ai-review-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}
	.ai-review-list { margin: 0; padding-left: 1.4em; font-size: 0.875rem; line-height: 1.7; display: flex; flex-direction: column; gap: 4px; }

	.editor-body {
		flex: 1;
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.chat-embedded {
		width: 300px;
		flex-shrink: 0;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		align-self: stretch;
		min-height: 400px;
	}

	.editor-canvas {
		flex: 1;
	}

	.run-result-box {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.run-result-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.run-result-json {
		margin: 0;
		padding: 10px 12px;
		background: var(--color-background);
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
