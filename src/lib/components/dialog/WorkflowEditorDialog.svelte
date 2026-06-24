<script lang="ts">
	import { onMount } from 'svelte';
	import X from '$lib/components/icon/X.svelte';
	import WorkflowEditor from '$lib/components/database/WorkflowEditor.svelte';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { WorkflowRunRow } from '$lib/server/db/workflow-run-service';
	import type { EntityTypeForWorkflow } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';

	type Props = {
		id?: string;
		initialName?: string;
		initialTriggerHour?: number;
		initialTriggerMinute?: number;
		initialSteps?: WorkflowStep[];
		initialEnabled?: boolean;
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
		onclose: () => void;
	};

	let {
		id,
		initialName = '新規ワークフロー',
		initialTriggerHour = 9,
		initialTriggerMinute = 0,
		initialSteps = [],
		initialEnabled = false,
		entityTypes = [],
		slackIntegrations = [],
		onclose
	}: Props = $props();

	let runs = $state<WorkflowRunRow[]>([]);

	onMount(async () => {
		if (!id) return;
		try {
			const res = await fetch(`/api/workflows/${id}/runs`);
			if (res.ok) runs = ((await res.json()) as { runs: WorkflowRunRow[] }).runs;
		} catch {
			// 実行ログ取得失敗時は空のまま
		}
	});

	const title = $derived(id ? 'ワークフロー編集' : 'ワークフロー作成');
</script>

<div class="overlay" role="presentation"></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={title}>
	<div class="dialog-header">
		<span class="dialog-title">{title}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>
	<div class="dialog-body">
		<WorkflowEditor
			{id}
			{initialName}
			{initialTriggerHour}
			{initialTriggerMinute}
			{initialSteps}
			{initialEnabled}
			{runs}
			{entityTypes}
			{slackIntegrations}
			inDialog
		/>
	</div>
</div>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
		animation: fade-in 0.2s ease;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(1280px, 97vw);
		height: min(860px, 97vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.dialog-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}
</style>
