<script lang="ts">
	type Props = {
		label?: string;
		checked?: boolean;
		disabled?: boolean;
	};

	let {
		label,
		checked = $bindable(false),
		disabled = false
	}: Props = $props();

	const uid = `tgl-${Math.random().toString(36).slice(2, 7)}`;
</script>

<div class="row" class:disabled>
	<input type="checkbox" id={uid} bind:checked {disabled} class="sr-only" />
	<label for={uid} class="track">
		<span class="knob"></span>
	</label>
	{#if label}
		<label for={uid} class="text">{label}</label>
	{/if}
</div>

<style lang="scss">
	.row { display: flex; align-items: center; gap: 10px; }
	.row.disabled { opacity: 0.5; }
	.sr-only {
		position: absolute;
		width: 1px; height: 1px;
		padding: 0; margin: -1px;
		overflow: hidden; clip: rect(0,0,0,0);
		white-space: nowrap; border: 0;
	}
	.track {
		position: relative;
		display: inline-block;
		width: 40px; height: 22px;
		border-radius: 11px;
		background: var(--color-border);
		cursor: pointer;
		transition: background 0.2s;
		flex-shrink: 0;
	}
	input:checked + .track { background: var(--color-primary); }
	.knob {
		position: absolute;
		top: 3px; left: 3px;
		width: 16px; height: 16px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.3);
	}
	input:checked + .track .knob { transform: translateX(18px); }
	.text { font-size: 0.9375rem; color: var(--color-text); cursor: pointer; }
	.disabled .text { cursor: not-allowed; }
</style>
