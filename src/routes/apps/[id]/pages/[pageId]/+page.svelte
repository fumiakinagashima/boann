<script lang="ts">
	import { createPageViewState } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';
	import { isRefField } from '$lib/types/chat';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createPageViewState(() => data);
</script>

<div class="page-layout">
	<div class="main-col">
		<div class="page-header">
			<a href="/apps/{data.app.id}" class="back-link">
				<ChevronLeft size={16} />
				{data.app.label}
			</a>
			<div class="header-main">
				<div class="header-title">
					<span class="app-icon"><AppIcon icon={data.app.icon} size={24} /></span>
					<h1>{data.page.label}</h1>
				</div>
				{#if data.account?.permission === 'admin'}
					<a href="/apps/{data.app.id}/pages/{data.page.id}/build" class="btn-secondary">ページ設定</a>
				{/if}
			</div>
		</div>

		{#each s.componentData as comp, i (comp.component.id)}
			{#if comp.component.type === 'list'}
				<!-- List component -->
				<section class="component-section">
					{#if s.componentData.length > 1 || comp.component.title}
						<div class="section-header">
							<h2 class="section-title">{comp.component.title || comp.tableLabel}</h2>
							{#if comp.component.actions.includes('create')}
								<button class="btn-primary" onclick={() => s.openNew(i)}>+ 新規追加</button>
							{/if}
						</div>
					{:else}
						<div class="section-header single">
							{#if comp.component.actions.includes('create')}
								<button class="btn-primary" onclick={() => s.openNew(i)}>+ 新規追加</button>
							{/if}
						</div>
					{/if}

					{#if comp.displayFields.length === 0}
						<div class="empty">
							<p class="empty-title">フィールドが設定されていません</p>
							{#if data.account?.permission === 'admin'}
								<a href="/apps/{data.app.id}/tables/{comp.tableId}/build" class="btn-primary">テーブル設定を開く</a>
							{/if}
						</div>
					{:else if comp.records.length === 0}
						<div class="empty">
							<p class="empty-title">レコードがまだありません</p>
							{#if comp.component.actions.includes('create')}
								<button class="btn-primary" onclick={() => s.openNew(i)}>+ 新規追加</button>
							{/if}
						</div>
					{:else}
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										{#each comp.displayFields as field}
											<th>{field.label}</th>
										{/each}
										<th>登録日時</th>
									</tr>
								</thead>
								<tbody>
									{#each comp.records as row (row.id)}
										{@const clickable = comp.component.actions.includes('edit')}
										<tr
											class:clickable
											class:active={s.activeEdit?.editingId === row.id && s.activeEdit?.compIdx === i}
											onclick={clickable ? () => s.openEdit(i, row) : undefined}
											role={clickable ? 'button' : undefined}
											tabindex={clickable ? 0 : undefined}
											onkeydown={clickable ? (e) => { if (e.key === 'Enter') s.openEdit(i, row); } : undefined}
										>
											{#each comp.displayFields as field}
												<td>{s.formatCell(row, field, comp)}</td>
											{/each}
											<td class="ts">{s.formatTs(row.createdAt as number)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>

			{:else if comp.component.type === 'form'}
				<!-- Form component -->
				{@const submitState = s.getFormSubmitState(i)}
				<section class="component-section form-section">
					{#if s.componentData.length > 1 || comp.component.title}
						<h2 class="section-title">{comp.component.title || comp.tableLabel}</h2>
					{/if}

					{#if submitState.done}
						<div class="form-success">✓ 登録しました</div>
					{/if}

					<form
						class="standalone-form"
						onsubmit={(e) => { e.preventDefault(); s.submitStandaloneForm(i, e.currentTarget); }}
					>
						{#each comp.displayFields as field}
							<div class="form-row">
								<label class="form-label" for="sf-{i}-{field.key}">
									{field.label}
									{#if field.required}<span class="req-mark">*</span>{/if}
								</label>
								{#if isRefField(field.type)}
									<SearchSelect
										bind:value={s.activeEdit!.formData[field.key]}
										options={comp.recordOptions[field.key] ?? []}
										placeholder="選択または検索…"
										required={field.required}
									/>
								{:else if field.type === 'select'}
									<select id="sf-{i}-{field.key}" name={field.key} class="form-select">
										{#if !field.required}<option value="">— 選択してください —</option>{/if}
										{#each (field.options ?? []) as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else if field.type === 'textarea'}
									<textarea id="sf-{i}-{field.key}" name={field.key} class="form-textarea" rows="3" placeholder={field.description || ''}></textarea>
								{:else}
									<input
										id="sf-{i}-{field.key}"
										name={field.key}
										class="form-input"
										type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
										placeholder={field.description || ''}
										required={field.required}
									/>
								{/if}
								{#if field.description}
									<p class="form-hint">{field.description}</p>
								{/if}
							</div>
						{/each}

						<div class="form-footer">
							{#if submitState.error}<span class="save-error">{submitState.error}</span>{/if}
							<button class="btn-primary" type="submit" disabled={submitState.submitting}>
								{submitState.submitting ? '登録中…' : '登録する'}
							</button>
						</div>
					</form>
				</section>
			{/if}
		{:else}
			<div class="empty">
				<p class="empty-title">コンポーネントが設定されていません</p>
				{#if data.account?.permission === 'admin'}
					<a href="/apps/{data.app.id}/pages/{data.page.id}/build" class="btn-primary">ページ設定を開く</a>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Shared form drawer -->
	{#if s.activeEdit}
		<div class="drawer-backdrop" onclick={s.closeForm} role="presentation"></div>
		<div class="form-panel">
			<div class="form-panel-header">
				<h2>{s.activeEdit.mode === 'new' ? '新規レコード' : 'レコードを編集'}</h2>
				<button class="form-close-btn" onclick={s.closeForm} aria-label="閉じる">×</button>
			</div>
			<div class="form-panel-body">
				{#each s.activeFields as field}
					<div class="form-row">
						<label class="form-label" for="field-{field.key}">
							{field.label}
							{#if field.required}<span class="req-mark">*</span>{/if}
						</label>
						{#if isRefField(field.type)}
							<SearchSelect
								bind:value={s.activeEdit.formData[field.key]}
								options={s.activeRecordOptions[field.key] ?? []}
								placeholder="選択または検索…"
								required={field.required}
							/>
						{:else if field.type === 'select'}
							<select id="field-{field.key}" class="form-select" bind:value={s.activeEdit.formData[field.key]}>
								{#if !field.required}<option value="">— 選択してください —</option>{/if}
								{#each (field.options ?? []) as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						{:else if field.type === 'textarea'}
							<textarea
								id="field-{field.key}"
								class="form-textarea"
								bind:value={s.activeEdit.formData[field.key]}
								placeholder={field.description || ''}
								rows="3"
							></textarea>
						{:else}
							<input
								id="field-{field.key}"
								class="form-input"
								type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
								bind:value={s.activeEdit.formData[field.key]}
								placeholder={field.description || ''}
							/>
						{/if}
						{#if field.description}
							<p class="form-hint">{field.description}</p>
						{/if}
					</div>
				{/each}
			</div>
			<div class="form-panel-footer">
				{#if s.activeEdit.mode === 'edit' && s.componentData[s.activeEdit.compIdx]?.component.actions.includes('delete')}
					<button class="btn-delete" onclick={s.deleteRecord} disabled={s.activeEdit.deleting}>
						{s.activeEdit.deleting ? '削除中…' : '削除'}
					</button>
				{/if}
				<div class="footer-right">
					{#if s.activeEdit.saveError}<span class="save-error">{s.activeEdit.saveError}</span>{/if}
					<button class="btn-cancel" onclick={s.closeForm}>キャンセル</button>
					<button class="btn-save" onclick={s.saveRecord} disabled={s.activeEdit.saving}>
						{s.activeEdit.saving ? '保存中…' : '保存'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.page-layout { height: 100%; overflow: hidden; position: relative; }

	.main-col {
		padding: 28px 32px;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 40;
	}

	/* ── Page header ─────────────────────────────────── */
	.page-header { flex-shrink: 0; }

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 12px;
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
		gap: 12px;
	}

	.app-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		color: var(--color-primary);
		flex-shrink: 0;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	/* ── Component sections ──────────────────────────── */
	.component-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;

		&.single {
			justify-content: flex-end;
		}
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	/* ── Table ───────────────────────────────────────── */
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: 10px;
	}

	table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
	thead { background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
	th {
		padding: 10px 14px;
		text-align: left;
		font-weight: 600;
		color: var(--color-text-muted);
		white-space: nowrap;
		font-size: 0.8125rem;
	}
	tbody tr {
		border-bottom: 1px solid var(--color-border);
		transition: background 0.1s;
		&:last-child { border-bottom: none; }
		&.clickable {
			cursor: pointer;
			&:hover { background: var(--color-surface); }
		}
		&.active { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); }
	}
	td { padding: 10px 14px; color: var(--color-text); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.ts { font-size: 0.8125rem; color: var(--color-text-muted); }

	/* ── Standalone form ─────────────────────────────── */
	.form-section {
		max-width: 520px;
	}

	.standalone-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
	}

	.form-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		padding-top: 8px;
	}

	.form-success {
		padding: 10px 14px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-success, #16a34a) 10%, transparent);
		color: var(--color-success, #16a34a);
		font-size: 0.875rem;
		font-weight: 500;
	}

	/* ── Empty state ─────────────────────────────────── */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 60px 0;
		text-align: center;
	}
	.empty-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; }

	/* ── Form fields (shared) ────────────────────────── */
	.form-row { display: flex; flex-direction: column; gap: 5px; }
	.form-label { font-size: 0.8125rem; font-weight: 500; color: var(--color-text); }
	.req-mark { color: var(--color-danger); margin-left: 2px; }
	.form-hint { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; line-height: 1.5; }
	.save-error { font-size: 0.8125rem; color: var(--color-danger); }

	.form-input, .form-select, .form-textarea {
		padding: 8px 10px;
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
		&::placeholder { color: var(--color-text-muted); opacity: 0.6; }
	}
	.form-textarea { resize: vertical; }

	/* ── Buttons ─────────────────────────────────────── */
	.btn-primary {
		padding: 7px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.15s;
		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
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

	/* ── Form panel (drawer) ─────────────────────────── */
	.form-panel {
		position: fixed;
		top: 0; right: 0; bottom: 0;
		width: 520px;
		max-width: 100vw;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
		z-index: 50;
		animation: drawer-in 0.22s ease;
	}
	@keyframes drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }

	.form-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		h2 { font-size: 0.9375rem; font-weight: 600; color: var(--color-text); margin: 0; }
	}
	.form-close-btn {
		width: 28px; height: 28px;
		border: none; background: none;
		color: var(--color-text-muted); font-size: 1.125rem;
		cursor: pointer; border-radius: 5px;
		display: flex; align-items: center; justify-content: center;
		transition: background 0.1s, color 0.1s;
		&:hover { background: var(--color-border); color: var(--color-text); }
	}

	.form-panel-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }

	.form-panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 14px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
		background: var(--color-surface);
	}
	.footer-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

	.btn-save {
		padding: 7px 18px; border-radius: 6px; font-size: 0.875rem; font-weight: 500;
		background: var(--color-primary); color: #fff; border: none; cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}
	.btn-cancel {
		padding: 7px 14px; border-radius: 6px; font-size: 0.875rem;
		border: 1px solid var(--color-border); background: none; color: var(--color-text);
		cursor: pointer; transition: background 0.15s;
		&:hover { background: var(--color-border); }
	}
	.btn-delete {
		padding: 7px 14px; border-radius: 6px; font-size: 0.875rem;
		border: 1px solid var(--color-border); background: none; color: var(--color-text-muted);
		cursor: pointer; transition: border-color 0.15s, color 0.15s;
		&:hover { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}
</style>
