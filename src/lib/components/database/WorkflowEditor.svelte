<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import Workflow, { type WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import WorkflowChatPanel from './WorkflowChatPanel.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { formatJstDateTime } from '$lib/datetime';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { WorkflowRunRow, StepLog } from '$lib/server/db/workflow-run-service';
	import type { EntityTypeForWorkflow } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';

	type WorkflowReviewResult = { summary: string; issues: string[]; suggestions: string[] };

	type Props = {
		id?: string;
		initialName?: string;
		initialTriggerType?: 'schedule' | 'event';
		initialTriggerHour?: number;
		initialTriggerMinute?: number;
		initialTriggerEvent?: 'create' | 'update' | 'delete' | null;
		initialTriggerEntityTypeId?: string | null;
		initialSteps?: WorkflowStep[];
		initialEnabled?: boolean;
		runs?: WorkflowRunRow[];
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
		noChatPanel?: boolean;
	};

	let {
		id,
		initialName = '新規ワークフロー',
		initialTriggerType = 'schedule',
		initialTriggerHour = 9,
		initialTriggerMinute = 0,
		initialTriggerEvent = null,
		initialTriggerEntityTypeId = null,
		initialSteps = [],
		initialEnabled = false,
		runs = [],
		entityTypes = [],
		slackIntegrations = [],
		noChatPanel = false
	}: Props = $props();

	// 保存後も画面遷移しないため、新規作成時に発行されたidを保持する（今すぐ実行・有効化の切替に使用）
	let currentId = $state(untrack(() => id));
	let enabled = $state(untrack(() => initialEnabled));

	type WorkflowInstance = { getState: () => WorkflowState; setState: (def: WorkflowState) => void };
	let wfRef = $state<WorkflowInstance | null>(null);

	export function getState(): WorkflowState {
		return wfRef?.getState() ?? { name: initialName, triggerType: initialTriggerType, triggerHour: initialTriggerHour, triggerMinute: initialTriggerMinute, triggerEvent: initialTriggerEvent, triggerEntityTypeId: initialTriggerEntityTypeId, steps: initialSteps };
	}
	export function setState(s: WorkflowState) {
		wfRef?.setState(s);
	}
	// ホスト側（ビルドページ）の保存処理が有効化フラグを読むために公開する
	export function getEnabled(): boolean {
		return enabled;
	}

	let aiReview = $state<WorkflowReviewResult | null>(null);
	let aiReviewLoading = $state(false);
	let aiReviewError = $state('');

	let runningNow = $state(false);

	async function runNow() {
		if (runningNow || !currentId) return;

		let triggerRecordId: string | undefined;
		if (initialTriggerType === 'event') {
			const input = prompt(
				'イベントトリガーのテスト実行です。\n@trigger:id として使用するレコードIDを入力してください（空欄の場合は空文字で実行）。'
			);
			if (input === null) return; // キャンセル
			triggerRecordId = input.trim();
		} else {
			if (!confirm('保存されている状態で実行されます。よろしいですか？')) return;
		}

		runningNow = true;
		try {
			const body = triggerRecordId !== undefined ? JSON.stringify({ triggerRecordId }) : undefined;
			const res = await fetch(`/api/workflows/${currentId}/run`, {
				method: 'POST',
				headers: body ? { 'Content-Type': 'application/json' } : {},
				body
			});
			const result = (await res.json()) as { ok?: boolean; name?: string; error?: string };
			if (!res.ok) {
				toast.error(result.error ?? '実行に失敗しました');
				return;
			}
			if (result.ok) {
				toast.success(`「${result.name}」を実行しました`);
			} else {
				toast.error(`「${result.name}」の実行に失敗しました: ${result.error ?? ''}`);
			}
			await invalidateAll();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : '実行に失敗しました');
		} finally {
			runningNow = false;
		}
	}

	async function runAiReview() {
		if (aiReviewLoading || !wfRef) return;
		const state = wfRef.getState();
		if (state.steps.length === 0) {
			aiReviewError = 'ステップが1つもありません。';
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
				aiReviewError = result.error ?? 'AIレビューに失敗しました。';
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
		return `${status} ${log.label}（${ms}）`;
	}
</script>

<div class="editor-wrap">
	<div class="editor-row1">
		<Toggle bind:checked={enabled} label="有効化" />
		<div class="editor-row1-actions">
			{#if currentId}
				<button class="btn-run-now" onclick={runNow} disabled={runningNow}>
					{runningNow ? '実行中...' : '▶ 今すぐ実行'}
				</button>
			{/if}
			<button class="btn-ai-review" onclick={runAiReview} disabled={aiReviewLoading}>
				{#if aiReviewLoading}
					レビュー中...
				{:else if aiReview}
					✨ 再レビュー
				{:else}
					✨ AIレビュー
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
					<h3 class="ai-review-group-title">論理的な誤り・未到達ステップ</h3>
					<ul class="ai-review-list">
						{#each aiReview.issues as item}
							<li>{item}</li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if aiReview.suggestions.length > 0}
				<div class="ai-review-group">
					<h3 class="ai-review-group-title">改善提案</h3>
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
					getCurrent={() => wfRef?.getState() ?? { name: initialName, triggerType: initialTriggerType, triggerHour: initialTriggerHour, triggerMinute: initialTriggerMinute, triggerEvent: initialTriggerEvent, triggerEntityTypeId: initialTriggerEntityTypeId, steps: initialSteps }}
					onApply={(state) => wfRef?.setState(state)}
				/>
			</div>
		{/if}
		<div class="editor-canvas">
			<Workflow
				bind:this={wfRef}
				name={initialName}
				triggerType={initialTriggerType}
				triggerHour={initialTriggerHour}
				triggerMinute={initialTriggerMinute}
				triggerEvent={initialTriggerEvent}
				triggerEntityTypeId={initialTriggerEntityTypeId}
				steps={initialSteps}
				editable={true}
				{entityTypes}
				{slackIntegrations}
			/>
		</div>
	</div>

	{#if currentId}
		<div class="run-log">
			<h3>実行ログ</h3>
			{#if runs.length === 0}
				<p class="run-log-empty">実行履歴はまだありません。</p>
			{:else}
				<table class="run-log-table">
					<thead>
						<tr>
							<th>開始</th>
							<th>結果</th>
							<th>詳細</th>
						</tr>
					</thead>
					<tbody>
						{#each runs as run (run.id)}
							{@const hasDetail = !!(run.error || (run.log && run.log.length > 0))}
							{@const expanded = expandedRunId === run.id}
							<tr
								class:expandable={hasDetail}
								class:expanded
								onclick={hasDetail ? () => toggleRunExpand(run.id) : undefined}
								role={hasDetail ? 'button' : undefined}
								tabindex={hasDetail ? 0 : undefined}
								onkeydown={hasDetail ? (e) => e.key === 'Enter' && toggleRunExpand(run.id) : undefined}
							>
								<td class="run-log-date">{formatJstDateTime(run.startedAt)}</td>
								<td>
									<span class="run-log-badge" class:ok={run.ok} class:fail={!run.ok}>
										{run.ok ? '成功' : '失敗'}
									</span>
								</td>
								<td class="run-log-summary">
									{#if run.error}
										<span class="run-log-error-text">{run.error}</span>
									{:else if run.log && run.log.length > 0}
										<span class="run-log-step-count">{run.log.length}ステップ</span>
									{/if}
									{#if hasDetail}
										<span class="run-log-chevron">{expanded ? '▲' : '▼'}</span>
									{/if}
								</td>
							</tr>
							{#if expanded && hasDetail}
								<tr class="run-log-detail-row">
									<td colspan="3">
										{#if run.log && run.log.length > 0}
											<ul class="run-step-list">
												{#each run.log as step (step.id)}
													<li class="run-step-item" class:step-ok={step.ok} class:step-fail={!step.ok}>
														<span class="run-step-label">{stepLogLabel(step)}</span>
														{#if step.result}
															<span class="run-step-detail">{step.result}</span>
														{/if}
														{#if step.error}
															<span class="run-step-error">{step.error}</span>
														{/if}
													</li>
												{/each}
											</ul>
										{/if}
										{#if run.error && !(run.log && run.log.length > 0)}
											<p class="run-detail-error">{run.error}</p>
										{/if}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
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

	.run-log {
		border-top: 1px solid var(--color-border);
		padding-top: 16px;

		h3 {
			margin: 0 0 8px;
			font-size: 0.9375rem;
		}
	}

	.run-log-empty {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.run-log-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;

		th {
			text-align: left;
			padding: 6px 10px;
			color: var(--color-text-muted);
			font-weight: 600;
			border-bottom: 1px solid var(--color-border);
		}

		td {
			padding: 6px 10px;
			border-bottom: 1px solid var(--color-border);
		}

		tbody tr:last-child td {
			border-bottom: none;
		}
	}

	.run-log-date {
		white-space: nowrap;
		color: var(--color-text-muted);
	}

	.run-log-summary {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.run-log-error-text {
		color: var(--color-danger, var(--color-error));
		font-size: 0.8125rem;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 320px;
	}

	.run-log-step-count {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.run-log-chevron {
		color: var(--color-text-muted);
		font-size: 0.7rem;
		margin-left: auto;
	}

	tr.expandable {
		cursor: pointer;
		&:hover td {
			background: color-mix(in srgb, var(--color-text) 4%, transparent);
		}
	}

	tr.expanded td {
		background: color-mix(in srgb, var(--color-text) 4%, transparent);
	}

	.run-log-detail-row td {
		padding: 0 10px 10px 24px;
		background: color-mix(in srgb, var(--color-text) 2%, transparent);
	}

	.run-step-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.run-step-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8125rem;

		&.step-ok {
			border-left: 2px solid var(--color-success);
		}
		&.step-fail {
			border-left: 2px solid var(--color-error);
		}
	}

	.run-step-label {
		font-weight: 500;
	}

	.run-step-detail {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.run-step-error {
		color: var(--color-error);
		font-size: 0.75rem;
	}

	.run-detail-error {
		margin: 4px 0 0;
		color: var(--color-error);
		font-size: 0.8125rem;
	}

	.run-log-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;

		&.ok {
			color: var(--color-success);
			border-color: var(--color-success);
		}
		&.fail {
			color: var(--color-error);
			border-color: var(--color-error);
		}
	}
</style>
