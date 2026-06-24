<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value' | 'type'> & {
		label?: string;
		value?: string;
		type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'url';
		error?: string;
	};

	let {
		label,
		value = $bindable(''),
		type = 'text',
		error,
		...rest
	}: Props = $props();

	const uid = `tb-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="field" class:has-error={!!error}>
	{#if label}
		<label for={uid}>{label}{#if rest.required}<span class="req">*</span>{/if}</label>
	{/if}
	<input id={uid} {type} bind:value {...rest} />
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
