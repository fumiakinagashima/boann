<script lang="ts">
	type Props = {
		label?: string;
		value?: string;
		required?: boolean;
		disabled?: boolean;
		min?: string;
		max?: string;
		error?: string;
	};

	let {
		label,
		value = $bindable(''),
		required = false,
		disabled = false,
		min,
		max,
		error
	}: Props = $props();

	const uid = `dtp-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="field" class:has-error={!!error}>
	{#if label}
		<label for={uid}>{label}{#if required}<span class="req">*</span>{/if}</label>
	{/if}
	<input id={uid} type="datetime-local" bind:value {required} {disabled} {min} {max} />
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field { display: flex; flex-direction: column; gap: 4px; }
	label { font-size: 0.875rem; color: var(--color-text-muted); }
	.req { color: var(--color-danger); margin-left: 2px; }
	input {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		transition: border-color 0.15s;
	}
	input:focus { border-color: var(--color-primary); }
	input:disabled { opacity: 0.5; cursor: not-allowed; }
	.has-error input { border-color: var(--color-danger); }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
