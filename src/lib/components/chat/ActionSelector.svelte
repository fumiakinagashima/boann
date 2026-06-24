<script lang="ts">
	import Check from '$lib/components/icon/Check.svelte';
	import type { ActionItem } from '$lib/types/chat';

	type Props = {
		title?: string;
		actions: ActionItem[];
		onselect: (action: ActionItem) => void;
	};

	let { title, actions, onselect }: Props = $props();

	let selected = $state<string | null>(null);

	function handleSelect(action: ActionItem) {
		if (selected !== null) return;
		selected = action.id;
		onselect(action);
	}
</script>

<div class="selector">
	{#if title}
		<p class="title">{title}</p>
	{/if}
	<div class="actions">
		{#each actions as action}
			<button
				type="button"
				class:selected={selected === action.id}
				class:dimmed={selected !== null && selected !== action.id}
				disabled={selected !== null}
				onclick={() => handleSelect(action)}
			>
				<span class="label">{action.label}</span>
				{#if action.description}
					<span class="desc">{action.description}</span>
				{/if}
				{#if selected === action.id}
					<Check size={16} class="check" />
				{/if}
			</button>
		{/each}
	</div>
</div>

<style lang="scss">
	.selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-width: 420px;
	}

	.title {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	button {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 36px 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, opacity 0.15s;

		&:hover:not(:disabled) {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
		}

		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
		}

		&.dimmed { opacity: 0.4; }
		&:disabled { cursor: default; }
	}

	.label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	:global(.check) {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-primary);
		flex-shrink: 0;
	}
</style>
