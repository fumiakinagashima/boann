<script lang="ts">
	type Option = { value: string; label: string };

	type Props = {
		label?: string;
		value?: string;
		options: Option[];
		disabled?: boolean;
		error?: string;
	};

	let {
		label,
		value = $bindable(''),
		options,
		disabled = false,
		error
	}: Props = $props();
</script>

<div class="field" class:has-error={!!error}>
	{#if label}<p class="label">{label}</p>{/if}
	<div class="group">
		{#each options as opt}
			<button
				type="button"
				class:active={value === opt.value}
				onclick={() => { if (!disabled) value = opt.value; }}
				{disabled}
			>{opt.label}</button>
		{/each}
	</div>
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field { display: flex; flex-direction: column; gap: 6px; }
	.label { font-size: 0.875rem; color: var(--color-text-muted); }
	.group {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		width: fit-content;
	}
	button {
		padding: 7px 16px;
		border: none;
		border-right: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	button:last-child { border-right: none; }
	button:hover:not(:disabled):not(.active) { background: var(--color-surface); }
	button.active { background: var(--color-primary); color: #fff; }
	button:disabled { opacity: 0.5; cursor: not-allowed; }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
