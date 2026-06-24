<script lang="ts">
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import * as m from '$lib/paraglide/messages.js';

	let email = $state('');
	let error = $state('');
	let submitting = $state(false);
	let sent = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/auth/forgot-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				error = body.error ?? m.chat_error();
				return;
			}
			sent = true;
		} catch {
			error = m.chat_error();
		} finally {
			submitting = false;
		}
	}
</script>

<div class="signin-page">
	<div class="signin-card">
		<h1>{m.forgot_password_title()}</h1>
		{#if sent}
			<p class="desc">{m.forgot_password_sent()}</p>
		{:else}
			<p class="desc">{m.forgot_password_desc()}</p>
			<form onsubmit={handleSubmit}>
				<Textbox label={m.signin_email()} type="email" bind:value={email} autocomplete="email" required />
				{#if error}
					<p class="error">{error}</p>
				{/if}
				<button class="submit-btn" type="submit" disabled={submitting || !email}>
					{m.forgot_password_submit()}
				</button>
			</form>
		{/if}
		<a class="back-link" href="/signin">{m.forgot_password_back_to_signin()}</a>
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
