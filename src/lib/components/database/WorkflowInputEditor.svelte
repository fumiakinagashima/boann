<script lang="ts">
	import X from '$lib/components/icon/X.svelte';
	import Plus from '$lib/components/icon/Plus.svelte';
	import type { CustomFieldType, EditableField } from '$lib/server/db/table-service';

	type LocalField = EditableField & { _id: string };

	type Props = {
		fields?: LocalField[];
	};

	// Workflow input parameters would need a separate mechanism for resolving target tables,
	// so recordSelect/account are out of scope for now (can be added here later to extend this).
	// tel/textarea only ever resolve to z.string() like text does in fieldToZod (field-schema.ts),
	// and input parameters have no dedicated UI for them (just prompt() collection), so there's
	// no meaningful distinction and they're left out.
	const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
		{ value: 'text', label: 'Text' },
		{ value: 'number', label: 'Number' },
		{ value: 'select', label: 'Select' },
		{ value: 'date', label: 'Date' },
		{ value: 'email', label: 'Email' }
	];

	let { fields = $bindable([]) }: Props = $props();

	function addField() {
		fields = [...fields, {
			_id: crypto.randomUUID(),
			key: '',
			label: '',
			type: 'text',
			// Input parameters are generally expected to be required, so default to required
			required: true,
			options: []
		}];
	}

	function removeField(id: string) {
		fields = fields.filter(f => f._id !== id);
	}

	function updateField(id: string, patch: Partial<EditableField>) {
		fields = fields.map(f => f._id === id ? { ...f, ...patch } : f);
	}

	function parseOptions(raw: string): { label: string; value: string }[] {
		return raw.split('\n')
			.map(line => line.trim())
			.filter(Boolean)
			.map(line => {
				const [label, value] = line.split(':').map(s => s.trim());
				return { label, value: value ?? label };
			});
	}

	function formatOptions(options: { label: string; value: string }[] | undefined): string {
		return (options ?? []).map(o => o.label === o.value ? o.label : `${o.label}:${o.value}`).join('\n');
	}
</script>

<div class="editor">
	{#if fields.length > 0}
		<div class="field-list">
			{#each fields as field (field._id)}
				<div class="field-row">
					<div class="field-main">
						<input
							class="input-key"
							type="text"
							placeholder="key (alphanumeric)"
							value={field.key}
							oninput={(e) => updateField(field._id, { key: (e.target as HTMLInputElement).value })}
						/>
						<input
							class="input-label"
							type="text"
							placeholder="Display name"
							value={field.label}
							oninput={(e) => updateField(field._id, { label: (e.target as HTMLInputElement).value })}
						/>
						<select
							value={field.type}
							onchange={(e) => updateField(field._id, { type: (e.target as HTMLSelectElement).value as CustomFieldType })}
						>
							{#each FIELD_TYPES as t}
								<option value={t.value}>{t.label}</option>
							{/each}
						</select>
						<label class="req-label" for="req-{field._id}">
							<input
								id="req-{field._id}"
								type="checkbox"
								checked={!field.required}
								onchange={(e) => updateField(field._id, { required: !(e.target as HTMLInputElement).checked })}
							/>
							Allow unset
						</label>
						<button type="button" class="remove-btn" onclick={() => removeField(field._id)} aria-label="Remove field">
							<X size={14} />
						</button>
					</div>
					<div class="options-row">
						<label class="options-label" for="desc-{field._id}">Additional notes (optional)</label>
						<input
							id="desc-{field._id}"
							type="text"
							placeholder="Describe this field's purpose or expected values"
							value={field.description ?? ''}
							oninput={(e) => updateField(field._id, { description: (e.target as HTMLInputElement).value })}
						/>
					</div>
					{#if field.type === 'select'}
						<div class="options-row">
							<label class="options-label" for="opts-{field._id}">Options (one per line, "label:value" or just "label")</label>
							<textarea
								id="opts-{field._id}"
								class="options-input"
								rows="3"
								value={formatOptions(field.options)}
								oninput={(e) => updateField(field._id, { options: parseOptions((e.target as HTMLTextAreaElement).value) })}
							></textarea>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty">No fields.</p>
	{/if}

	<button type="button" class="add-btn" onclick={addField}>
		<Plus size={14} />
		Add field
	</button>
</div>

<style lang="scss">
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.field-list {
		display: flex;
		flex-direction: column;
	}

	.field-row {
		border-bottom: 1px solid var(--color-border);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--color-background);
	}

	.field-main {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.input-key {
		width: 140px;
		flex-shrink: 0;
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
	}

	.input-label { flex: 1; }

	input[type="text"],
	select,
	textarea {
		padding: 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;

		&:focus { border-color: var(--color-primary); }
	}

	select { padding: 6px 8px; min-width: 120px; }

	.req-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		cursor: pointer;
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		border-radius: 4px;
		flex-shrink: 0;
		transition: color 0.15s, background 0.15s;

		&:hover {
			color: var(--color-danger, var(--color-error));
			background: color-mix(in srgb, var(--color-danger, var(--color-error)) 10%, transparent);
		}
	}

	.options-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-left: 148px;
	}

	.options-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.options-input {
		resize: vertical;
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
	}

	.empty {
		padding: 16px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 12px;
		background: var(--color-surface);
		border: none;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		width: 100%;
		text-align: left;

		&:hover {
			background: var(--color-border);
			color: var(--color-text);
		}
	}
</style>
