<script lang="ts">
	import type { ValueItem } from '$lib/types/chat';

	type Props = {
		title?: string;
		items: ValueItem[];
	};

	let { title, items }: Props = $props();

	function formatValue(value: string | number | null, format: ValueItem['format']): string {
		if (value === null || value === undefined || value === '') return '—';

		if (format === 'currency') {
			const num = typeof value === 'string' ? parseFloat(value) : value;
			if (isNaN(num as number)) return String(value);
			return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'JPY' }).format(num as number);
		}

		if (format === 'number') {
			const num = typeof value === 'string' ? parseFloat(value) : value;
			if (isNaN(num as number)) return String(value);
			return new Intl.NumberFormat('en-US').format(num as number);
		}

		if (format === 'date' || format === 'datetime') {
			const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value as string);
			if (isNaN(date.getTime())) return String(value);
			if (format === 'date') {
				return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
			}
			return new Intl.DateTimeFormat('en-US', {
				year: 'numeric', month: 'long', day: 'numeric',
				hour: '2-digit', minute: '2-digit'
			}).format(date);
		}

		return String(value);
	}
</script>

<div class="values">
	{#if title}
		<p class="values-title">{title}</p>
	{/if}
	<dl>
		{#each items as item}
			<div class="row">
				<dt>{item.label}</dt>
				<dd>{formatValue(item.value, item.format)}</dd>
			</div>
		{/each}
	</dl>
</div>

<style lang="scss">
	.values {
		padding: 14px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		min-width: 240px;
		max-width: 480px;
	}

	.values-title {
		font-weight: 600;
		font-size: 0.875rem;
		margin: 0 0 10px;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		font-size: 0.9375rem;
	}

	dt {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	dd {
		margin: 0;
		font-weight: 500;
		text-align: right;
	}
</style>
