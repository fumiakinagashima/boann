<script lang="ts">
	type Props = {
		label?: string;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		prefix?: string;
		suffix?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		error?: string;
	};

	let {
		label,
		value = $bindable(0),
		min,
		max,
		step = 1,
		prefix,
		suffix,
		placeholder = '',
		required = false,
		disabled = false,
		error
	}: Props = $props();

	const uid = `num-${Math.random().toString(36).slice(2, 7)}`;

	const atMin = $derived(min !== undefined && (value ?? 0) <= min);
	const atMax = $derived(max !== undefined && (value ?? 0) >= max);

	function increment() {
		const next = (value ?? 0) + step;
		value = max !== undefined ? Math.min(next, max) : next;
	}

	function decrement() {
		const next = (value ?? 0) - step;
		value = min !== undefined ? Math.max(next, min) : next;
	}
</script>

<div class="field" class:has-error={!!error}>
	{#if label}
		<label for={uid}>{label}{#if required}<span class="req">*</span>{/if}</label>
	{/if}
	<div class="wrap">
		<button type="button" class="stepper" onclick={decrement} disabled={disabled || atMin} tabindex="-1">−</button>
		{#if prefix}<span class="affix">{prefix}</span>{/if}
		<input
			id={uid}
			type="number"
			bind:value
			{min}
			{max}
			{step}
			{placeholder}
			{required}
			{disabled}
		/>
		{#if suffix}<span class="affix">{suffix}</span>{/if}
		<button type="button" class="stepper" onclick={increment} disabled={disabled || atMax} tabindex="-1">＋</button>
	</div>
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field { display: flex; flex-direction: column; gap: 4px; }
	label { font-size: 0.875rem; color: var(--color-text-muted); }
	.req { color: var(--color-danger); margin-left: 2px; }
	.wrap {
		display: flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		overflow: hidden;
		transition: border-color 0.15s;
	}
	.wrap:focus-within { border-color: var(--color-primary); }
	.has-error .wrap { border-color: var(--color-danger); }
	.stepper {
		padding: 0 12px;
		height: 38px;
		background: var(--color-surface);
		border: none;
		border-right: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.stepper:last-child { border-right: none; border-left: 1px solid var(--color-border); }
	.stepper:hover:not(:disabled) { background: var(--color-border); }
	.stepper:disabled { opacity: 0.4; cursor: not-allowed; }
	.affix {
		padding: 0 8px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	input {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		border: none;
		background: transparent;
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		text-align: center;
	}
	input::-webkit-inner-spin-button,
	input::-webkit-outer-spin-button { appearance: none; }
	input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
	input:disabled { opacity: 0.5; cursor: not-allowed; }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
