<script lang="ts">
	import Upload from '$lib/components/icon/Upload.svelte';

	type Props = {
		label?: string;
		accept?: string;
		multiple?: boolean;
		disabled?: boolean;
		error?: string;
		onchange?: (files: File[]) => void;
	};

	let {
		label,
		accept,
		multiple = false,
		disabled = false,
		error,
		onchange
	}: Props = $props();

	let files = $state<File[]>([]);
	let dragging = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	function handleChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		files = Array.from(input.files ?? []);
		onchange?.(files);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (disabled) return;
		const dropped = Array.from(e.dataTransfer?.files ?? []);
		files = multiple ? dropped : dropped.slice(0, 1);
		onchange?.(files);
	}

	function removeFile(i: number) {
		files = files.filter((_, idx) => idx !== i);
		onchange?.(files);
	}
</script>

<div class="field" class:has-error={!!error}>
	{#if label}<p class="label">{label}</p>{/if}

	<div
		class="zone"
		class:dragging
		class:disabled
		role="button"
		tabindex={disabled ? -1 : 0}
		onclick={() => inputEl?.click()}
		onkeydown={(e) => e.key === 'Enter' && inputEl?.click()}
		ondragover={(e) => { e.preventDefault(); if (!disabled) dragging = true; }}
		ondragleave={() => dragging = false}
		ondrop={handleDrop}
	>
		<Upload size={28} />
		<p>Click or drag and drop</p>
		{#if accept}<span class="hint">{accept}</span>{/if}
		<input
			bind:this={inputEl}
			type="file"
			{accept}
			{multiple}
			{disabled}
			onchange={handleChange}
			class="hidden"
		/>
	</div>

	{#if files.length > 0}
		<ul class="list">
			{#each files as f, i}
				<li>
					<span class="name">{f.name}</span>
					<span class="size">{(f.size / 1024).toFixed(1)} KB</span>
					<button type="button" onclick={() => removeFile(i)} aria-label="Remove">×</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if error}<p class="err">{error}</p>{/if}
</div>

<style lang="scss">
	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.label {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px 16px;
		border: 2px dashed var(--color-border);
		border-radius: 8px;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		user-select: none;
		text-align: center;
		color: var(--color-text-muted);

		&:hover:not(.disabled),
		&.dragging {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, transparent);
		}

		&.disabled { opacity: 0.5; cursor: not-allowed; }

		p { font-size: 0.875rem; }
	}

	.hint { font-size: 0.75rem; color: var(--color-text-muted); }
	.hidden { display: none; }

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;

		li {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 10px;
			background: var(--color-surface);
			border-radius: 6px;
			font-size: 0.875rem;
		}
	}

	.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.size { color: var(--color-text-muted); flex-shrink: 0; }

	.list button {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0 4px;
		font-size: 1rem;
		line-height: 1;

		&:hover { color: var(--color-danger); }
	}

	.has-error .zone { border-color: var(--color-danger); }
	.err { font-size: 0.75rem; color: var(--color-danger); }
</style>
