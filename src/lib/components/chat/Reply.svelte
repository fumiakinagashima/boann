<script lang="ts">
	import type { ReplyField, ReplyOption } from '$lib/types/chat';
	import Check from '$lib/components/icon/Check.svelte';

	type Props = {
		title?: string;
		fields: ReplyField[];
		submitLabel?: string;
		onsubmit: (answer: string) => void;
	};

	let { title, fields, submitLabel = 'Send', onsubmit }: Props = $props();

	let answers = $state<Record<string, string | string[]>>(
		Object.fromEntries(fields.map((f) => [f.key, f.type === 'multiple' ? [] : '']))
	);
	let submitted = $state(false);

	const isInstantSingle = $derived(fields.length === 1 && fields[0].type === 'single');

	function formatAnswer(): string {
		const parts: string[] = [];
		for (const field of fields) {
			const val = answers[field.key];
			let text = '';
			if (field.type === 'single') {
				const selected = val as string;
				text = field.options?.find((o) => o.value === selected)?.label ?? selected;
			} else if (field.type === 'multiple') {
				const selected = val as string[];
				text = selected.map((v) => field.options?.find((o) => o.value === v)?.label ?? v).join(', ');
			} else {
				text = val as string;
			}
			if (!text) continue;
			if (fields.length > 1 && field.label) {
				parts.push(`${field.label}: ${text}`);
			} else {
				parts.push(text);
			}
		}
		return parts.join('\n');
	}

	function selectInstant(option: ReplyOption) {
		if (submitted) return;
		submitted = true;
		onsubmit(option.label);
	}

	function handleSubmit() {
		if (submitted) return;
		const answer = formatAnswer();
		if (!answer.trim()) return;
		submitted = true;
		onsubmit(answer);
	}

	function toggleMultiple(key: string, value: string) {
		const arr = answers[key] as string[];
		const idx = arr.indexOf(value);
		answers[key] = idx === -1 ? [...arr, value] : arr.filter((v) => v !== value);
	}
</script>

<div class="reply" class:submitted>
	{#if title}
		<p class="title">{title}</p>
	{/if}

	{#each fields as field}
		<div class="field">
			{#if field.label && !isInstantSingle}
				<span class="field-label">{field.label}</span>
			{/if}

			{#if field.type === 'single'}
				<div class="chips">
					{#each field.options ?? [] as option}
						{@const isSelected = answers[field.key] === option.value}
						<button
							type="button"
							class="chip"
							class:selected={isSelected}
							disabled={submitted}
							onclick={() => {
								if (isInstantSingle) {
									selectInstant(option);
								} else {
									answers[field.key] = option.value;
								}
							}}
						>
							{option.label}
							{#if isSelected && !isInstantSingle}
								<Check size={13} class="chip-check" />
							{/if}
						</button>
					{/each}
				</div>
			{:else if field.type === 'multiple'}
				<div class="checkboxes">
					{#each field.options ?? [] as option}
						{@const checked = (answers[field.key] as string[]).includes(option.value)}
						<label class="checkbox-label" class:disabled={submitted}>
							<input
								type="checkbox"
								{checked}
								disabled={submitted}
								onchange={() => toggleMultiple(field.key, option.value)}
							/>
							<span>{option.label}</span>
						</label>
					{/each}
				</div>
			{:else if field.type === 'datetime'}
				<input
					type="datetime-local"
					class="text-input"
					bind:value={answers[field.key] as string}
					disabled={submitted}
				/>
			{:else if field.type === 'number'}
				<input
					type="number"
					class="text-input"
					bind:value={answers[field.key] as string}
					placeholder={field.placeholder ?? ''}
					disabled={submitted}
				/>
			{:else if field.type === 'textarea'}
				<textarea
					class="text-input textarea-input"
					bind:value={answers[field.key] as string}
					placeholder={field.placeholder ?? ''}
					disabled={submitted}
					rows={4}
				></textarea>
			{:else}
				<input
					type="text"
					class="text-input"
					bind:value={answers[field.key] as string}
					placeholder={field.placeholder ?? ''}
					disabled={submitted}
				/>
			{/if}
		</div>
	{/each}

	{#if !isInstantSingle}
		<button
			type="button"
			class="submit-btn"
			disabled={submitted}
			onclick={handleSubmit}
		>
			{submitLabel}
		</button>
	{/if}
</div>

<style lang="scss">
	.reply {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 420px;
	}

	.title {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	/* ---- single: chips ---- */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 14px;
		border: 1px solid var(--color-border);
		border-radius: 20px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, color 0.15s;

		&:hover:not(:disabled) {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
		}

		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
			color: var(--color-primary);
		}

		&:disabled {
			cursor: default;
		}

		.submitted &:not(.selected) {
			opacity: 0.4;
		}
	}

	:global(.chip-check) {
		color: var(--color-primary);
	}

	/* ---- multiple: checkboxes ---- */
	.checkboxes {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9rem;
		cursor: pointer;
		color: var(--color-text);

		input[type='checkbox'] {
			width: 15px;
			height: 15px;
			flex-shrink: 0;
			accent-color: var(--color-primary);
			cursor: pointer;
		}

		&.disabled {
			cursor: default;
			opacity: 0.6;
		}
	}

	/* ---- text / number input ---- */
	.textarea-input {
		max-width: 400px;
		resize: vertical;
		min-height: 80px;
	}

	.text-input {
		width: 100%;
		max-width: 280px;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.9rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;

		&:focus {
			border-color: var(--color-primary);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		&::placeholder {
			color: var(--color-text-muted);
		}
	}

	/* ---- submit button ---- */
	.submit-btn {
		align-self: flex-start;
		padding: 8px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s, transform 0.15s;

		&:hover:not(:disabled) {
			opacity: 0.88;
		}

		&:active:not(:disabled) {
			transform: scale(0.97);
		}

		&:disabled {
			opacity: 0.35;
			cursor: not-allowed;
		}
	}
</style>
