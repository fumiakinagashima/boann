<script lang="ts">
	import { page } from '$app/state';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newPassword = $state('');
	let newPasswordConfirm = $state('');
	let error = $state('');
	let submitting = $state(false);
	let success = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		error = '';
		if (newPassword.length < 8) {
			error = m.account_settings_password_too_short();
			return;
		}
		if (newPassword !== newPasswordConfirm) {
			error = m.account_settings_password_mismatch();
			return;
		}
		submitting = true;
		try {
			const token = page.url.searchParams.get('token') ?? '';
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, newPassword })
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				error = body.error ?? m.chat_error();
				return;
			}
			success = true;
		} catch {
			error = m.chat_error();
		} finally {
			submitting = false;
		}
	}
</script>

<div class="signin-page">
	<div class="signin-card">
		<h1>{m.reset_password_title()}</h1>
		{#if !data.tokenValid}
			<p class="error">{m.reset_password_invalid_token()}</p>
			<a class="back-link" href="/signin/forgot-password">{m.reset_password_request_again()}</a>
		{:else if success}
			<p class="desc">{m.reset_password_success()}</p>
			<a class="back-link" href="/signin">{m.reset_password_go_to_signin()}</a>
		{:else}
			<form onsubmit={handleSubmit}>
				<Textbox label={m.account_settings_new_password()} type="password" bind:value={newPassword} required />
				<Textbox
					label={m.account_settings_new_password_confirm()}
					type="password"
					bind:value={newPasswordConfirm}
					required
				/>
				{#if error}
					<p class="error">{error}</p>
				{/if}
				<button class="submit-btn" type="submit" disabled={submitting || !newPassword || !newPasswordConfirm}>
					{m.reset_password_submit()}
				</button>
			</form>
		{/if}
	</div>
</div>

<style lang="scss">
	.signin-page {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 100vh;
		padding: 24px;
	}

	.signin-card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		max-width: 360px;
		padding: 32px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	h1 {
		margin: 0 0 4px;
		font-size: 1.25rem;
		font-weight: 700;
		text-align: center;
		color: var(--color-text);
	}

	.desc {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.7;
	}

	.error {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-danger);
	}

	.submit-btn {
		padding: 9px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
	}
	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.back-link {
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	.back-link:hover {
		color: var(--color-text);
		text-decoration: underline;
	}
</style>
