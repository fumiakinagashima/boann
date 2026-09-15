<script lang="ts">
	import Pagination from './Pagination.svelte';

	type Column = { key: string; label: string; sortable?: boolean };
	type Row = Record<string, unknown>;

	type Props = {
		columns: Column[];
		rows: Row[];
		empty?: string;
		pageSize?: number;
	};

	let { columns, rows, empty = 'No data available', pageSize }: Props = $props();

	let sortKey = $state<string | null>(null);
	let sortAsc = $state(true);
	let page = $state(1);

	function toggleSort(col: Column) {
		if (!col.sortable) return;
		if (sortKey === col.key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = col.key;
			sortAsc = true;
		}
		page = 1;
	}

	const sorted = $derived.by(() => {
		if (!sortKey) return rows;
		const key = sortKey;
		return [...rows].sort((a, b) => {
			const cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'en');
			return sortAsc ? cmp : -cmp;
		});
	});

	const totalPages = $derived(pageSize ? Math.ceil(sorted.length / pageSize) : 1);

	const paged = $derived.by(() => {
		if (!pageSize) return sorted;
		const start = (page - 1) * pageSize;
		return sorted.slice(start, start + pageSize);
	});

	const rangeLabel = $derived.by(() => {
		if (!pageSize) return null;
		const start = (page - 1) * pageSize + 1;
		const end = Math.min(page * pageSize, sorted.length);
		return `${start}–${end} / ${sorted.length}`;
	});
</script>

<div class="container">
	<div class="wrap">
		<table>
			<thead>
				<tr>
					{#each columns as col}
						<th class:sortable={col.sortable} onclick={() => toggleSort(col)}>
							{col.label}
							{#if col.sortable}
								<span class="sort">
									{#if sortKey === col.key}{sortAsc ? '↑' : '↓'}{:else}↕{/if}
								</span>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if paged.length === 0}
					<tr><td colspan={columns.length} class="empty">{empty}</td></tr>
				{:else}
					{#each paged as row}
						<tr>
							{#each columns as col}
								<td>{row[col.key] ?? '—'}</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if pageSize && totalPages > 1}
		<div class="footer">
			<span class="range">{rangeLabel}</span>
			<Pagination bind:page {totalPages} />
		</div>
	{/if}
</div>

<style lang="scss">
	.container { display: flex; flex-direction: column; gap: 12px; }
	.wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}
	table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
	th {
		padding: 10px 14px;
		text-align: left;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
		border-bottom: 1px solid var(--color-border);
	}
	th.sortable { cursor: pointer; user-select: none; }
	th.sortable:hover { color: var(--color-text); }
	.sort { margin-left: 4px; opacity: 0.5; font-size: 0.75rem; }
	td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
	}
	tr:last-child td { border-bottom: none; }
	tbody tr:hover td { background: var(--color-surface); }
	.empty { text-align: center; color: var(--color-text-muted); padding: 32px; }
	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.range { font-size: 0.8125rem; color: var(--color-text-muted); }
</style>
