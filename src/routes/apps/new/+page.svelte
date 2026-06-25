<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon, { ICON_OPTIONS } from '$lib/components/AppIcon.svelte';

	let label = $state('');
	let selectedIcon = $state('layout-grid');
	let submitting = $state(false);
	let errorMsg = $state('');

	function slugify(s: string): string {
		const slug = s
			.toLowerCase()
			.replace(/[\s　]+/g, '_')
			.replace(/[^a-z0-9_]/g, '')
			.replace(/^_+|_+$/g, '');
		return slug || '';
	}

	const name = $derived(slugify(label));

	async function submit() {
		if (!label.trim() || submitting) return;
		submitting = true;
		errorMsg = '';
		const res = await fetch('/api/apps', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: name || 'app_' + Date.now(), label: label.trim(), icon: selectedIcon })
		});
		if (res.ok) {
			const { id } = (await res.json()) as { id: string };
			goto(`/apps/${id}`);
		} else {
			const data = await res.json() as { error?: string };
			errorMsg = data.error ?? '作成に失敗しました';
			submitting = false;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') submit();
	}
</script>

<div class="page">
	<div class="page-header">
		<a href="/" class="back-link"><ChevronLeft size={15} />アプリ一覧</a>
		<h1>新しいアプリを作成</h1>
	</div>

	<div class="form-card">
		<div class="form-row">
			<label class="form-label" for="app-label">アプリ名</label>
			<input
				id="app-label"
				class="form-input"
				type="text"
				bind:value={label}
				placeholder="例: 顧客管理"
				onkeydown={onKeyDown}
				autofocus
			/>
			{#if name}
				<p class="form-hint">識別名: <code>{name}</code></p>
			{/if}
		</div>

		<div class="form-row">
			<span class="form-label">アイコン</span>
			<div class="icon-grid">
				{#each ICON_OPTIONS as opt (opt.name)}
					<button
						type="button"
						class="icon-opt"
						class:selected={selectedIcon === opt.name}
						onclick={() => (selectedIcon = opt.name)}
						title={opt.name}
					>
						<AppIcon icon={opt.name} size={18} />
					</button>
				{/each}
			</div>
		</div>

		{#if errorMsg}
			<p class="error-msg">{errorMsg}</p>
		{/if}

		<div class="form-actions">
			<a href="/" class="btn-cancel">キャンセル</a>
			<button class="btn-primary" onclick={submit} disabled={!label.trim() || submitting}>
				{submitting ? '作成中…' : 'アプリを作成'}
			</button>
		</div>
	</div>
</div>

<style lang="scss">
	.page {
		max-width: 560px;
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
		gap: 24px;
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
	}

	.form-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
		code {
			font-family: ui-monospace, monospace;
			background: color-mix(in srgb, var(--color-primary) 8%, transparent);
			padding: 1px 5px;
			border-radius: 4px;
			color: var(--color-primary);
		}
	}

	.icon-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.icon-opt {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-background);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.12s, color 0.12s, background 0.12s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}
		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 10%, transparent);
			color: var(--color-primary);
		}
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
