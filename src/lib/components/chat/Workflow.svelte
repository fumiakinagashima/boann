<script lang="ts">
	import { untrack } from 'svelte';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { EntityTypeForWorkflow } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';
	import { triggerFieldsFor } from '$lib/workflow-tools';
	import WorkflowStepList from './WorkflowStepList.svelte';

	export type WorkflowState = {
		name: string;
		triggerType?: 'schedule' | 'event';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		steps: WorkflowStep[];
	};

	type Props = {
		name: string;
		triggerType?: 'schedule' | 'event';
		triggerHour: number;
		triggerMinute: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		steps: WorkflowStep[];
		onsave?: (def: WorkflowState) => void;
		editable?: boolean;
		entityTypes?: EntityTypeForWorkflow[];
		slackIntegrations?: SlackIntegrationOption[];
	};

	let {
		name: initName,
		triggerType: initTriggerType = 'schedule',
		triggerHour: initHour,
		triggerMinute: initMinute,
		triggerEvent: initTriggerEvent = null,
		triggerEntityTypeId: initTriggerEntityTypeId = null,
		steps: initSteps,
		onsave,
		editable = true,
		entityTypes = [],
		slackIntegrations = []
	}: Props = $props();

	// チャットの $state からの値は深くリアクティブなProxyの場合があり、
	// ブラウザ native の structuredClone がそれを認識できず DataCloneError になることがあるため、
	// JSONシリアライズで複製する（WorkflowStep は常にプレーンなJSONデータのため安全）。
	function cloneSteps(steps: WorkflowStep[]): WorkflowStep[] {
		return JSON.parse(JSON.stringify(steps));
	}

	let name = $state(untrack(() => initName));
	let triggerType = $state<'schedule' | 'event'>(untrack(() => initTriggerType));
	let triggerHour = $state(untrack(() => initHour));
	let triggerMinute = $state(untrack(() => initMinute));
	let triggerEvent = $state<'create' | 'update' | 'delete' | null>(untrack(() => initTriggerEvent));
	let triggerEntityTypeId = $state<string | null>(untrack(() => initTriggerEntityTypeId));
	let steps = $state<WorkflowStep[]>(untrack(() => cloneSteps(initSteps)));

	const HOURS = Array.from({ length: 24 }, (_, i) => i);
	const MINUTES = Array.from({ length: 60 }, (_, i) => i);

	const EVENT_OPTIONS: { value: 'create' | 'update' | 'delete'; label: string }[] = [
		{ value: 'create', label: '作成時' },
		{ value: 'update', label: '更新時' },
		{ value: 'delete', label: '削除時' }
	];

	export function getState(): WorkflowState {
		return { name, triggerType, triggerHour, triggerMinute, triggerEvent, triggerEntityTypeId, steps };
	}

	/** 外部（AIアシスタントパネル等）から提案された状態を反映する。 */
	export function setState(def: WorkflowState) {
		name = def.name;
		triggerType = def.triggerType ?? 'schedule';
		triggerHour = def.triggerHour;
		triggerMinute = def.triggerMinute;
		triggerEvent = def.triggerEvent ?? null;
		triggerEntityTypeId = def.triggerEntityTypeId ?? null;
		steps = cloneSteps(def.steps);
	}

	// イベントトリガー時、ステップ内で @trigger:<field> として参照できるフィールド一覧
	// （id/event等のシステムフィールド＋選択中テーブルのカスタムフィールド）
	const triggerFields = $derived(
		triggerType === 'event' ? triggerFieldsFor(entityTypes, triggerEntityTypeId) : []
	);
</script>

<div class="wf-wrap">
	<div class="wf-header">
		{#if editable}
			<input type="text" class="wf-name-input" bind:value={name} placeholder="ワークフロー名" />
		{:else}
			<span class="wf-name">{name}</span>
		{/if}
		<span class="wf-trigger">
			{#if editable}
				<select bind:value={triggerType}>
					<option value="schedule">スケジュール</option>
					<option value="event">イベント</option>
				</select>
			{:else}
				<span class="wf-trigger-type">{triggerType === 'event' ? 'イベント' : 'スケジュール'}</span>
			{/if}
			{#if triggerType === 'schedule'}
				毎日
				<select bind:value={triggerHour} disabled={!editable}>
					{#each HOURS as h (h)}
						<option value={h}>{String(h).padStart(2, '0')}</option>
					{/each}
				</select>
				:
				<select bind:value={triggerMinute} disabled={!editable}>
					{#each MINUTES as m (m)}
						<option value={m}>{String(m).padStart(2, '0')}</option>
					{/each}
				</select>
				に実行
			{:else}
				<select bind:value={triggerEntityTypeId} disabled={!editable}>
					<option value={null}>テーブルを選択</option>
					{#each entityTypes as et (et.id)}
						<option value={et.id}>{et.label}</option>
					{/each}
				</select>
				<select bind:value={triggerEvent} disabled={!editable}>
					<option value={null}>イベントを選択</option>
					{#each EVENT_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				にトリガー
			{/if}
		</span>
		{#if onsave}
			<button class="btn-save" onclick={() => onsave?.(getState())}>保存</button>
		{/if}
	</div>

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
			{triggerFields}
		/>
	</div>
</div>

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

	.wf-trigger {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);

		select {
			padding: 3px 6px;
			border: 1px solid var(--color-border);
			border-radius: 5px;
			background: var(--color-surface);
			color: var(--color-text);
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}
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
</style>
