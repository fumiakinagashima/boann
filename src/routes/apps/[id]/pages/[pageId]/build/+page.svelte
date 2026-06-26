<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import type { PageData } from './$types';
	import type { PageComponent, FieldDef } from '$lib/server/db/table-service';

	let { data }: { data: PageData } = $props();

	type LocalComponent = PageComponent & {
		expanded: boolean;
	};

	let pageLabel = $state(data.page.label);
	let components = $state<LocalComponent[]>(
		data.page.components.map(c => ({ ...c, expanded: false }))
	);
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let deleting = $state(false);

	function markDirty() { dirty = true; saved = false; }

	// ── Save ─────────────────────────────────────────────────
	async function save() {
		if (!pageLabel.trim()) return;
		saving = true;
		try {
			const payload = {
				label: pageLabel.trim(),
				components: components.map(({ expanded, ...c }) => ({
					...c,
					title: c.title || null,
					fields: (c.fields?.length) ? c.fields : null
				}))
			};
			const res = await fetch(`/api/apps/${data.app.id}/pages/${data.page.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (res.ok) {
				dirty = false;
				saved = true;
				setTimeout(() => (saved = false), 2000);
				await invalidateAll();
			}
		} finally {
			saving = false;
		}
	}

	// ── Delete page ───────────────────────────────────────────
	async function deletePage() {
		if (!confirm('このページを削除しますか？')) return;
		deleting = true;
		try {
			const res = await fetch(`/api/apps/${data.app.id}/pages/${data.page.id}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				goto(`/apps/${data.app.id}`);
			}
		} finally {
			deleting = false;
		}
	}

	// ── Components ────────────────────────────────────────────
	function addComponent() {
		const firstTable = data.tables[0];
		if (!firstTable) return;
		components = [...components, {
			id: crypto.randomUUID(),
			type: 'list',
			tableId: firstTable.id,
			title: null,
			fields: null,
			actions: ['create', 'edit', 'delete'],
			expanded: true
		}];
		markDirty();
	}

	function removeComponent(id: string) {
		components = components.filter(c => c.id !== id);
		markDirty();
	}

	function toggleExpand(id: string) {
		components = components.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c);
	}

	function moveUp(idx: number) {
		if (idx === 0) return;
		const arr = [...components];
		[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
		components = arr;
		markDirty();
	}

	function moveDown(idx: number) {
		if (idx === components.length - 1) return;
		const arr = [...components];
		[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
		components = arr;
		markDirty();
	}

	function updateComponent(id: string, patch: Partial<LocalComponent>) {
		components = components.map(c => c.id === id ? { ...c, ...patch } : c);
		markDirty();
	}

	function toggleAction(compId: string, action: 'create' | 'edit' | 'delete') {
		const comp = components.find(c => c.id === compId);
		if (!comp) return;
		const current = comp.actions ?? [];
		const next = current.includes(action)
			? current.filter(a => a !== action)
			: [...current, action];
		updateComponent(compId, { actions: next });
	}

	function toggleField(compId: string, fieldKey: string, tableFields: FieldDef[]) {
		const comp = components.find(c => c.id === compId);
		if (!comp) return;
		const currentFields = comp.fields ?? [];
		if (currentFields.length === 0) {
			// currently showing all → switch to all except this one
			const next = tableFields.map(f => f.key).filter(k => k !== fieldKey);
			updateComponent(compId, { fields: next.length === tableFields.length - 1 ? next : null });
		} else if (currentFields.includes(fieldKey)) {
			const next = currentFields.filter(k => k !== fieldKey);
			updateComponent(compId, { fields: next.length > 0 ? next : null });
		} else {
			const next = [...currentFields, fieldKey];
			const isAll = tableFields.every(f => next.includes(f.key));
			updateComponent(compId, { fields: isAll ? null : next });
		}
	}

	function getTableFields(tableId: string): FieldDef[] {
		return (data.tableFields as Record<string, FieldDef[]>)[tableId] ?? [];
	}

	function isFieldShown(comp: LocalComponent, fieldKey: string): boolean {
		if (!comp.fields?.length) return true;
		return comp.fields.includes(fieldKey);
	}

	function getTableLabel(tableId: string): string {
		return data.tables.find(t => t.id === tableId)?.label ?? tableId;
	}

	function getDisplaySummary(comp: LocalComponent): string {
		const fields = comp.fields?.length
			? `${comp.fields.length}フィールド`
			: '全フィールド';
		const actions = (comp.actions ?? []).map(a =>
			a === 'create' ? '作成' : a === 'edit' ? '編集' : '削除'
		).join('・') || 'アクションなし';
		return `${fields} / ${actions}`;
	}
</script>

<div class="build-page">
	<div class="build-header">
		<a href="/apps/{data.app.id}" class="back-link"><ChevronLeft size={15} />{data.app.label}</a>
		<div class="header-main">
			<div class="header-title">
				<input
					class="page-label-input"
					type="text"
					bind:value={pageLabel}
					oninput={markDirty}
					placeholder="ページ名"
				/>
				<span class="page-badge">ページ設定</span>
			</div>
			<div class="header-actions">
				{#if saved}<span class="saved-msg">✓ 保存しました</span>{/if}
				<button class="btn-danger-ghost" onclick={deletePage} disabled={deleting}>削除</button>
				<a href="/apps/{data.app.id}/pages/{data.page.id}" class="btn-secondary">プレビュー</a>
				<button class="btn-primary" onclick={save} disabled={saving || !dirty}>
					{saving ? '保存中…' : '保存'}
				</button>
			</div>
		</div>
	</div>

	<div class="build-body">
		<section class="section">
			<h2 class="section-title">コンポーネント</h2>
			<p class="section-desc">ページに表示するコンポーネントを追加・設定します。上から順に表示されます。</p>

			{#if components.length === 0}
				<div class="empty-comp">
					<p>コンポーネントがまだありません。</p>
				</div>
			{/if}

			{#each components as comp, i (comp.id)}
				{@const tableFields = getTableFields(comp.tableId)}
				<div class="comp-card" class:expanded={comp.expanded}>
					<div class="comp-card-header" role="button" tabindex="0"
						onclick={() => toggleExpand(comp.id)}
						onkeydown={(e) => { if (e.key === 'Enter') toggleExpand(comp.id); }}
					>
						<span class="comp-type-badge" class:form={comp.type === 'form'}>
							{comp.type === 'list' ? '一覧' : 'フォーム'}
						</span>
						<span class="comp-summary">
							<strong>{comp.title || getTableLabel(comp.tableId)}</strong>
							<span class="comp-meta">{getDisplaySummary(comp)}</span>
						</span>
						<div class="comp-card-actions" role="presentation" onclick={(e) => e.stopPropagation()}>
							<button class="icon-btn" onclick={() => moveUp(i)} disabled={i === 0} title="上へ">↑</button>
							<button class="icon-btn" onclick={() => moveDown(i)} disabled={i === components.length - 1} title="下へ">↓</button>
							<button class="icon-btn danger" onclick={() => removeComponent(comp.id)} title="削除">×</button>
						</div>
						<span class="expand-icon">{comp.expanded ? '▲' : '▼'}</span>
					</div>

					{#if comp.expanded}
						<div class="comp-card-body">
							<!-- Type -->
							<div class="field-group">
								<label class="field-label">種類</label>
								<div class="radio-group">
									<label class="radio-label">
										<input type="radio" name="type-{comp.id}" value="list"
											checked={comp.type === 'list'}
											onchange={() => updateComponent(comp.id, { type: 'list' })}
										/>
										一覧（テーブル表示・編集可）
									</label>
									<label class="radio-label">
										<input type="radio" name="type-{comp.id}" value="form"
											checked={comp.type === 'form'}
											onchange={() => updateComponent(comp.id, { type: 'form' })}
										/>
										フォーム（新規登録）
									</label>
								</div>
							</div>

							<!-- Table -->
							<div class="field-group">
								<label class="field-label" for="table-{comp.id}">テーブル</label>
								{#if data.tables.length === 0}
									<p class="field-hint">このアプリにテーブルがありません。</p>
								{:else}
									<select
										id="table-{comp.id}"
										class="field-select"
										value={comp.tableId}
										onchange={(e) => updateComponent(comp.id, { tableId: e.currentTarget.value, fields: null })}
									>
										{#each data.tables as t}
											<option value={t.id}>{t.label}</option>
										{/each}
									</select>
								{/if}
							</div>

							<!-- Title -->
							<div class="field-group">
								<label class="field-label" for="title-{comp.id}">タイトル（省略可）</label>
								<input
									id="title-{comp.id}"
									class="field-input"
									type="text"
									value={comp.title ?? ''}
									oninput={(e) => updateComponent(comp.id, { title: e.currentTarget.value || null })}
									placeholder="省略するとテーブル名を使用"
								/>
							</div>

							<!-- Fields -->
							{#if tableFields.length > 0}
								<div class="field-group">
									<label class="field-label">表示フィールド</label>
									<div class="check-grid">
										{#each tableFields as f}
											<label class="check-label">
												<input
													type="checkbox"
													checked={isFieldShown(comp, f.key)}
													onchange={() => toggleField(comp.id, f.key, tableFields)}
												/>
												{f.label}
												<span class="field-type-tag">{f.type}</span>
											</label>
										{/each}
									</div>
									{#if !comp.fields?.length}
										<p class="field-hint">全フィールドを表示中</p>
									{/if}
								</div>
							{/if}

							<!-- Actions -->
							<div class="field-group">
								<label class="field-label">使用可能なアクション</label>
								<div class="check-row">
									{#each [['create', '作成'], ['edit', '編集'], ['delete', '削除']] as [action, label]}
										<label class="check-label">
											<input
												type="checkbox"
												checked={(comp.actions ?? []).includes(action as 'create' | 'edit' | 'delete')}
												onchange={() => toggleAction(comp.id, action as 'create' | 'edit' | 'delete')}
											/>
											{label}
										</label>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<button class="btn-add" onclick={addComponent} disabled={data.tables.length === 0}>
				+ コンポーネントを追加
			</button>
		</section>
	</div>
</div>

<style lang="scss">
	.build-page {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── Header ──────────────────────────────────────────────── */
	.build-header {
		padding: 16px 32px 12px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		&:hover { color: var(--color-text); }
	}

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.page-label-input {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		outline: none;
		padding: 2px 4px;
		font-family: inherit;
		transition: border-color 0.15s;
		&:focus { border-bottom-color: var(--color-primary); }
	}

	.page-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.saved-msg {
		font-size: 0.8125rem;
		color: var(--color-success, #16a34a);
	}

	/* ── Body ────────────────────────────────────────────────── */
	.build-body {
		flex: 1;
		overflow-y: auto;
		padding: 28px 32px;
	}

	.section {
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.section-desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0 0 4px;
	}

	.empty-comp {
		padding: 24px;
		border: 1px dashed var(--color-border);
		border-radius: 8px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* ── Component card ──────────────────────────────────────── */
	.comp-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
		overflow: hidden;
		transition: border-color 0.15s;

		&.expanded { border-color: var(--color-primary); }
	}

	.comp-card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		cursor: pointer;
		user-select: none;

		&:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
	}

	.comp-type-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		white-space: nowrap;
		flex-shrink: 0;

		&.form {
			background: color-mix(in srgb, #8b5cf6 12%, transparent);
			color: #7c3aed;
		}
	}

	.comp-summary {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;

		strong {
			font-size: 0.9375rem;
			color: var(--color-text);
		}
	}

	.comp-meta {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.comp-card-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.icon-btn {
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 5px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s, color 0.1s;

		&:hover:not(:disabled) { background: var(--color-border); color: var(--color-text); }
		&:disabled { opacity: 0.3; cursor: not-allowed; }
		&.danger:hover:not(:disabled) { color: var(--color-danger); }
	}

	.expand-icon {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.comp-card-body {
		padding: 16px 20px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* ── Field groups inside card ────────────────────────────── */
	.field-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.field-input, .field-select {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.15s;
		&:focus { border-color: var(--color-primary); }
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.check-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 6px;
	}

	.check-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.check-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.field-type-tag {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		background: var(--color-border);
		padding: 1px 5px;
		border-radius: 3px;
	}

	/* ── Add component button ────────────────────────────────── */
	.btn-add {
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px dashed var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		width: 100%;
		font-family: inherit;
		transition: border-color 0.15s, color 0.15s;

		&:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* ── Buttons ─────────────────────────────────────────────── */
	.btn-primary {
		padding: 7px 18px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover:not(:disabled) { opacity: 0.88; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.btn-secondary {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
		&:hover { background: var(--color-border); }
	}

	.btn-danger-ghost {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}
</style>
