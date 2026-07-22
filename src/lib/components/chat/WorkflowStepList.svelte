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

	/** ネストしたforeachのうち、いずれか1段の「現在の項目」スコープ。bodyの内側ではこのスタック（祖先のforeach全て）を全て参照できる。
	 *  itemFields===null はフィールド構成が事前にわからない場合(call_external_apiをsourceに@step:<id>.<path>で指定した場合等)。 */
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
		/** イベントトリガー時、@trigger:<field> として参照できるフィールド一覧（トリガーがscheduleの場合は空） */
		triggerFields?: WorkflowListResultField[];
		/** 宣言された入力パラメータ一覧。@input:<key> として参照できる */
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

	// ステップidは@step:<id>やmakeItemRef等で手入力することが多いため、UUIDではなく短い英数字にする
	// （parseStepRefが最初の"."をid/pathの区切りに使うため、idそのものにドットは含めない）。
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
		// このコンポーネントインスタンスが持つのは現在のスコープ（steps）のみだが、ワークフロー全体で
		// idが一意である必要があるため、呼び出し元のルートまで遡って全ステップidを集める必要がある。
		// ただしvisibleBefore等から全体を辿る手段が無いため、実用上はこのスコープ内での重複回避に留める
		// （4文字・36^4通りなので、他スコープとの衝突確率は無視できるレベル）。
		const existing = collectAllStepIds(steps);
		let id = randomShortId();
		while (existing.has(id)) id = randomShortId();
		return id;
	}

	function addStep(kind: 'action' | 'condition' | 'foreach') {
		if (kind === 'action') {
			steps.push({ id: makeId(), kind: 'action', label: '新しいアクション', tool: '', params: {} });
		} else if (kind === 'condition') {
			steps.push({
				id: makeId(),
				kind: 'condition',
				label: '新しい条件',
				left: '',
				operator: '==',
				right: '',
				then: []
			});
		} else {
			steps.push({ id: makeId(), kind: 'foreach', label: '新しい繰り返し', source: '', body: [] });
		}
	}

	function removeStep(index: number) {
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
					// get_entitiesはテーブルごとにフィールドが異なるため、選択中のentity_type_idから動的に解決する
					const itemFields =
						s.tool === 'get_entities' ? entityListItemFields(entityTypes, s.params?.entity_type_id) : tool.listResult.itemFields;
					visible.push({ id: s.id, label: s.label, itemFields });
				}
				// call_external_apiはここに載せない: `@step:<id>`(パス無し)では一覧化されず、
				// `@step:<id>.<path>`（パス指定）で参照する場合はforeachのsource側で別途許可している。
			}
		}
		return visible;
	}

	/**
	 * このステップの位置で参照できる「現在の項目」フィールドを、祖先のforeach全て（itemScopes）から
	 * フラットなリストにする（「ここで使える変数」ヘルプパネルへの表示専用。値の入力は直接入力のみ）。
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

	// カテゴリ選択中（対象未選択でtoolが空の）ステップのカテゴリを覚えておくための一時状態。
	// tool が決まれば常にそこからカテゴリを逆引きできるため、これは未確定の間だけ使う。
	let pendingCategory = $state<Record<string, string>>({});

	// 任意パラメーターをユーザーが明示的に開いたもの（ステップID → パラメーターキーのSet）
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

	function closeParam(step: { id: string; params?: Record<string, string> }, key: string) {
		if (step.params) delete step.params[key];
		const s = openedParams[step.id];
		if (s) {
			s.delete(key);
			openedParams[step.id] = new Set(s);
		}
	}

	// 同じtoolが複数カテゴリから参照される場合に、
	// 再読込後どちらのカテゴリで表示するかをstep.categoryで覚えておく。未設定（AI生成・旧データ）はtoolからの逆引きにフォールバックする。
	function currentCategoryKey(step: { id: string; tool: string; category?: string }): string {
		if (step.tool) return step.category ?? findWorkflowActionCategory(step.tool)?.key ?? '';
		return pendingCategory[step.id] ?? '';
	}

	/** カテゴリの対象一覧。includeEntityTargets/includeSlackTargets/includeIntegrationTargetsの場合、
	 *  テーブル・Slack連携・外部API連携を顧客・案件等と同じ並びに追加する。 */
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

	/** 対象selectの現在値。エンティティ操作ツールはparamsから`entity:<id>`形式に変換する。 */
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

	// 「ここで使える変数」ヘルプパネルの開閉状態（ステップごと）
	let helpOpenFor = $state<Record<string, boolean>>({});

	function toggleHelp(stepId: string) {
		helpOpenFor[stepId] = !helpOpenFor[stepId];
	}

	// ドラッグ&ドロップによる並び替え（同じ steps 配列内、つまり同じスコープ内のみ）
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
						title="ドラッグして並び替え"
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
						<option value="">カテゴリを選択</option>
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
							<option value="">対象を選択</option>
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
					title="ここで使える変数を見る"
				>
					<InfoCircle size={14} />
				</button>

				{#if editable}
					<button class="wf-del" onclick={() => removeStep(i)}>×</button>
				{/if}
			</div>

			{#if helpOpenFor[step.id]}
				<div class="wf-help-panel">
					<div class="wf-help-title">ここで使える変数</div>
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
								<span class="wf-help-name">{scope.label}の項目（フィールド構成不明、下の形式で「直接入力」欄に手入力）</span>
								<code class="wf-help-token">@item:{scope.foreachStepId}:&lt;フィールド名&gt;</code>
							</li>
						{/each}
						{#each triggerFields as f, tfi (tfi)}
							<li>
								<span class="wf-help-name">{f.label}（トリガーレコード）</span>
								<code class="wf-help-token">{triggerToken(f)}</code>
							</li>
						{/each}
						{#each inputFields as f, ifi (ifi)}
							<li>
								<span class="wf-help-name">{f.label}（入力パラメータ）</span>
								<code class="wf-help-token">{inputToken(f)}</code>
							</li>
						{/each}
						<li>
							<span class="wf-help-name">自分（ワークフロー登録者）のアカウントID</span>
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
										title="このパラメーターを削除"
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
									<option value="">＋ オプションを追加...</option>
									{#each hiddenOptional as f (f.key)}
										<option value={f.key}>{f.label}</option>
									{/each}
								</select>
							</div>
						{/if}
					{/if}

					<div class="wf-line wf-error-handling">
						<label for="wf-retry-{step.id}">失敗時リトライ回数</label>
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
							失敗しても後続処理を続行する
						</label>
					</div>
				{/if}
			{:else if step.kind === 'condition'}
				<div class="wf-line wf-cond-line">
					<span class="wf-cond-label">判定:</span>
					<input
						type="text"
						placeholder="@step:xxx / @item:xxx:yyy 等"
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
						placeholder="直接入力 または @step:xxx 等"
						value={step.right}
						disabled={!editable}
						oninput={(e) => (step.right = e.currentTarget.value)}
					/>
				</div>
			{:else}
				<div class="wf-line wf-foreach-line">
					<span class="wf-cond-label">対象:</span>
					<input
						type="text"
						placeholder="@step:xxx（一覧を返すステップ） または @step:xxx.data.items（call_external_apiの配列を指定）"
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
			<button class="btn-add t-action" onclick={() => addStep('action')}>+ アクション</button>
			<button class="btn-add t-condition" onclick={() => addStep('condition')}>+ 条件</button>
			<button class="btn-add t-foreach" onclick={() => addStep('foreach')}>+ 繰り返し</button>
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
	}
</style>
