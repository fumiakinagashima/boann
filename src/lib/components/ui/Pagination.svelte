<script lang="ts">
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import ChevronRight from '$lib/components/icon/ChevronRight.svelte';

	type Props = {
		page: number;
		totalPages: number;
		onchange?: (page: number) => void;
	};

	let { page = $bindable(1), totalPages, onchange }: Props = $props();

	function go(p: number) {
		if (p < 1 || p > totalPages || p === page) return;
		page = p;
		onchange?.(p);
	}

	// null = ellipsis
	const pages = $derived.by((): (number | null)[] => {
		if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
		const result: (number | null)[] = [];
		const delta = 2;
		result.push(1);
		if (page - delta > 2) result.push(null);
		for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
			result.push(i);
		}
		if (page + delta < totalPages - 1) result.push(null);
		if (totalPages > 1) result.push(totalPages);
		return result;
	});
</script>

<nav class="pagination" aria-label="Page navigation">
	<button class="nav" onclick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
		<ChevronLeft size={14} />
	</button>

	{#each pages as p}
		{#if p === null}
			<span class="ellipsis">…</span>
		{:else if typeof p === 'number'}
			<button class:active={p === page} onclick={() => go(p)}>{p}</button>
		{/if}
	{/each}

	<button class="nav" onclick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Next page">
		<ChevronRight size={14} />
	</button>
</nav>

<style lang="scss">
	.pagination {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	button {
		min-width: 32px;
		height: 32px;
		padding: 0 8px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover:not(:disabled):not(.active) {
			background: var(--color-surface);
			border-color: var(--color-primary);
		}

		&.active {
			background: var(--color-primary);
			border-color: var(--color-primary);
			color: #fff;
		}

		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}
	}

	.ellipsis {
		min-width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
