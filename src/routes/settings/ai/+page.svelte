<script lang="ts">
	import { untrack } from 'svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let model = $state(untrack(() => data.model));

	let saving = $state(false);
	let saved = $state(false);

	async function save() {
		saving = true;
		saved = false;
		try {
			await fetch('/api/ai/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model })
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} finally {
			saving = false;
		}
	}
</script>

<div class="page">
	<h1>設定</h1>
	<nav class="subnav">
		<a href="/settings">一般</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/integrations">{m.integrations()}</a>
		{/if}
		<a href="/settings/quick-actions">{m.quick_actions()}</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/email">{m.email_settings()}</a>
			<a href="/settings/ai" class="active">{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account">{m.account_settings()}</a>
	</nav>

	<section>
		<h2>{m.ai_settings_model()}</h2>
		<p class="hint">{m.ai_settings_model_desc()}</p>
		<Select bind:value={model} options={data.options} />
	</section>

	<div class="actions">
		<button class="save-btn" onclick={save} disabled={saving || !model}>{m.settings_save()}</button>
		{#if saved}<span class="saved">{m.settings_saved()}</span>{/if}
	</div>
</div>

<style lang="scss">
	.page {
		padding: 40px 48px;
		max-width: 640px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 32px;
	}

	section {
		margin-bottom: 40px;
	}

	h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.subnav {
		display: flex;
		gap: 4px;
		margin-bottom: 32px;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0;
	}

	.subnav a {
		padding: 8px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color 0.15s;
	}

	.subnav a:hover { color: var(--color-text); }
	.subnav a.active {
		color: var(--color-text);
		border-bottom-color: var(--color-primary);
		font-weight: 500;
	}

	.hint {
		margin-bottom: 12px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.save-btn {
		padding: 8px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.save-btn:not(:disabled):hover { opacity: 0.85; }

	.saved {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}
</style>
