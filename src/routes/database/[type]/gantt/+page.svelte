<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import GanttChart from '$lib/components/database/GanttChart.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const tableLabel = $derived(data.tableLabel);
	const customers = $derived(data.customers);

	let deals = $state(untrack(() => data.deals));
	$effect(() => {
		deals = data.deals;
	});

	async function handleDateChange(id: string, plannedStart: string, plannedEnd: string) {
		const res = await fetch(`/api/database/deals/records/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ plannedStart, plannedEnd })
		});
		if (res.ok) {
			deals = deals.map(d =>
				d.id === id ? { ...d, plannedStart, plannedEnd } : d
			);
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/{type}">{tableLabel}</a>
			<span class="sep">/</span>
			<span>ガントチャート</span>
		</div>
		<a href="/database/{type}" class="btn-list">リスト表示</a>
	</header>

	{#if deals.length === 0}
		<div class="empty">
			<p>案件データがありません。</p>
			<a href="/database/deals/new" class="btn-primary">案件を作成</a>
		</div>
	{:else}
		<div class="chart-wrap">
			<GanttChart {deals} {customers} onDateChange={handleDateChange} />
		</div>
	{/if}
</div>

<style lang="scss">
	.page {
		padding: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 24px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
	}
	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.btn-list {
		padding: 6px 14px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
	}
	.btn-list:hover { color: var(--color-text); border-color: var(--color-text-muted); }

	.chart-wrap {
		flex: 1;
		padding: 4px 0 4px 24px;
		display: flex;
		flex-direction: column;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 40px 24px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
	}
</style>
