<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Props = {
		items: T[];
		card: Snippet<[T]>;
		empty?: string;
		columns?: 1 | 2 | 3 | 4;
	};

	let { items, card, empty = 'No data available', columns = 3 }: Props = $props();
</script>

{#if items.length === 0}
	<p class="empty">{empty}</p>
{:else}
	<div class="grid" style:--cols={columns}>
		{#each items as item}
			<div class="card">
				{@render card(item)}
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 3), 1fr);
		gap: 16px;
	}
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 16px;
		transition: box-shadow 0.15s, border-color 0.15s;
	}
	.card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
	}
	.empty {
		text-align: center;
		color: var(--color-text-muted);
		padding: 40px;
		font-size: 0.9375rem;
	}
</style>
