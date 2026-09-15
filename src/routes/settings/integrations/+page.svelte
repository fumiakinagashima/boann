<script lang="ts">
	import { untrack } from 'svelte';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type AuthType = 'none' | 'api_key' | 'bearer' | 'basic';

	type Integration = {
		id: string;
		name: string;
		description: string | null;
		baseUrl: string;
		authType: AuthType;
		authConfig: Record<string, string>;
		createdAt: Date;
	};

	type FormState = {
		name: string;
		description: string;
		baseUrl: string;
		authType: AuthType;
		authConfig: Record<string, string>;
	};

	const AUTH_OPTIONS = [
		{ value: 'none', label: m.integrations_auth_none() },
		{ value: 'api_key', label: m.integrations_auth_api_key() },
		{ value: 'bearer', label: m.integrations_auth_bearer() },
		{ value: 'basic', label: m.integrations_auth_basic() }
	];

	let items = $state<Integration[]>(untrack(() => data.items));
	$effect(() => {
		items = data.items;
	});
	let editingId = $state<string | null>(null);
	let showForm = $state(false);
	let saving = $state(false);

	let form = $state<FormState>({
		name: '',
		description: '',
		baseUrl: '',
		authType: 'none',
		authConfig: {}
	});

	// Intermediate variables for authConfig fields (avoids onchange type errors with Textbox)
	let cfgHeaderName = $state('X-API-Key');
	let cfgToken = $state('');
	let cfgUsername = $state('');
	let cfgPassword = $state('');

	$effect(() => {
		if (form.authType === 'api_key') {
			form.authConfig = { headerName: cfgHeaderName, value: cfgToken };
		} else if (form.authType === 'bearer') {
			form.authConfig = { value: cfgToken };
		} else if (form.authType === 'basic') {
			form.authConfig = { username: cfgUsername, password: cfgPassword };
		} else {
			form.authConfig = {};
		}
	});

	function openAdd() {
		editingId = null;
		form = { name: '', description: '', baseUrl: '', authType: 'none', authConfig: {} };
		cfgHeaderName = 'X-API-Key'; cfgToken = ''; cfgUsername = ''; cfgPassword = '';
		showForm = true;
	}

	function openEdit(item: Integration) {
		editingId = item.id;
		form = {
			name: item.name,
			description: item.description ?? '',
			baseUrl: item.baseUrl,
			authType: item.authType,
			authConfig: { ...item.authConfig }
		};
		cfgHeaderName = item.authConfig.headerName ?? 'X-API-Key';
		cfgToken = item.authConfig.value ?? '';
		cfgUsername = item.authConfig.username ?? '';
		cfgPassword = item.authConfig.password ?? '';
		showForm = true;
	}

	function cancel() {
		showForm = false;
		editingId = null;
	}

	async function save() {
		saving = true;
		try {
			const payload = {
				name: form.name,
				description: form.description || undefined,
				baseUrl: form.baseUrl,
				authType: form.authType,
				authConfig: form.authConfig
			};
			if (editingId) {
				const res = await fetch(`/api/integrations/${editingId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const updated = (await res.json()) as Integration;
				items = items.map((i) => (i.id === editingId ? updated : i));
			} else {
				const res = await fetch('/api/integrations', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const created = (await res.json()) as Integration;
				items = [...items, created].sort((a, b) => a.name.localeCompare(b.name));
			}
			cancel();
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		if (!confirm(m.integrations_delete_confirm())) return;
		await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
		items = items.filter((i) => i.id !== id);
	}

</script>

<div class="page">
	<h1>Settings</h1>
	<nav class="subnav">
		<a href="/settings">General</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/integrations" class="active">{m.integrations()}</a>
		{/if}
		{#if data.account.permission === 'admin'}
			<a href="/settings/email">{m.email_settings()}</a>
			<a href="/settings/ai">{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account">{m.account_settings()}</a>
		<a href="/settings/password">Change password</a>
	</nav>

	<div class="header">
		<h2 class="section-title">{m.integrations()}</h2>
		<button class="add-btn" onclick={openAdd}>{m.integrations_add()}</button>
	</div>

	{#if items.length === 0 && !showForm}
		<p class="empty">{m.integrations_empty()}</p>
	{/if}

	<ul class="list">
		{#each items as item (item.id)}
			<li class="item">
				<div class="item-info">
					<span class="item-name">{item.name}</span>
					<span class="item-url">{item.baseUrl}</span>
					{#if item.description}
						<span class="item-desc">{item.description}</span>
					{/if}
				</div>
				<div class="item-meta">
					<span class="badge">{item.authType}</span>
					<button class="link-btn" onclick={() => openEdit(item)}>{m.integrations_edit()}</button>
					<button class="link-btn danger" onclick={() => remove(item.id)}>{m.integrations_delete()}</button>
				</div>
			</li>
		{/each}
	</ul>

	{#if showForm}
		<div class="form-card">
			<h2>{editingId ? m.integrations_edit() : m.integrations_add()}</h2>
			<div class="fields">
				<Textbox label={m.integrations_name()} bind:value={form.name} required />
				<Textbox label={m.integrations_description()} bind:value={form.description} />
				<Textbox label={m.integrations_base_url()} bind:value={form.baseUrl} placeholder="https://api.example.com" required />
				<Select label={m.integrations_auth_type()} bind:value={form.authType} options={AUTH_OPTIONS} />

				{#if form.authType === 'api_key'}
					<Textbox label={m.integrations_header_name()} bind:value={cfgHeaderName} />
					<Textbox label={m.integrations_token()} type="password" bind:value={cfgToken} />
				{:else if form.authType === 'bearer'}
					<Textbox label={m.integrations_token()} type="password" bind:value={cfgToken} />
				{:else if form.authType === 'basic'}
					<Textbox label={m.integrations_username()} bind:value={cfgUsername} />
					<Textbox label={m.integrations_password()} type="password" bind:value={cfgPassword} />
				{/if}
			</div>
			<div class="form-actions">
				<button class="cancel-btn" onclick={cancel}>{m.integrations_cancel()}</button>
				<button class="save-btn" onclick={save} disabled={saving || !form.name || !form.baseUrl}>
					{m.integrations_save()}
				</button>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.page {
		padding: 40px 48px;
		max-width: 720px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 28px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 32px;
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

	.section-title {
		font-size: 1rem;
		font-weight: 600;
	}

	.add-btn {
		padding: 8px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.add-btn:hover { opacity: 0.85; }

	.empty {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		margin-top: 40px;
		text-align: center;
	}

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 24px;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-name {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.item-url {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.item-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.link-btn {
		background: none;
		border: none;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0;
	}

	.link-btn:hover { color: var(--color-text); }
	.link-btn.danger:hover { color: var(--color-danger); }

	.form-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 24px;
		background: var(--color-surface);
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 20px;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 24px;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.cancel-btn {
		padding: 8px 16px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.cancel-btn:hover { border-color: var(--color-text-muted); }

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
</style>
