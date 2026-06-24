<script lang="ts">
	import { page } from '$app/state';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import * as m from '$lib/paraglide/messages.js';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/auth/signin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				error = body.error ?? m.signin_error();
				submitting = false;
				return;
			}
			const redirectParam = page.url.searchParams.get('redirect');
			const redirectTo =
				redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
					? redirectParam
					: '/';
			window.location.href = redirectTo;
		} catch {
			error = m.signin_error();
			submitting = false;
		}
	}
</script>

<div class="signin-page">
	<form class="signin-card" onsubmit={handleSubmit}>
		<h1>{m.signin_title()}</h1>
		<Textbox
			label={m.signin_email()}
			type="email"
			bind:value={email}
			autocomplete="email"
			required
		/>
		<Textbox
			label={m.signin_password()}
			type="password"
			bind:value={password}
			autocomplete="current-password"
			required
		/>
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<button class="submit-btn" type="submit" disabled={submitting || !email || !password}>
			{m.signin_submit()}
		</button>
		<a class="forgot-link" href="/signin/forgot-password">{m.signin_forgot_password()}</a>
	</form>
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

	h1 {
		margin: 0 0 4px;
		font-size: 1.25rem;
		font-weight: 700;
		text-align: center;
		color: var(--color-text);
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

	.forgot-link {
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	.forgot-link:hover {
		color: var(--color-text);
		text-decoration: underline;
	}
</style>
