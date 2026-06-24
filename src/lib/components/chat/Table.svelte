<script lang="ts">
	import type { TableColumn } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { LIST_PAGE_SIZE } from '$lib/constants';

	type Props = {
		columns: TableColumn[];
		rows: Record<string, unknown>[];
		onRowClick?: (row: Record<string, unknown>) => void;
	};

	let { columns, rows, onRowClick }: Props = $props();

	let page = $state(1);
	const totalPages = $derived(Math.max(1, Math.ceil(rows.length / LIST_PAGE_SIZE)));
	// rows が変わった時に範囲外ページを補正
	$effect(() => {
		if (page > totalPages) page = totalPages;
	});
	const pagedRows = $derived(
		rows.length > LIST_PAGE_SIZE
			? rows.slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE)
			: rows
	);
</script>

<div class="table-wrapper">
	<table>
		<thead>
			<tr>
				{#each columns as col}
					<th>{col.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td colspan={columns.length} class="empty">{m.table_empty()}</td>
				</tr>
			{:else}
				{#each pagedRows as row}
					<tr
						class:clickable={!!onRowClick}
						role={onRowClick ? 'button' : undefined}
						tabindex={onRowClick ? 0 : undefined}
						onclick={onRowClick ? () => onRowClick(row) : undefined}
						onkeydown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
					>
						{#each columns as col}
							<td>{row[col.key] ?? '—'}</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
	<div class="table-footer">
		<p class="count">{m.table_count({ count: rows.length })}</p>
		{#if totalPages > 1}
			<Pagination bind:page {totalPages} />
		{/if}
	</div>
</div>

<style lang="scss">
	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	th {
		text-align: left;
		padding: 8px 12px;
		background: var(--color-surface);
		border-bottom: 2px solid var(--color-border);
		font-weight: 600;
		white-space: nowrap;
	}

	td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
	}

	tr:hover td {
		background: var(--color-surface);
	}

	tr.clickable {
		cursor: pointer;
	}

	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 24px;
	}

	.table-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 8px;
	}

	.count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}
</style>
