<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="page">
	<div class="page-header">
		<a href="/" class="back-link">
			<ChevronLeft size={16} />
			テーブル一覧
		</a>
		<div class="header-main">
			<div class="header-title">
				<span class="app-icon"><AppIcon icon={data.app.icon} size={24} /></span>
				<h1>{data.app.label}</h1>
			</div>
			{#if data.account?.permission === 'admin'}
				<a href="/apps/{data.app.id}/tables/{data.tables[0]?.id}/build" class="btn-secondary">
					テーブル設定
				</a>
			{/if}
		</div>
	</div>

	<div class="table-list">
		{#each data.tables as table (table.id)}
			<button
				class="table-card"
				onclick={() => goto(`/apps/${data.app.id}/tables/${table.id}`)}
			>
				<span class="table-icon"><AppIcon icon={table.icon} size={18} /></span>
				<span class="table-label">{table.label}</span>
				<span class="table-count">{table.recordCount} 件</span>
				<span class="table-arrow">›</span>
			</button>
		{:else}
			<p class="empty">テーブルがまだありません。</p>
		{/each}
	</div>
</div>

<style lang="scss">
	.page {
		padding: 28px 32px;
		max-width: 720px;
	}

	.page-header {
		margin-bottom: 28px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 12px;
		&:hover { color: var(--color-text); }
	}

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.app-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		color: var(--color-primary);
		flex-shrink: 0;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.btn-secondary {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
		&:hover { background: var(--color-border); }
	}

	.table-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.table-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.9375rem;
		font-family: inherit;
		color: var(--color-text);
		text-align: left;
		width: 100%;
		transition: border-color 0.15s, box-shadow 0.15s;

		&:hover {
			border-color: var(--color-primary);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		}
	}

	.table-icon {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.table-label {
		flex: 1;
		font-weight: 500;
	}

	.table-count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.table-arrow {
		font-size: 1.125rem;
		color: var(--color-text-muted);
	}

	.empty {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 24px 0;
	}
</style>
