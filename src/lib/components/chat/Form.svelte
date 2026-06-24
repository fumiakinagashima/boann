<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';
	import type { FormField } from '$lib/types/chat';
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		title?: string;
		fields: FormField[];
		submitLabel?: string;
		onsubmit: (data: Record<string, string>) => void;
		oncancel?: () => void;
		hideActions?: boolean;
		formRef?: HTMLFormElement | null;
		// ダイアログ内など、横幅いっぱいに広げたい場合に true（max-width を外す）
		fullWidth?: boolean;
	};

	let { title, fields, submitLabel, onsubmit, oncancel, hideActions = false, formRef = $bindable(null), fullWidth = false }: Props = $props();

	let values = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(fields.map((f) => [f.key, f.value ?? ''])))
	);

	let errors = $state<Record<string, string>>({});

	let recordOptions = $state<Record<string, { value: string; label: string }[]>>({});

	onMount(async () => {
		const refTables = [...new Set(
			fields.filter((f) => f.type === 'recordSelect' && f.refTable).map((f) => f.refTable!)
		)];
		for (const refTable of refTables) {
			const res = await fetch(`/api/database/${refTable}/records`);
			if (res.ok) {
				const data = (await res.json()) as { rows: Record<string, unknown>[] };
				recordOptions[refTable] = data.rows.map((r) => ({
					value: String(r.id),
					label: String(r.name ?? r.id)
				}));
			}
		}
	});

	function validate(): boolean {
		const newErrors: Record<string, string> = {};
		for (const field of fields) {
			if (field.type === 'hidden') continue;
			const val = (values[field.key] ?? '').trim();

			if (field.required) {
				if (field.type === 'multiselect') {
					if (val.split(',').filter(Boolean).length === 0) {
						newErrors[field.key] = m.form_error_select_required();
					}
				} else if (field.type === 'select' || field.type === 'recordSelect') {
					if (!val) newErrors[field.key] = m.form_error_select_required();
				} else {
					if (!val) newErrors[field.key] = m.form_error_required();
				}
			}

			if (!newErrors[field.key] && val) {
				if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
					newErrors[field.key] = m.form_error_email();
				}
				if (field.type === 'number' && isNaN(Number(val))) {
					newErrors[field.key] = m.form_error_number();
				}
			}
		}
		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function clearError(key: string) {
		if (errors[key]) {
			const { [key]: _, ...rest } = errors;
			errors = rest;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		onsubmit(values);
	}

	function toggleMultiselect(key: string, value: string, checked: boolean) {
		const current = (values[key] ?? '').split(',').filter(Boolean);
		if (checked) {
			if (!current.includes(value)) current.push(value);
		} else {
			const idx = current.indexOf(value);
			if (idx !== -1) current.splice(idx, 1);
		}
		values[key] = current.join(',');
		clearError(key);
	}
</script>

<form class="form" class:full-width={fullWidth} onsubmit={handleSubmit} bind:this={formRef}>
	{#if title}
		<p class="form-title">{title}</p>
	{/if}

	{#each fields as field}
		{#if field.type === 'hidden'}
			<input type="hidden" id={field.key} bind:value={values[field.key]} />
		{:else if field.type === 'recordSelect'}
			<SearchSelect
				label={field.label}
				required={field.required}
				error={errors[field.key]}
				bind:value={values[field.key]}
				options={recordOptions[field.refTable ?? ''] ?? []}
				onchange={() => clearError(field.key)}
			/>
		{:else if field.type === 'multiselect'}
			<fieldset class="field" class:has-error={!!errors[field.key]}>
				<legend>
					{field.label}
					{#if field.required}<span class="required">*</span>{/if}
				</legend>
				<div class="checkbox-group">
					{#each field.options ?? [] as opt}
						<label class="checkbox-option">
							<input
								type="checkbox"
								checked={(values[field.key] ?? '').split(',').filter(Boolean).includes(opt.value)}
								onchange={(e) => toggleMultiselect(field.key, opt.value, e.currentTarget.checked)}
							/>
							{opt.label}
						</label>
					{/each}
				</div>
				{#if errors[field.key]}<p class="error-msg">{errors[field.key]}</p>{/if}
			</fieldset>
		{:else}
		<div class="field" class:has-error={!!errors[field.key]}>
			<label for={field.key}>
				{field.label}
				{#if field.required}<span class="required">*</span>{/if}
			</label>

			{#if field.type === 'textarea'}
				<textarea
					id={field.key}
					class:large={field.key === 'body'}
					placeholder={field.placeholder ?? ''}
					bind:value={values[field.key]}
					oninput={() => clearError(field.key)}
				></textarea>
			{:else if field.type === 'select'}
				<select
					id={field.key}
					bind:value={values[field.key]}
					onchange={() => clearError(field.key)}
				>
					<option value="">{m.form_select_placeholder()}</option>
					{#each field.options ?? [] as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			{:else}
				<input
					id={field.key}
					type={field.type}
					placeholder={field.placeholder ?? ''}
					bind:value={values[field.key]}
					oninput={() => clearError(field.key)}
				/>
			{/if}
			{#if errors[field.key]}<p class="error-msg">{errors[field.key]}</p>{/if}
		</div>
		{/if}
	{/each}

	{#if !hideActions}
		<div class="form-actions">
			{#if oncancel}
				<button type="button" class="btn-cancel" onclick={oncancel}>{m.form_cancel()}</button>
			{/if}
			<button type="submit">{submitLabel ?? m.form_submit()}</button>
		</div>
	{/if}
</form>

<style lang="scss">
	.form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		width: 100%;
		max-width: 620px;

		&.full-width { max-width: none; }
	}

	.form-title {
		font-weight: 600;
		margin: 0 0 4px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	fieldset.field {
		border: none;
		padding: 0;
		margin: 0;
	}

	label,
	legend {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 0;
	}

	.required {
		color: var(--color-danger);
		margin-left: 2px;
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 6px;
		width: fit-content;
		font-size: 0.9375rem;
		padding: 2px 4px;
		color: var(--color-text);
		cursor: pointer;
	}
	.checkbox-option input[type='checkbox'] {
		width: auto;
		padding: 0;
	}

	input,
	textarea,
	select {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		outline: none;
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: var(--color-primary);
	}

	.has-error {
		input, textarea, select {
			border-color: var(--color-danger);
		}
	}

	.error-msg {
		font-size: 0.8125rem;
		color: var(--color-danger);
		margin: 0;
	}

	textarea {
		min-height: 80px;
		resize: vertical;
	}

	textarea.large {
		min-height: 240px;
	}

	.form-actions {
		align-self: flex-end;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	button[type='submit'] {
		padding: 8px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
		&:hover { opacity: 0.88; }
	}

	.btn-cancel {
		padding: 8px 20px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		cursor: pointer;
		&:hover { background: var(--color-background); }
	}
</style>
