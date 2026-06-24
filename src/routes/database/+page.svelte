<script lang="ts">
	import type { Component } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import type { PageData } from './$types';
	import Building from '$lib/components/icon/Building.svelte';
	import User from '$lib/components/icon/User.svelte';
	import Briefcase from '$lib/components/icon/Briefcase.svelte';
	import Clipboard from '$lib/components/icon/Clipboard.svelte';
	import Table from '$lib/components/icon/Table.svelte';
	import SchemaEditorDialog from '$lib/components/dialog/SchemaEditorDialog.svelte';

	let { data }: { data: PageData } = $props();
	const tables = $derived(data.tables);

	const ICON_MAP: Record<string, Component> = { building: Building, user: User, briefcase: Briefcase, clipboard: Clipboard, table: Table };

	let newTableDialogOpen = $state(false);

	async function handleNewTableSaved(newType?: string) {
		newTableDialogOpen = false;
		await invalidateAll();
		if (newType) goto(`/database/${newType}`);
	}
</script>

<div class="page">
	<header class="page-header">
		<h1>データ管理</h1>
	</header>

	<section>
		<h2 class="section-title">コアテーブル</h2>
		<div class="grid">
			{#each tables.filter(t => t.isCore) as table}
				{@const Icon = ICON_MAP[table.icon] ?? ICON_MAP.table}
				<a href="/database/{table.id}" class="card">
					<span class="card-icon"><Icon size={28} /></span>
					<span class="card-label">{table.label}</span>
					<span class="card-count">{table.count} 件</span>
				</a>
			{/each}
		</div>
	</section>

	<section>
		<div class="section-header">
			<h2 class="section-title">カスタムテーブル</h2>
			<button class="btn-new" onclick={() => (newTableDialogOpen = true)}>+ 新規テーブル作成</button>
		</div>
		{#if tables.filter(t => !t.isCore).length === 0}
			<div class="empty-custom">
				<p>カスタムテーブルはまだありません。</p>
				<button class="btn-new" onclick={() => (newTableDialogOpen = true)}>最初のテーブルを作成</button>
			</div>
		{:else}
			<div class="grid">
				{#each tables.filter(t => !t.isCore) as table}
					{@const Icon = ICON_MAP[table.icon] ?? ICON_MAP.table}
					<a href="/database/{table.id}" class="card">
						<span class="card-icon"><Icon size={28} /></span>
						<span class="card-label">{table.label}</span>
						<span class="card-count">{table.count} 件</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

{#if newTableDialogOpen}
	<SchemaEditorDialog
		mode="create"
		onclose={() => (newTableDialogOpen = false)}
		onSaved={handleNewTableSaved}
	/>
{/if}

<style lang="scss">
	.page {
		padding: 32px;
	}

	.page-header {
		margin-bottom: 32px;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		margin: 0;
	}

	section {
		margin-bottom: 32px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 12px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 20px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		text-decoration: none;
		color: var(--color-text);
		transition: border-color 0.15s, box-shadow 0.15s;
		cursor: pointer;
	}

	.card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.card-icon {
		color: var(--color-primary);
		display: flex;
	}

	.card-label {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.card-count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-header .section-title { margin: 0; }

	.btn-new {
		padding: 6px 12px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.8125rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn-new:hover { opacity: 0.88; }

	.empty-custom {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}

	.empty-custom p { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }
</style>
