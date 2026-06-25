<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let label = $state('');
	let nameOverride = $state('');
	let nameEdited = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	function slugify(s: string): string {
		return s
			.toLowerCase()
			.replace(/[\s　]+/g, '_')
			.replace(/[^a-z0-9_]/g, '')
			.replace(/^_+|_+$/g, '');
	}

	const autoName = $derived(slugify(label));
	const name = $derived(nameEdited ? nameOverride : autoName);

	function onLabelInput() {
		if (!nameEdited) nameOverride = autoName;
	}

	function onNameInput() {
		nameEdited = true;
	}

	async function submit() {
		if (!label.trim() || submitting) return;
		submitting = true;
		errorMsg = '';
		const finalName = name || 'table_' + Date.now();
		const res = await fetch('/api/database/tables', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: finalName, label: label.trim(), appId: data.app.id, fields: [] })
		});
		if (res.ok) {
			const { id } = (await res.json()) as { id: string };
			goto(`/apps/${data.app.id}/tables/${id}/build`);
		} else {
			const body = await res.json() as { error?: string };
			errorMsg = body.error ?? '作成に失敗しました';
			submitting = false;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') submit();
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="/apps/{data.app.id}" class="back-link"><ChevronLeft size={15} />{data.app.label}</a>
		<h1>新しいテーブルを作成</h1>
	</div>

	<div class="form-card">
		<div class="form-row">
			<label class="form-label" for="table-label">テーブル名</label>
			<input
				id="table-label"
				class="form-input"
				type="text"
				bind:value={label}
				oninput={onLabelInput}
				placeholder="例: 顧客"
				onkeydown={onKeyDown}
				autofocus
			/>
		</div>

		<div class="form-row">
			<label class="form-label" for="table-name">識別名</label>
			<input
				id="table-name"
				class="form-input form-input--mono"
				type="text"
				bind:value={nameOverride}
				oninput={onNameInput}
				placeholder="例: customers"
			/>
			<p class="form-hint">英小文字・数字・アンダースコアのみ。URLやAPIで使用されます。</p>
		</div>

		{#if errorMsg}
			<p class="error-msg">{errorMsg}</p>
		{/if}

		<div class="form-actions">
			<a href="/apps/{data.app.id}" class="btn-cancel">キャンセル</a>
			<button class="btn-primary" onclick={submit} disabled={!label.trim() || submitting}>
				{submitting ? '作成中…' : 'テーブルを作成 → フィールド設定へ'}
			</button>
		</div>
	</div>
</div>

<style lang="scss">
	.page {
		max-width: 520px;
		margin: 0 auto;
		padding: 40px 24px;
	}

	.page-header {
		margin-bottom: 28px;
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

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.form-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.form-input {
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		&:focus { border-color: var(--color-primary); }

		&--mono {
			font-family: ui-monospace, monospace;
			font-size: 0.875rem;
		}
	}

	.form-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.error-msg {
		font-size: 0.875rem;
		color: var(--color-danger, #dc2626);
		margin: 0;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding-top: 4px;
	}

	.btn-cancel {
		padding: 9px 18px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		text-decoration: none;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover { border-color: var(--color-text-muted); color: var(--color-text); }
	}

	.btn-primary {
		padding: 9px 18px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}
</style>
