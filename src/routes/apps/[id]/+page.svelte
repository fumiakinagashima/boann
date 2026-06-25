<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatJstDateTime } from '$lib/datetime';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import type { PageData } from './$types';
	import type { FieldDef, RecordRow } from '$lib/server/db/table-service';

	let { data }: { data: PageData } = $props();

	let records = $state<RecordRow[]>(data.records);
	$effect(() => { records = data.records; });

	const fields = $derived(data.fields as FieldDef[]);
	const listFields = $derived(fields.filter((f) => f.listable !== false).slice(0, 7));

	// ── Form panel ────────────────────────────────────────────
	type FormMode = 'new' | 'edit';
	let formMode = $state<FormMode>('new');
	let formOpen = $state(false);
	let formData = $state<Record<string, string>>({});
	let editingId = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state('');
	let deleting = $state(false);

	function openNew() {
		formMode = 'new';
		editingId = null;
		saveError = '';
		const init: Record<string, string> = {};
		for (const f of fields) {
			init[f.key] = f.defaultValue ?? '';
		}
		formData = init;
		formOpen = true;
	}

	function openEdit(row: RecordRow) {
		formMode = 'edit';
		editingId = row.id as string;
		saveError = '';
		const init: Record<string, string> = {};
		for (const f of fields) {
			const v = row[f.key];
			init[f.key] = v != null ? String(v) : (f.defaultValue ?? '');
		}
		formData = init;
		formOpen = true;
	}

	function closeForm() {
		formOpen = false;
		editingId = null;
	}

	async function saveRecord() {
		saving = true;
		saveError = '';
		try {
			const url = formMode === 'new'
				? `/api/database/${data.app.name}/records`
				: `/api/database/${data.app.name}/records/${editingId}`;
			const method = formMode === 'new' ? 'POST' : 'PATCH';
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				saveError = body.error ?? '保存に失敗しました';
				return;
			}
			closeForm();
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function deleteRecord() {
		if (!confirm('このレコードを削除しますか？')) return;
		deleting = true;
		try {
			const res = await fetch(`/api/database/${data.app.name}/records/${editingId}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				closeForm();
				await invalidateAll();
			}
		} finally {
			deleting = false;
		}
	}

	function formatCell(row: RecordRow, field: FieldDef): string {
		const val = row[field.key];
		if (val == null || val === '') return '—';
		if (field.type === 'select') {
			const opt = (field.options ?? []).find(o => o.value === String(val));
			return opt ? opt.label : String(val);
		}
		if (field.type === 'date' && typeof val === 'number') {
			return new Date(val * 1000).toLocaleDateString('ja-JP');
		}
		return String(val);
	}

	function formatTs(ts: number | null | undefined): string {
		if (!ts) return '—';
		return formatJstDateTime(new Date(ts * 1000));
	}
</script>

<div class="page-layout">
	<!-- Main area -->
	<div class="main-col">
		<div class="page-header">
			<a href="/" class="back-link">
				<ChevronLeft size={16} />
				アプリ一覧
			</a>
			<div class="header-main">
				<div class="header-title">
					<span class="app-icon">{data.app.icon ?? '📋'}</span>
					<h1>{data.app.label}</h1>
				</div>
				<div class="header-actions">
					{#if data.account?.permission === 'admin'}
						<a href="/apps/{data.app.id}/build" class="btn-secondary">⚙ アプリ設定</a>
					{/if}
					<button class="btn-primary" onclick={openNew}>+ レコード追加</button>
				</div>
			</div>
		</div>

		{#if fields.length === 0}
			<div class="empty">
				<p class="empty-title">フィールドが設定されていません</p>
				{#if data.account?.permission === 'admin'}
					<p class="empty-desc">アプリ設定でフィールドを追加してください。</p>
					<a href="/apps/{data.app.id}/build" class="btn-primary">⚙ アプリ設定を開く</a>
				{/if}
			</div>
		{:else if records.length === 0}
			<div class="empty">
				<p class="empty-title">レコードがまだありません</p>
				<p class="empty-desc">「レコード追加」からデータを登録してください。</p>
				<button class="btn-primary" onclick={openNew}>+ レコード追加</button>
			</div>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							{#each listFields as field}
								<th>{field.label}</th>
							{/each}
							<th>登録日時</th>
						</tr>
					</thead>
					<tbody>
						{#each records as row (row.id)}
							<tr
								onclick={() => openEdit(row)}
								class:active={editingId === row.id}
								role="button"
								tabindex="0"
								onkeydown={(e) => { if (e.key === 'Enter') openEdit(row); }}
							>
								{#each listFields as field}
									<td>{formatCell(row, field)}</td>
								{/each}
								<td class="ts">{formatTs(row.createdAt as number)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Drawer backdrop -->
	{#if formOpen}
		<div
			class="drawer-backdrop"
			onclick={closeForm}
			role="presentation"
		></div>
	{/if}

	<!-- Form panel -->
	{#if formOpen}
		<div class="form-panel">
			<div class="form-panel-header">
				<h2>{formMode === 'new' ? '新規レコード' : 'レコードを編集'}</h2>
				<button class="form-close-btn" onclick={closeForm} aria-label="閉じる">×</button>
			</div>

			<div class="form-panel-body">
				{#each fields as field}
					<div class="form-row">
						<label class="form-label" for="field-{field.key}">
							{field.label}
							{#if field.required}<span class="req-mark">*</span>{/if}
						</label>

						{#if field.type === 'select'}
							<select
								id="field-{field.key}"
								class="form-select"
								bind:value={formData[field.key]}
							>
								{#if !field.required}<option value="">— 選択してください —</option>{/if}
								{#each (field.options ?? []) as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						{:else if field.type === 'textarea'}
							<textarea
								id="field-{field.key}"
								class="form-textarea"
								bind:value={formData[field.key]}
								placeholder={field.description || ''}
								rows="3"
							></textarea>
						{:else}
							<input
								id="field-{field.key}"
								class="form-input"
								type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
								bind:value={formData[field.key]}
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
				{#if formMode === 'edit'}
					<button class="btn-delete" onclick={deleteRecord} disabled={deleting}>
						{deleting ? '削除中…' : '削除'}
					</button>
				{/if}
				<div class="footer-right">
					{#if saveError}<span class="save-error">{saveError}</span>{/if}
					<button class="btn-cancel" onclick={closeForm}>キャンセル</button>
					<button class="btn-save" onclick={saveRecord} disabled={saving}>
						{saving ? '保存中…' : '保存'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.page-layout {
		height: 100%;
		overflow: hidden;
	}

	.main-col {
		padding: 28px 32px;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 40;
	}

	.page-header {
		margin-bottom: 24px;
	}

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
		font-size: 1.75rem;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

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

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 60px 0;
		text-align: center;
	}

	.empty-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.empty-desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: 10px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

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
		cursor: pointer;
		transition: background 0.1s;

		&:last-child { border-bottom: none; }
		&:hover { background: var(--color-surface); }
		&.active { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); }
	}

	td {
		padding: 10px 14px;
		color: var(--color-text);
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ts {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* ── Form panel (right drawer) ─────────── */
	.form-panel {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 420px;
		max-width: 100vw;
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		background: var(--color-surface);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
		z-index: 50;
		animation: drawer-in 0.22s ease;
	}

	@keyframes drawer-in {
		from { transform: translateX(100%); }
		to   { transform: translateX(0); }
	}

	.form-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;

		h2 {
			font-size: 0.9375rem;
			font-weight: 600;
			color: var(--color-text);
			margin: 0;
		}
	}

	.form-close-btn {
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		color: var(--color-text-muted);
		font-size: 1.125rem;
		cursor: pointer;
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s, color 0.1s;

		&:hover { background: var(--color-border); color: var(--color-text); }
	}

	.form-panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.req-mark {
		color: var(--color-danger);
		margin-left: 2px;
	}

	.form-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.form-input,
	.form-select,
	.form-textarea {
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

	.form-textarea {
		resize: vertical;
	}

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

	.footer-right {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}

	.save-error {
		font-size: 0.8125rem;
		color: var(--color-danger);
	}

	.btn-save {
		padding: 7px 18px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;

		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}

	.btn-cancel {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		transition: background 0.15s;

		&:hover { background: var(--color-border); }
	}

	.btn-delete {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;

		&:hover { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}
</style>
