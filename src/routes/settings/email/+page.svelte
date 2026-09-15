<script lang="ts">
	import { untrack } from 'svelte';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ProviderType = 'resend' | 'ses' | 'smtp';

	const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
		{ value: 'resend', label: m.email_settings_provider_resend() },
		{ value: 'ses', label: m.email_settings_provider_ses() },
		{ value: 'smtp', label: m.email_settings_provider_smtp() }
	];

	let provider = $state<ProviderType>(untrack(() => data.settings.provider as ProviderType));
	let fromAddress = $state(untrack(() => data.settings.fromAddress));
	let fromName = $state(untrack(() => data.settings.fromName));
	let signature = $state(untrack(() => data.settings.signature));

	let resendApiKey = $state(untrack(() => data.settings.config.resend.apiKey));
	let sesRegion = $state(untrack(() => data.settings.config.ses.region));
	let sesAccessKeyId = $state(untrack(() => data.settings.config.ses.accessKeyId));
	let sesSecretAccessKey = $state(untrack(() => data.settings.config.ses.secretAccessKey));
	let smtpHost = $state(untrack(() => data.settings.config.smtp.host));
	let smtpPort = $state(untrack(() => data.settings.config.smtp.port));
	let smtpSecure = $state(untrack(() => data.settings.config.smtp.secure === 'true'));
	let smtpUsername = $state(untrack(() => data.settings.config.smtp.username));
	let smtpPassword = $state(untrack(() => data.settings.config.smtp.password));

	let saving = $state(false);
	let saved = $state(false);

	async function save() {
		saving = true;
		saved = false;
		try {
			await fetch('/api/email/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider,
					fromAddress,
					fromName: fromName || undefined,
					signature: signature || undefined,
					config: {
						resend: { apiKey: resendApiKey },
						ses: { region: sesRegion, accessKeyId: sesAccessKeyId, secretAccessKey: sesSecretAccessKey },
						smtp: {
							host: smtpHost,
							port: smtpPort,
							secure: String(smtpSecure),
							username: smtpUsername,
							password: smtpPassword
						}
					}
				})
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} finally {
			saving = false;
		}
	}
</script>

<div class="page">
	<h1>Settings</h1>
	<nav class="subnav">
		<a href="/settings">General</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/integrations">{m.integrations()}</a>
		{/if}
		{#if data.account.permission === 'admin'}
			<a href="/settings/email" class="active">{m.email_settings()}</a>
			<a href="/settings/ai">{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account">{m.account_settings()}</a>
		<a href="/settings/password">Change password</a>
	</nav>

	<section>
		<h2>{m.email_settings_provider()}</h2>
		<div class="provider-switcher">
			{#each PROVIDER_OPTIONS as opt}
				<button class:active={provider === opt.value} onclick={() => (provider = opt.value)}>
					{opt.label}
				</button>
			{/each}
		</div>

		<div class="fields">
			{#if provider === 'resend'}
				<Textbox label={m.email_settings_resend_api_key()} type="password" bind:value={resendApiKey} placeholder="re_..." />
			{:else if provider === 'ses'}
				<Textbox label={m.email_settings_ses_region()} bind:value={sesRegion} placeholder="ap-northeast-1" />
				<Textbox label={m.email_settings_ses_access_key_id()} bind:value={sesAccessKeyId} />
				<Textbox label={m.email_settings_ses_secret_access_key()} type="password" bind:value={sesSecretAccessKey} />
			{:else if provider === 'smtp'}
				<Textbox label={m.email_settings_smtp_host()} bind:value={smtpHost} placeholder="smtp.example.com" />
				<Textbox label={m.email_settings_smtp_port()} bind:value={smtpPort} placeholder="587" />
				<Toggle label={m.email_settings_smtp_secure()} bind:checked={smtpSecure} />
				<Textbox label={m.email_settings_smtp_username()} bind:value={smtpUsername} />
				<Textbox label={m.email_settings_smtp_password()} type="password" bind:value={smtpPassword} />
			{/if}
		</div>
	</section>

	<section>
		<h2>{m.email_settings_sender()}</h2>
		<div class="fields">
			<Textbox label={m.email_settings_from_address()} type="email" bind:value={fromAddress} placeholder="noreply@example.com" required />
			<Textbox label={m.email_settings_from_name()} bind:value={fromName} />
		</div>
	</section>

	<section>
		<h2>{m.email_settings_signature()}</h2>
		<Textarea bind:value={signature} rows={4} />
		<p class="hint">{m.email_settings_signature_desc()}</p>
	</section>

	<div class="actions">
		<button class="save-btn" onclick={save} disabled={saving || !fromAddress}>{m.settings_save()}</button>
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

	.provider-switcher {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	.provider-switcher button {
		padding: 10px 20px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.provider-switcher button:hover {
		border-color: var(--color-primary);
		color: var(--color-text);
	}

	.provider-switcher button.active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
		color: var(--color-primary);
		font-weight: 500;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.hint {
		margin-top: 8px;
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
