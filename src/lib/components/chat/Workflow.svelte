<script lang="ts">
	import { untrack } from 'svelte';
	import type { WorkflowStep } from '$lib/types/chat';
	import type { EntityTypeForWorkflow, FieldDef, EditableField } from '$lib/server/db/table-service';
	import type { SlackIntegrationOption } from '$lib/server/slack';
	import type { IntegrationOption } from '$lib/server/db/integration-service';
	import { triggerFieldsFor } from '$lib/workflow-tools';
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
		integrations?: IntegrationOption[];
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

	// チャットの $state からの値は深くリアクティブなProxyの場合があり、
	// ブラウザ native の structuredClone がそれを認識できず DataCloneError になることがあるため、
	// JSONシリアライズで複製する（WorkflowStep は常にプレーンなJSONデータのため安全）。
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

	/** 外部（AIアシスタントパネル等）から提案された状態を反映する。 */
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

	// イベントトリガー時、ステップ内で @trigger:<field> として参照できるフィールド一覧
	// （id/event等のシステムフィールド＋選択中テーブルのカスタムフィールド）
	const triggerFields = $derived(
		triggerType === 'event' ? triggerFieldsFor(entityTypes, triggerEntityTypeId) : []
	);

	// 宣言された入力パラメータ。ステップ内で @input:<key> として参照できる一覧（キー・ラベルのみ）。
	const inputFields = $derived(inputSchema.map((f) => ({ key: f.key, label: f.label })));
</script>

<div class="wf-wrap">
	<div class="wf-header">
		{#if editable}
			<input type="text" class="wf-name-input" bind:value={name} placeholder="ワークフロー名" />
		{:else}
			<span class="wf-name">{name}</span>
		{/if}
		<!-- MCP専用フェーズのためトリガー設定UIは非表示（triggerType自体のデータ・ロジックはそのまま維持） -->
		{#if onsave}
			<button class="btn-save" onclick={() => onsave?.(getState())}>保存</button>
		{/if}
	</div>

	{#if editable || description}
		<div class="wf-description-row">
			{#if editable}
				<textarea
					class="wf-description-input"
					bind:value={description}
					placeholder="このワークフローが何をするか説明する（MCPツールとして呼び出す外部AIエージェントが判断材料に使う）"
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
</style>
