<script lang="ts">
	type Props = {
		label?: string;
		value?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		rows?: number;
		error?: string;
	};

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		required = false,
		disabled = false,
		rows = 4,
		error
	}: Props = $props();

	const uid = `ta-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="field" class:has-error={!!error}>
	{#if label}
		<label for={uid}>{label}{#if required}<span class="req">*</span>{/if}</label>
	{/if}
	<textarea id={uid} bind:value {placeholder} {required} {disabled} {rows}></textarea>
	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field { display: flex; flex-direction: column; gap: 4px; }
	label { font-size: 0.875rem; color: var(--color-text-muted); }
	.req { color: var(--color-danger); margin-left: 2px; }
	textarea {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
		resize: vertical;
		font-family: inherit;
		line-height: 1.5;
		transition: border-color 0.15s;
	}
	textarea:focus { border-color: var(--color-primary); }
	textarea:disabled { opacity: 0.5; cursor: not-allowed; }
	.has-error textarea { border-color: var(--color-danger); }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
