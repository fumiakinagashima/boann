<script lang="ts">
	import { untrack } from 'svelte';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import type { PageData } from './$types';

	// TODO: A test-send feature for verifying connections (2026-07-22, requested by the user). On hold
	// since the UI hasn't been decided. When implemented, add a button here (in each list row, or
	// inside the edit form), which will need a new API endpoint that attaches the headers server-side
	// and actually sends a connectivity-check request to the url.

	let { data }: { data: PageData } = $props();

	type Connection = {
		id: string;
		name: string;
		url: string;
		headers: Record<string, string>;
		createdAt: Date;
	};

	type HeaderRow = { key: string; value: string };

	type FormState = {
		name: string;
		url: string;
		headers: HeaderRow[];
	};

	let items = $state<Connection[]>(untrack(() => data.items));
	$effect(() => {
		items = data.items;
	});

	let editingId = $state<string | null>(null);
	let showForm = $state(false);
	let saving = $state(false);

	let form = $state<FormState>({ name: '', url: '', headers: [] });

	function headersToRows(headers: Record<string, string>): HeaderRow[] {
		return Object.entries(headers).map(([key, value]) => ({ key, value }));
	}

	function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
		const headers: Record<string, string> = {};
		for (const row of rows) {
			if (row.key.trim()) headers[row.key.trim()] = row.value;
		}
		return headers;
	}

	function openAdd() {
		editingId = null;
		form = { name: '', url: '', headers: [] };
		showForm = true;
	}

	function openEdit(item: Connection) {
		editingId = item.id;
		form = { name: item.name, url: item.url, headers: headersToRows(item.headers) };
		showForm = true;
	}

	function cancel() {
		showForm = false;
		editingId = null;
	}

	function addHeaderRow() {
		form.headers = [...form.headers, { key: '', value: '' }];
	}

	function removeHeaderRow(index: number) {
		form.headers = form.headers.filter((_, i) => i !== index);
	}

	async function save() {
		saving = true;
		try {
			const payload = { name: form.name, url: form.url, headers: rowsToHeaders(form.headers) };
			if (editingId) {
				const res = await fetch(`/api/api-connections/${editingId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const updated = (await res.json()) as Connection;
				items = items.map((i) => (i.id === editingId ? updated : i));
			} else {
				const res = await fetch('/api/api-connections', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const created = (await res.json()) as Connection;
				items = [...items, created].sort((a, b) => a.name.localeCompare(b.name));
			}
			cancel();
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		if (!confirm('Delete this connection?')) return;
		await fetch(`/api/api-connections/${id}`, { method: 'DELETE' });
		items = items.filter((i) => i.id !== id);
	}
</script>

<svelte:head><title>API connections — BOANN</title></svelte:head>

<div class="page">
	<div class="header">
		<h1>API connections</h1>
		<button class="add-btn" onclick={openAdd}>+ Add</button>
	</div>
	<p class="intro">
		Connection settings for external APIs, used by the workflow "Call external API" action (shared across the whole system).
	</p>

	{#if items.length === 0 && !showForm}
		<p class="empty">No connections yet</p>
	{/if}

	<ul class="list">
		{#each items as item (item.id)}
			<li class="item">
				<div class="item-info">
					<span class="item-name">{item.name}</span>
					<span class="item-url">{item.url}</span>
				</div>
				<div class="item-meta">
					<span class="badge">{Object.keys(item.headers).length} header(s)</span>
					<button class="link-btn" onclick={() => openEdit(item)}>Edit</button>
					<button class="link-btn danger" onclick={() => remove(item.id)}>Delete</button>
				</div>
			</li>
		{/each}
	</ul>

	{#if showForm}
		<div class="form-card">
			<h2>{editingId ? 'Edit connection' : 'Add connection'}</h2>
			<div class="fields">
				<Textbox label="API name" bind:value={form.name} required />
				<Textbox label="URL" bind:value={form.url} placeholder="https://api.example.com" required />

				<div class="headers-field">
					<span class="headers-label">Headers</span>
					{#each form.headers as row, i (i)}
						<div class="header-row">
							<input class="header-key" type="text" placeholder="Key (e.g. Authorization)" bind:value={row.key} />
							<input class="header-value" type="text" placeholder="Value" bind:value={row.value} />
							<button class="header-del" onclick={() => removeHeaderRow(i)} title="Delete">×</button>
						</div>
					{/each}
					<button class="add-header-btn" onclick={addHeaderRow}>+ Add header</button>
				</div>
			</div>
			<div class="form-actions">
				<button class="cancel-btn" onclick={cancel}>Cancel</button>
				<button class="save-btn" onclick={save} disabled={saving || !form.name || !form.url}>Save</button>
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
		margin-bottom: 8px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.intro {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 28px;
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

	.headers-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.headers-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;

		input {
			padding: 8px 10px;
			border: 1px solid var(--color-border);
			border-radius: 6px;
			background: var(--color-background);
			color: var(--color-text);
			font-size: 0.9375rem;
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}

		.header-key {
			flex: 3 1 0;
		}

		.header-value {
			flex: 7 1 0;
		}
	}

	.header-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 15px;
		padding: 0 4px;
		flex-shrink: 0;
		&:hover { color: var(--color-danger); }
	}

	.add-header-btn {
		align-self: flex-start;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dashed var(--color-border);
		padding: 4px 10px;
		border-radius: 5px;
		cursor: pointer;
		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}
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
