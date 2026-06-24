<script lang="ts">
	import FieldEditor from '$lib/components/database/FieldEditor.svelte';
	import DialogShell from './DialogShell.svelte';
	import type { EditableField, FieldDef, TableInfo } from '$lib/server/db/table-service';

	type Props = {
		mode: 'create' | 'edit';
		type?: string;
		onclose: () => void;
		onSaved: (newType?: string) => void;
	};

	let { mode, type, onclose, onSaved }: Props = $props();

	let loading = $state(mode === 'edit');
	let info = $state<TableInfo | null>(null);
	let availableTables = $state<{ value: string; label: string }[]>([]);

	let name = $state('');
	let label = $state('');
	let fields = $state<EditableField[]>([]);
	let customFields = $state<EditableField[]>([]);

	let submitting = $state(false);
	let deleting = $state(false);
	let error = $state('');

	function toEditableFields(fieldDefs: FieldDef[]): EditableField[] {
		return fieldDefs.map((f) => ({
			_id: crypto.randomUUID(),
			key: f.key,
			label: f.label,
			type: f.type,
			required: f.required ?? false,
			options: f.options ?? [],
			refTable: f.refTable
		}));
	}

	$effect(() => {
		let cancelled = false;

		fetch('/api/database/tables')
			.then((r) => r.json() as Promise<(TableInfo & { count: number })[]>)
			.then((tables) => {
				if (!cancelled)
					availableTables = tables
						.filter((t) => t.id !== type)
						.map((t) => ({ value: t.id, label: t.label }));
			})
			.catch(() => {});

		if (mode === 'edit' && type) {
			fetch(`/api/database/${type}/info`)
				.then((r) => r.json() as Promise<{ info: TableInfo }>)
				.then((data) => {
					if (cancelled) return;
					info = data.info;
					label = info.isCore ? '' : (info.label ?? '');
					if (info.isCore) {
						customFields = toEditableFields(info.fields.filter((f) => f.isCustom));
					} else {
						fields = toEditableFields(info.fields);
					}
					loading = false;
				})
				.catch(() => {
					if (!cancelled) loading = false;
				});
		} else {
			loading = false;
		}

		return () => {
			cancelled = true;
		};
	});

	const namePattern = /^[a-z][a-z0-9_-]*$/;
	const nameValid = $derived(mode !== 'create' || namePattern.test(name));
	const builtinFields = $derived(info?.fields.filter((f) => !f.isCustom) ?? []);
	const dialogTitle = $derived(
		mode === 'create'
			? '新規テーブル作成'
			: info?.isCore
				? `${info?.label}：カスタムフィールド`
				: `スキーマ編集：${info?.label ?? type}`
	);
	const chatContextFields = $derived(
		(info?.isCore ? customFields : fields).map((f) => ({ key: f.key, label: f.label }))
	);

	const FIELD_TYPE_LABELS: Record<string, string> = {
		text: 'テキスト',
		number: '数値',
		select: '選択',
		date: '日付',
		email: 'メール',
		tel: '電話番号',
		textarea: '長文テキスト',
		recordSelect: '関係'
	};

	async function handleSubmit() {
		error = '';

		if (mode === 'create') {
			if (!nameValid) {
				error = 'テーブル名は英小文字で始まり、英小文字・数字・_・- のみ使用できます。';
				return;
			}
			if (!label.trim()) {
				error = '表示名を入力してください。';
				return;
			}
			const invalidField = fields.find((f) => !f.key.trim() || !f.label.trim());
			if (invalidField) {
				error = '全フィールドのキーと表示名を入力してください。';
				return;
			}
			submitting = true;
			const res = await fetch('/api/database/tables', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, label, fields })
			});
			if (res.ok) {
				onSaved(name);
			} else {
				const e2 = (await res.json()) as { error?: string };
				error = e2.error ?? '作成に失敗しました';
				submitting = false;
			}
		} else {
			const targetFields = info?.isCore ? customFields : fields;
			const invalidField = targetFields.find((f) => !f.key.trim() || !f.label.trim());
			if (invalidField) {
				error = '全フィールドのキーと表示名を入力してください。';
				return;
			}
			submitting = true;
			const body = info?.isCore ? { fields: customFields } : { label, fields };
			const res = await fetch(`/api/database/tables/${type}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (res.ok) {
				onSaved();
			} else {
				const e2 = (await res.json()) as { error?: string };
				error = e2.error ?? '保存に失敗しました';
				submitting = false;
			}
		}
	}

	async function handleDelete() {
		if (!confirm(`テーブル「${info?.label}」とその全データを削除しますか？この操作は元に戻せません。`))
			return;
		deleting = true;
		const res = await fetch(`/api/database/tables/${type}`, { method: 'DELETE' });
		if (res.status === 409) {
			const body = (await res.json()) as { workflows: { id: string; name: string }[] };
			const names = body.workflows.map((w) => w.name).join('、');
			const proceed = confirm(
				`このテーブルは以下のワークフローで使用されています: ${names}\n削除すると、これらのワークフローは実行時にエラーになります。本当に削除しますか？`
			);
			if (!proceed) {
				deleting = false;
				return;
			}
			await fetch(`/api/database/tables/${type}?force=1`, { method: 'DELETE' });
		}
		onSaved();
	}
</script>

<DialogShell title={dialogTitle} {onclose} contextFields={chatContextFields}>
	{#snippet children()}
		<div class="content">
			{#if loading}
				<div class="loading">読み込み中...</div>
			{:else if mode === 'create'}
				<div class="form-section">
					<h3 class="section-title">テーブル情報</h3>
					<div class="field">
						<label for="tbl-name">
							テーブル名<span class="hint">（英小文字・数字・_・- のみ）</span>
						</label>
						<input
							id="tbl-name"
							type="text"
							placeholder="例: products, project_tasks"
							bind:value={name}
							class:invalid={name && !nameValid}
						/>
						{#if name && !nameValid}
							<p class="field-error">英小文字で始まり、英小文字・数字・_・- のみ使用できます</p>
						{/if}
					</div>
					<div class="field">
						<label for="tbl-label">表示名</label>
						<input id="tbl-label" type="text" placeholder="例: 商品管理" bind:value={label} />
					</div>
				</div>
				<div class="form-section">
					<h3 class="section-title">フィールド定義</h3>
					<FieldEditor bind:fields {availableTables} />
				</div>
			{:else if info?.isCore}
				<div class="form-section">
					<h3 class="section-title">組み込みフィールド（変更不可）</h3>
					<div class="builtin-list">
						{#each builtinFields as field}
							<div class="builtin-row">
								<span class="builtin-key">{field.key}</span>
								<span class="builtin-label">{field.label}</span>
								<span class="builtin-type">{FIELD_TYPE_LABELS[field.type] ?? field.type}</span>
								{#if field.required}<span class="builtin-req">必須</span>{/if}
							</div>
						{/each}
					</div>
				</div>
				<div class="form-section">
					<h3 class="section-title">カスタムフィールド</h3>
					<FieldEditor bind:fields={customFields} {availableTables} />
				</div>
			{:else if info}
				<div class="form-section">
					<h3 class="section-title">テーブル情報</h3>
					<div class="field">
						<label for="edit-name">テーブル名（変更不可）</label>
						<input id="edit-name" type="text" value={type} disabled />
					</div>
					<div class="field">
						<label for="edit-label">表示名</label>
						<input id="edit-label" type="text" bind:value={label} />
					</div>
				</div>
				<div class="form-section">
					<h3 class="section-title">フィールド定義</h3>
					<FieldEditor bind:fields {availableTables} />
				</div>
			{/if}

			{#if error}
				<p class="error">{error}</p>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		{#if mode === 'edit' && info && !info.isCore}
			<button class="btn-delete" onclick={handleDelete} disabled={deleting}>
				{deleting ? '削除中...' : 'テーブルを削除'}
			</button>
			<span class="spacer"></span>
		{/if}
		<button class="btn-cancel" onclick={onclose}>キャンセル</button>
		{#if !loading}
			<button
				class="btn-submit"
				onclick={handleSubmit}
				disabled={submitting || (mode === 'create' && (!name || !label))}
			>
				{#if submitting}
					{mode === 'create' ? '作成中...' : '保存中...'}
				{:else}
					{mode === 'create' ? 'テーブルを作成' : '変更を保存'}
				{/if}
			</button>
		{/if}
	{/snippet}
</DialogShell>

<style lang="scss">
	.content {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.loading {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		padding: 48px 0;
		text-align: center;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-weight: 400;
		margin-left: 4px;
	}

	input[type='text'] {
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		max-width: 420px;
		&:focus { border-color: var(--color-primary); }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
		&.invalid { border-color: var(--color-error); }
	}

	.field-error {
		font-size: 0.75rem;
		color: var(--color-error);
		margin: 0;
	}

	.builtin-list {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.builtin-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
		&:last-child { border-bottom: none; }
	}

	.builtin-key {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		min-width: 140px;
	}

	.builtin-label { flex: 1; font-weight: 500; }

	.builtin-type {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		min-width: 90px;
	}

	.builtin-req {
		font-size: 0.75rem;
		color: var(--color-error);
		padding: 1px 6px;
		border: 1px solid currentColor;
		border-radius: 4px;
	}

	.error {
		color: var(--color-error);
		font-size: 0.875rem;
		padding: 10px 14px;
		background: var(--color-error-bg);
		border-radius: 6px;
	}

	.spacer { flex: 1; }

	.btn-cancel {
		padding: 7px 18px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover { border-color: var(--color-text); color: var(--color-text); }
	}

	.btn-submit {
		padding: 7px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.88; }
		&:active { opacity: 0.75; }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
	}

	.btn-delete {
		padding: 7px 14px;
		background: none;
		color: var(--color-error);
		border: 1px solid var(--color-error);
		border-radius: 8px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
		&:hover { background: var(--color-error-bg); }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
	}
</style>
