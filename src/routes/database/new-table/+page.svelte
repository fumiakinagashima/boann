<script lang="ts">
	import { goto } from '$app/navigation';
	import FieldEditor from '$lib/components/database/FieldEditor.svelte';
	import type { EditableField } from '$lib/server/db/table-service';

	let name = $state('');
	let label = $state('');
	let fields = $state<EditableField[]>([]);
	let submitting = $state(false);
	let error = $state('');

	const namePattern = /^[a-z][a-z0-9_-]*$/;
	const nameValid = $derived(namePattern.test(name));

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!nameValid) { error = 'テーブル名は英小文字で始まり、英小文字・数字・_ ・- のみ使用できます。'; return; }
		if (!label.trim()) { error = '表示名を入力してください。'; return; }

		const invalidField = fields.find(f => !f.key.trim() || !f.label.trim());
		if (invalidField) { error = '全フィールドのキーと表示名を入力してください。'; return; }

		submitting = true;
		error = '';
		const res = await fetch('/api/database/tables', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, label, fields })
		});
		if (res.ok) {
			goto(`/database/${name}`);
		} else {
			const e2 = await res.json() as { error?: string };
			error = e2.error ?? '作成に失敗しました';
			submitting = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>新規テーブル作成</span>
		</div>
	</header>

	<form class="form" onsubmit={handleSubmit}>
		<div class="form-section">
			<h2 class="section-title">テーブル情報</h2>
			<div class="field-group">
				<div class="field">
					<label for="name">
						テーブル名
						<span class="hint">（英小文字・数字・_・- のみ、URLに使用）</span>
					</label>
					<input
						id="name"
						type="text"
						placeholder="例: products, project_tasks"
						bind:value={name}
						class:invalid={name && !nameValid}
					/>
					{#if name && !nameValid}
						<p class="field-error">英小文字で始まり、英小文字・数字・_ ・- のみ使用できます</p>
					{/if}
				</div>
				<div class="field">
					<label for="label">表示名</label>
					<input id="label" type="text" placeholder="例: 商品管理、プロジェクトタスク" bind:value={label} />
				</div>
			</div>
		</div>

		<div class="form-section">
			<h2 class="section-title">フィールド定義</h2>
			<FieldEditor bind:fields />
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}

		<div class="form-footer">
			<a href="/database" class="btn-cancel">キャンセル</a>
			<button type="submit" class="btn-submit" disabled={submitting || !name || !label}>
				{submitting ? '作成中...' : 'テーブルを作成'}
			</button>
		</div>
	</form>
</div>

<style lang="scss">
	.page {
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.page-header { display: flex; align-items: center; }

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
	}

	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.form {
		display: flex;
		flex-direction: column;
		gap: 28px;
		max-width: 680px;
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

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
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

	input[type="text"] {
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		max-width: 400px;
	}

	input[type="text"]:focus { border-color: var(--color-primary); }
	input.invalid { border-color: var(--color-danger, var(--color-error)); }

	.field-error {
		font-size: 0.75rem;
		color: var(--color-danger, var(--color-error));
		margin: 0;
	}

	.error {
		color: var(--color-danger, var(--color-error));
		font-size: 0.875rem;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-danger, var(--color-error)) 10%, transparent);
		border-radius: 6px;
	}

	.form-footer {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.btn-cancel {
		padding: 8px 20px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.9375rem;
		color: var(--color-text);
		text-decoration: none;
		cursor: pointer;
	}

	.btn-submit {
		padding: 8px 24px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-submit:not(:disabled):hover { opacity: 0.88; }
</style>
