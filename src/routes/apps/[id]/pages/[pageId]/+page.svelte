<script lang="ts">
	import { createPageViewState } from './index.svelte';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';
	import { isRefField } from '$lib/types/chat';
	import type { PageData } from './$types';
	import type { FieldDef } from '$lib/server/db/table-service';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();
	const s = createPageViewState(() => data);

	function inputType(field: FieldDef): string {
		if (field.type === 'number') return 'number';
		if (field.type === 'date') return 'date';
		if (field.type === 'email') return 'email';
		if (field.type === 'tel') return 'tel';
		return 'text';
	}
</script>

<div class="app-page">
	<!-- ── ヘッダー ──────────────────────────────────────────────── -->
	<header class="app-header">
		<div class="header-left">
			<a href="/apps/{data.app.id}" class="app-brand">
				<AppIcon icon={data.app.icon} size={20} />
				<span class="app-name">{data.app.label}</span>
			</a>
			{#if data.account?.permission === 'admin'}
				<a href="/apps/{data.app.id}/pages/{data.page.id}/build" class="btn-settings">設定</a>
			{/if}
		</div>
		<nav class="page-nav">
			{#each data.allPages as pg (pg.id)}
				<a
					href="/apps/{data.app.id}/pages/{pg.id}"
					class="nav-link"
					class:active={pg.id === data.page.id}
				>{pg.label}</a>
			{/each}
		</nav>
	</header>

	<!-- ── メインコンテンツ ────────────────────────────────────── -->
	<main class="app-body">
		{#if !data.et}
			<div class="unconfigured">
				<p>テーブルが設定されていません。</p>
				{#if data.account?.permission === 'admin'}
					<a href="/apps/{data.app.id}/pages/{data.page.id}/build" class="btn-primary">ページ設定を開く</a>
				{/if}
			</div>

		{:else if s.isDetail && data.record}
			<!-- ── 詳細ビュー ────────────────────────────────────── -->
			<div class="detail-view">
				<div class="detail-header">
					<button class="back-btn" onclick={s.closeDetail}>← 前の画面に戻る</button>
					<div class="detail-actions">
						{#if data.page.config.actions.includes('edit')}
							<button class="btn-secondary" onclick={() => s.openEdit(
								data.et!.id, data.et!.name, data.fields, data.recordOptions, data.record!
							)}>編集</button>
						{/if}
						{#if data.page.config.actions.includes('delete')}
							<button class="btn-danger" onclick={async () => {
								if (!confirm('このレコードを削除しますか？')) return;
								const res = await fetch(`/api/database/${data.et!.name}/records/${data.record!.id}?appId=${data.app.id}`, { method: 'DELETE' });
								if (res.ok || res.status === 204) s.closeDetail();
							}}>削除</button>
						{/if}
					</div>
				</div>

				<section class="detail-card">
					<dl class="field-list">
						{#each data.displayFields as field}
							<div class="field-row">
								<dt>{field.label}</dt>
								<dd>{s.displayValue(data.record[field.key], field, data.recordOptions)}</dd>
							</div>
						{/each}
					</dl>
				</section>

				{#each data.relatedSections as section (section.config.tableId + section.config.refFieldKey)}
					<section class="related-section">
						<div class="related-section-header">
							<h2 class="related-title">{section.tableLabel}</h2>
							{#if section.config.actions.includes('create')}
								<button class="btn-primary btn-sm" onclick={() => s.openNew(
									section.config.tableId, section.tableName, section.fields, section.recordOptions,
									{ [section.config.refFieldKey]: String(data.record!.id) }
								)}>+ 登録</button>
							{/if}
						</div>
						{#if section.records.length === 0}
							<p class="empty-msg">データがありません</p>
						{:else}
							<div class="table-wrap">
								<table>
									<thead>
										<tr>
											{#each section.displayFields as f}<th>{f.label}</th>{/each}
											{#if section.config.actions.includes('edit') || section.config.actions.includes('delete') || section.config.actions.includes('detail')}
												<th class="actions-col">操作</th>
											{/if}
										</tr>
									</thead>
									<tbody>
										{#each section.records as row (row.id)}
											<tr>
												{#each section.displayFields as f}
													<td>{s.formatCell(row, f, section.recordOptions)}</td>
												{/each}
												{#if section.config.actions.includes('edit') || section.config.actions.includes('delete') || section.config.actions.includes('detail')}
													<td class="row-actions">
														{#if section.config.actions.includes('detail')}
															{@const detailPage = data.allPages.find(p => p.tableId === section.config.tableId)}
															{#if detailPage}
																<a class="action-btn" href="/apps/{data.app.id}/pages/{detailPage.id}?recordId={row.id}&from={encodeURIComponent(page.url.href)}">詳細</a>
															{:else}
																<button class="action-btn" onclick={() => s.openEdit(
																	section.config.tableId, section.tableName, section.fields, section.recordOptions, row
																)}>詳細</button>
															{/if}
														{/if}
														{#if section.config.actions.includes('edit')}
															<button class="action-btn" onclick={() => s.openEdit(
																section.config.tableId, section.tableName, section.fields, section.recordOptions, row
															)}>編集</button>
														{/if}
														{#if section.config.actions.includes('delete')}
															<button class="action-btn danger" onclick={async () => {
																if (!confirm('削除しますか？')) return;
																const res = await fetch(`/api/database/${section.tableName}/records/${row.id}?appId=${data.app.id}`, { method: 'DELETE' });
																if (res.ok || res.status === 204) { const { invalidateAll } = await import('$app/navigation'); await invalidateAll(); }
															}}>削除</button>
														{/if}
													</td>
												{/if}
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</section>
				{/each}
			</div>

		{:else}
			<!-- ── 一覧ビュー ────────────────────────────────────── -->
			<div class="list-view">
				<div class="list-header">
					<h1 class="list-title">{data.page.label}</h1>
					{#if data.page.config.actions.includes('create')}
						<button class="btn-primary" onclick={() => s.openNew(data.et!.id, data.et!.name, data.fields, data.recordOptions)}>
							+ 新規追加
						</button>
					{/if}
				</div>

				{#if data.displayFields.length === 0}
					<div class="unconfigured">
						<p>表示フィールドが設定されていません。</p>
						{#if data.account?.permission === 'admin'}
							<a href="/apps/{data.app.id}/tables/{data.et.id}/build" class="btn-primary">テーブル設定を開く</a>
						{/if}
					</div>
				{:else if data.records.length === 0}
					<div class="empty">
						<p class="empty-title">データがまだありません</p>
						{#if data.page.config.actions.includes('create')}
							<button class="btn-primary" onclick={() => s.openNew(data.et!.id, data.et!.name, data.fields, data.recordOptions)}>
								最初のデータを追加
							</button>
						{/if}
					</div>
				{:else}
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									{#each data.displayFields as field}<th>{field.label}</th>{/each}
									<th class="actions-col">操作</th>
								</tr>
							</thead>
							<tbody>
								{#each data.records as row (row.id)}
									<tr>
										{#each data.displayFields as field}
											<td>{s.formatCell(row, field, data.recordOptions)}</td>
										{/each}
										<td class="row-actions">
											{#if data.page.config.actions.includes('detail')}
												<button class="action-btn" onclick={() => s.openDetail(row.id as string)}>詳細</button>
											{/if}
											{#if data.page.config.actions.includes('edit')}
												<button class="action-btn" onclick={() => s.openEdit(data.et!.id, data.et!.name, data.fields, data.recordOptions, row)}>編集</button>
											{/if}
											{#if data.page.config.actions.includes('delete')}
												<button class="action-btn danger" onclick={async () => {
													if (!confirm('削除しますか？')) return;
													const res = await fetch(`/api/database/${data.et!.name}/records/${row.id}?appId=${data.app.id}`, { method: 'DELETE' });
													if (res.ok || res.status === 204) { const { invalidateAll } = await import('$app/navigation'); await invalidateAll(); }
												}}>削除</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- ── 編集ドロワー ───────────────────────────────────────── -->
	{#if s.drawer}
		<div class="drawer-overlay" role="presentation" onclick={s.closeDrawer}></div>
		<div class="drawer">
			<div class="drawer-header">
				<h2 class="drawer-title">{s.drawer.mode === 'new' ? '新規追加' : '編集'}</h2>
				<button class="drawer-close" onclick={s.closeDrawer} aria-label="閉じる">✕</button>
			</div>
			<div class="drawer-body">
				{#if s.drawer.saveError}
					<p class="save-error">{s.drawer.saveError}</p>
				{/if}
				{#each s.drawer.fields as field}
					<div class="form-row">
						<label class="form-label" for="d-{field.key}">
							{field.label}{#if field.required}<span class="req">*</span>{/if}
						</label>
						{#if isRefField(field.type)}
							<SearchSelect
								bind:value={s.drawer.formData[field.key]}
								options={s.drawer.recordOptions[field.key] ?? []}
								placeholder="選択または検索…"
								required={field.required}
							/>
						{:else if field.type === 'select'}
							<select id="d-{field.key}" class="form-input" bind:value={s.drawer.formData[field.key]}>
								{#if !field.required}<option value="">— 選択してください —</option>{/if}
								{#each (field.options ?? []) as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						{:else if field.type === 'textarea'}
							<textarea id="d-{field.key}" class="form-textarea" bind:value={s.drawer.formData[field.key]} rows="4"></textarea>
						{:else}
							<input id="d-{field.key}" class="form-input" type={inputType(field)} bind:value={s.drawer.formData[field.key]} required={field.required} />
						{/if}
					</div>
				{/each}
			</div>
			<div class="drawer-footer">
				{#if s.drawer.mode === 'edit'}
					<button class="btn-danger-ghost" onclick={s.deleteRecord} disabled={s.drawer.deleting}>
						{s.drawer.deleting ? '削除中…' : '削除'}
					</button>
				{/if}
				<div class="footer-right">
					<button class="btn-secondary" onclick={s.closeDrawer}>キャンセル</button>
					<button class="btn-primary" onclick={s.saveRecord} disabled={s.drawer.saving}>
						{s.drawer.saving ? '保存中…' : '保存'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
/* ── レイアウト ─────────────────────────────────────────── */
.app-page {
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
	background: var(--color-background);
	color: var(--color-text);
}

/* ── ヘッダー ───────────────────────────────────────────── */
.app-header {
	display: flex;
	align-items: center;
	gap: 24px;
	padding: 0 24px;
	height: 52px;
	border-bottom: 1px solid var(--color-border);
	background: var(--color-surface);
	flex-shrink: 0;
}

.header-left { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

.app-brand {
	display: flex;
	align-items: center;
	gap: 8px;
	text-decoration: none;
	color: var(--color-text);

	&:hover .app-name { color: var(--color-primary); }
}

.app-name {
	font-weight: 600;
	font-size: 0.9375rem;
	transition: color 0.15s;
}

.page-nav {
	display: flex;
	align-items: center;
	gap: 2px;
	margin-left: auto;
	overflow-x: auto;
}

.nav-link {
	padding: 5px 12px;
	border-radius: 6px;
	text-decoration: none;
	color: var(--color-text-muted);
	font-size: 0.875rem;
	white-space: nowrap;
	transition: background 0.15s, color 0.15s;

	&:hover { background: var(--color-border); color: var(--color-text); }
	&.active {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		font-weight: 500;
	}
}


.btn-settings {
	padding: 5px 12px;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	font-size: 0.8125rem;
	color: var(--color-text-muted);
	text-decoration: none;
	background: transparent;
	transition: border-color 0.15s, color 0.15s;
	white-space: nowrap;

	&:hover { border-color: var(--color-primary); color: var(--color-primary); }
}

/* ── ボディ ─────────────────────────────────────────────── */
.app-body {
	flex: 1;
	overflow-y: auto;
	padding: 24px 32px;
}

/* ── 一覧ビュー ─────────────────────────────────────────── */
.list-view { display: flex; flex-direction: column; gap: 16px; }

.list-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.list-title { font-size: 1.125rem; font-weight: 600; margin: 0; }

.table-wrap { overflow-x: auto; }

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.875rem;

	th, td {
		padding: 10px 12px;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	th {
		font-weight: 500;
		color: var(--color-text-muted);
		background: var(--color-surface);
		white-space: nowrap;
	}

	td { color: var(--color-text); vertical-align: middle; }

	tbody tr:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
}

.ts-col, .ts { color: var(--color-text-muted); white-space: nowrap; font-size: 0.8125rem; }
.actions-col { width: 1px; white-space: nowrap; }

.row-actions {
	display: flex;
	gap: 4px;
	align-items: center;
	white-space: nowrap;
}

.action-btn {
	padding: 3px 10px;
	border: 1px solid var(--color-border);
	border-radius: 5px;
	background: transparent;
	color: var(--color-text-muted);
	font-size: 0.75rem;
	cursor: pointer;
	transition: border-color 0.15s, color 0.15s, background 0.15s;

	&:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	&.danger:hover {
		border-color: var(--color-error);
		color: var(--color-error);
	}
}

/* ── 詳細ビュー ─────────────────────────────────────────── */
.detail-view { display: flex; flex-direction: column; gap: 24px; }

.detail-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

.back-btn {
	background: none;
	border: none;
	color: var(--color-text-muted);
	font-size: 0.875rem;
	cursor: pointer;
	padding: 0;
	transition: color 0.15s;
	&:hover { color: var(--color-primary); }
}

.detail-actions { display: flex; gap: 8px; }

.detail-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: 10px;
	padding: 20px 24px;
	max-width: 720px;
}

.field-list { display: flex; flex-direction: column; gap: 12px; }

.field-row {
	display: grid;
	grid-template-columns: 140px 1fr;
	gap: 12px;
	align-items: baseline;

	dt { color: var(--color-text-muted); font-size: 0.875rem; }
	dd { margin: 0; color: var(--color-text); font-size: 0.9375rem; word-break: break-word; }
}

.related-section { display: flex; flex-direction: column; gap: 12px; }
.related-section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}
.related-title { font-size: 1rem; font-weight: 600; margin: 0; }
.empty-msg { color: var(--color-text-muted); font-size: 0.875rem; }

/* ── 空・未設定 ─────────────────────────────────────────── */
.unconfigured, .empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 64px 24px;
	text-align: center;
	color: var(--color-text-muted);
}

.empty-title { font-size: 1rem; margin: 0; }

/* ── ドロワー ────────────────────────────────────────────── */
.drawer-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.2);
	z-index: 100;
}

.drawer {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	width: min(480px, 92vw);
	background: var(--color-surface);
	border-left: 1px solid var(--color-border);
	z-index: 101;
	display: flex;
	flex-direction: column;
	box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
}

.drawer-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px;
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;
}

.drawer-title { margin: 0; font-size: 1rem; font-weight: 600; }

.drawer-close {
	background: none;
	border: none;
	color: var(--color-text-muted);
	font-size: 1rem;
	cursor: pointer;
	padding: 4px 8px;
	border-radius: 4px;
	transition: background 0.15s;
	&:hover { background: var(--color-border); }
}

.drawer-body {
	flex: 1;
	overflow-y: auto;
	padding: 20px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.drawer-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px 20px;
	border-top: 1px solid var(--color-border);
	flex-shrink: 0;
}

.footer-right { display: flex; gap: 8px; }

/* ── フォーム ────────────────────────────────────────────── */
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--color-text-muted);
}
.req { color: var(--color-error); margin-left: 2px; }

.form-input, .form-textarea {
	padding: 8px 12px;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	background: var(--color-background);
	color: var(--color-text);
	font-size: 0.9375rem;
	font-family: inherit;
	outline: none;
	width: 100%;
	box-sizing: border-box;
	&:focus { border-color: var(--color-primary); }
}

.form-textarea { min-height: 100px; resize: vertical; }

.save-error {
	padding: 10px 14px;
	background: color-mix(in srgb, var(--color-error) 10%, transparent);
	border: 1px solid var(--color-error);
	border-radius: 6px;
	color: var(--color-error);
	font-size: 0.875rem;
	margin: 0;
}

/* ── ボタン ─────────────────────────────────────────────── */
.btn-primary {
	padding: 8px 18px;
	background: var(--color-primary);
	color: #fff;
	border: none;
	border-radius: 6px;
	font-size: 0.875rem;
	cursor: pointer;
	text-decoration: none;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	transition: opacity 0.15s;
	&:hover { opacity: 0.88; }
	&:disabled { opacity: 0.5; cursor: not-allowed; }
	&.btn-sm { padding: 4px 10px; font-size: 0.8125rem; }
}

.btn-secondary {
	padding: 7px 16px;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	background: transparent;
	color: var(--color-text-muted);
	font-size: 0.875rem;
	cursor: pointer;
	text-decoration: none;
	transition: border-color 0.15s, color 0.15s;
	&:hover { border-color: var(--color-primary); color: var(--color-primary); }
}

.btn-danger {
	padding: 7px 16px;
	border: 1px solid var(--color-error);
	border-radius: 6px;
	background: transparent;
	color: var(--color-error);
	font-size: 0.875rem;
	cursor: pointer;
	transition: background 0.15s;
	&:hover { background: color-mix(in srgb, var(--color-error) 10%, transparent); }
}

.btn-danger-ghost {
	background: none;
	border: none;
	color: var(--color-error);
	font-size: 0.875rem;
	cursor: pointer;
	padding: 7px 0;
	transition: opacity 0.15s;
	&:hover { opacity: 0.75; }
	&:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
