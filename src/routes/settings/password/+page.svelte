<script lang="ts">
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let newPasswordConfirm = $state('');

	let saving = $state(false);
	let saved = $state(false);
	let error = $state('');

	async function savePassword() {
		error = '';
		if (newPassword.length < 8) {
			error = m.account_settings_password_too_short();
			return;
		}
		if (newPassword !== newPasswordConfirm) {
			error = m.account_settings_password_mismatch();
			return;
		}
		saving = true;
		saved = false;
		try {
			const res = await fetch('/api/account/password', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				error = body.error ?? m.chat_error();
				return;
			}
			currentPassword = '';
			newPassword = '';
			newPasswordConfirm = '';
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
		{#if data.account.permission === 'admin'}
			<a href="/settings/email">{m.email_settings()}</a>
			<a href="/settings/ai">{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account">{m.account_settings()}</a>
		<a href="/settings/password" class="active">パスワード変更</a>
	</nav>

	<section>
		<h2>{m.account_settings_password()}</h2>
		<div class="fields">
			<Textbox label={m.account_settings_current_password()} type="password" bind:value={currentPassword} />
			<Textbox label={m.account_settings_new_password()} type="password" bind:value={newPassword} />
			<Textbox label={m.account_settings_new_password_confirm()} type="password" bind:value={newPasswordConfirm} />
		</div>
		<div class="actions">
			<button class="save-btn" onclick={savePassword} disabled={saving || !currentPassword || !newPassword}>{m.settings_save()}</button>
			{#if saved}<span class="saved">{m.settings_saved()}</span>{/if}
			{#if error}<span class="error">{error}</span>{/if}
		</div>
	</section>
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

	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
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

	.error {
		font-size: 0.8125rem;
		color: var(--color-danger);
	}
</style>
