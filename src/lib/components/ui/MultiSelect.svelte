<script lang="ts">
	type Option = { value: string; label: string };

	type Props = {
		label?: string;
		value?: string[];
		options: Option[];
		disabled?: boolean;
		error?: string;
	};

	let {
		label,
		value = $bindable([]),
		options,
		disabled = false,
		error
	}: Props = $props();

	function toggle(v: string) {
		if (disabled) return;
		value = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
	}
</script>

<div class="field" class:has-error={!!error}>
	{#if label}<p class="label">{label}</p>{/if}
	<div class="group">
		{#each options as opt}
			<button
				type="button"
				class:active={value.includes(opt.value)}
				onclick={() => toggle(opt.value)}
				{disabled}
			>{opt.label}</button>
		{/each}
	</div>
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field { display: flex; flex-direction: column; gap: 6px; }
	.label { font-size: 0.875rem; color: var(--color-text-muted); }
	.group { display: flex; flex-wrap: wrap; gap: 6px; }
	button {
		padding: 5px 14px;
		border: 1px solid var(--color-border);
		border-radius: 20px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}
	button:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
	button.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
	button:disabled { opacity: 0.5; cursor: not-allowed; }
	.has-error button { border-color: var(--color-danger); }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
