<script lang="ts">
	import { onMount } from 'svelte';
	import GanttChart from '$lib/components/database/GanttChart.svelte';
	import type { RecordRow } from '$lib/server/db/table-service';

	type Filter = { status?: string[]; customerId?: string };

	type Props = {
		title?: string;
		filter?: Filter;
	};

	let { title, filter }: Props = $props();

	type Deal = {
		id: string; title: string; customerId: string;
		status: string; amount: number | null;
		plannedStart: string | null; plannedEnd: string | null;
	};
	type Customer = { id: string; name: string };

	let deals = $state<Deal[]>([]);
	let customers = $state<Customer[]>([]);
	let loading = $state(true);

	const displayDeals = $derived(
		deals.filter(d => {
			if (filter?.status && !filter.status.includes(d.status)) return false;
			if (filter?.customerId && d.customerId !== filter.customerId) return false;
			return true;
		})
	);

	onMount(async () => {
		const [dealRes, custRes] = await Promise.all([
			fetch('/api/database/deals/records'),
			fetch('/api/database/customers/records')
		]);
		if (dealRes.ok) {
			const data = await dealRes.json() as { rows: RecordRow[] };
			deals = data.rows.map(r => ({
				id: String(r.id), title: String(r.title ?? ''),
				customerId: String(r.customerId ?? ''), status: String(r.status ?? 'open'),
				amount: r.amount != null ? Number(r.amount) : null,
				plannedStart: r.plannedStart ? String(r.plannedStart) : null,
				plannedEnd:   r.plannedEnd   ? String(r.plannedEnd)   : null
			}));
		}
		if (custRes.ok) {
			const data = await custRes.json() as { rows: RecordRow[] };
			customers = data.rows.map(r => ({ id: String(r.id), name: String(r.name ?? '') }));
		}
		loading = false;
	});

	async function handleDateChange(id: string, plannedStart: string, plannedEnd: string) {
		const res = await fetch(`/api/database/deals/records/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ plannedStart, plannedEnd })
		});
		if (res.ok) {
			deals = deals.map(d => d.id === id ? { ...d, plannedStart, plannedEnd } : d);
		}
	}
</script>

<div class="gantt-card">
	{#if title}
		<div class="card-title">{title}</div>
	{/if}
	{#if loading}
		<p class="loading">読み込み中...</p>
	{:else if displayDeals.length === 0}
		<p class="empty">表示できる案件がありません。</p>
	{:else}
		<div class="chart-wrap">
			<GanttChart deals={displayDeals} {customers} onDateChange={handleDateChange} />
		</div>
	{/if}
</div>

<style lang="scss">
	.gantt-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		width: 100%;
	}

	.card-title {
		padding: 10px 14px;
		font-size: 0.875rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.loading, .empty {
		padding: 20px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.chart-wrap {
		height: 320px;
		display: flex;
		flex-direction: column;
	}
</style>
