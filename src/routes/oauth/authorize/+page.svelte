<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { authReq, clientName, appLabel } = data;
	const scopeStr = authReq.scope.join(' ');
</script>

<div class="authorize-page">
	<div class="authorize-card">
		<h1>{m.oauth_authorize_title()}</h1>
		<p class="intro">{m.oauth_authorize_intro({ client: clientName })}</p>

		<dl class="summary">
			<dt>{m.oauth_authorize_app_label()}</dt>
			<dd>{appLabel}</dd>
			<dt>{m.oauth_authorize_scope_label()}</dt>
			<dd>{m.oauth_authorize_scope_mcp()}</dd>
		</dl>

		<p class="warning">{m.oauth_authorize_warning()}</p>

		<div class="actions">
			<form method="POST" action="?/deny">
				<input type="hidden" name="client_id" value={authReq.clientId} />
				<input type="hidden" name="redirect_uri" value={authReq.redirectUri} />
				<input type="hidden" name="state" value={authReq.state} />
				<button class="deny-btn" type="submit">{m.oauth_authorize_deny()}</button>
			</form>
			<form method="POST" action="?/approve">
				<input type="hidden" name="response_type" value={authReq.responseType} />
				<input type="hidden" name="client_id" value={authReq.clientId} />
				<input type="hidden" name="redirect_uri" value={authReq.redirectUri} />
				<input type="hidden" name="scope" value={scopeStr} />
				<input type="hidden" name="state" value={authReq.state} />
				{#if authReq.codeChallenge}
					<input type="hidden" name="code_challenge" value={authReq.codeChallenge} />
					<input type="hidden" name="code_challenge_method" value={authReq.codeChallengeMethod} />
				{/if}
				{#if authReq.resource}
					<input type="hidden" name="resource" value={authReq.resource} />
				{/if}
				<button class="approve-btn" type="submit">{m.oauth_authorize_approve()}</button>
			</form>
		</div>
	</div>
</div>

<style lang="scss">
	.authorize-page {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 100vh;
		padding: 24px;
	}

	.authorize-card {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		max-width: 420px;
		padding: 32px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
	}

	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.intro {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--color-text);
		line-height: 1.7;
	}

	.summary {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		margin: 0;
		padding: 12px 14px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		font-size: 0.875rem;
	}
	dt {
		color: var(--color-text-muted);
	}
	dd {
		margin: 0;
		color: var(--color-text);
		font-weight: 500;
	}

	.warning {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.actions {
		display: flex;
		gap: 12px;
	}
	.actions form {
		flex: 1;
	}

	.approve-btn,
	.deny-btn {
		width: 100%;
		padding: 9px 14px;
		border-radius: 6px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
	}
	.approve-btn {
		background: var(--color-primary);
		color: #fff;
		border: none;
	}
	.deny-btn {
		background: transparent;
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}
</style>
