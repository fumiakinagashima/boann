<script lang="ts">
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { themeStore } from '$lib/stores/theme.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Theme = 'light' | 'dark' | 'system';

	const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
		{
			value: 'light',
			label: m.theme_light(),
			icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
		},
		{
			value: 'dark',
			label: m.theme_dark(),
			icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
		},
		{
			value: 'system',
			label: m.theme_auto(),
			icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`
		},
	];

	let enterToSend = $state(
		typeof localStorage !== 'undefined' ? (localStorage.getItem('enterToSend') ?? 'true') !== 'false' : true
	);
	let currentPath = $state('');
	$effect(() => { currentPath = location.pathname; });
	$effect(() => { localStorage.setItem('enterToSend', String(enterToSend)); });
</script>

<div class="page">
	<h1>Settings</h1>

	<nav class="subnav">
		<a href="/settings" class:active={currentPath === '/settings'}>General</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/integrations" class:active={currentPath === '/settings/integrations'}>{m.integrations()}</a>
		{/if}
		{#if data.account.permission === 'admin'}
			<a href="/settings/email" class:active={currentPath === '/settings/email'}>{m.email_settings()}</a>
			<a href="/settings/ai" class:active={currentPath === '/settings/ai'}>{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account" class:active={currentPath === '/settings/account'}>{m.account_settings()}</a>
		<a href="/settings/password" class:active={currentPath === '/settings/password'}>Change password</a>
	</nav>

	<section>
		<h2>Theme</h2>
		<div class="theme-switcher">
			{#each THEME_OPTIONS as opt}
				<button
					class:active={themeStore.value === opt.value}
					onclick={() => (themeStore.value = opt.value)}
				>
					{@html opt.icon}
					<span>{opt.label}</span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>{m.settings_chat()}</h2>
		<div class="row">
			<div class="row-info">
				<span class="label">{m.settings_enter_to_send()}</span>
				<span class="desc">{m.settings_enter_to_send_desc()}</span>
			</div>
			<Toggle bind:checked={enterToSend} />
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

	.theme-switcher {
		display: flex;
		gap: 8px;
	}

	.theme-switcher button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}

	.theme-switcher button:hover {
		border-color: var(--color-primary);
		color: var(--color-text);
	}

	.theme-switcher button.active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
		color: var(--color-primary);
		font-weight: 500;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 12px 0;
	}

	.row-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 0.9375rem;
	}

	.desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
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
</style>
