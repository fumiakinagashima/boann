<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { FieldDef } from '$lib/server/db/table-service';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';

	type Props = {
		fields: FieldDef[];
		initialValues?: Record<string, string>;
		onsubmit: (data: Record<string, string>) => void;
		submitting?: boolean;
	};

	let { fields, initialValues = {}, onsubmit, submitting = false }: Props = $props();

	let values = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(fields.map(f => [f.key, initialValues[f.key] ?? ''])))
	);

	let recordOptions = $state<Record<string, { value: string; label: string }[]>>({});

	onMount(async () => {
		const refFields = fields.filter(f => f.type === 'recordSelect' && f.refTable);
		const tableCache: Record<string, { info: { fields: { key: string }[] }; rows: Record<string, unknown>[] }> = {};
		for (const field of refFields) {
			const refTable = field.refTable!;
			if (!tableCache[refTable]) {
				const res = await fetch(`/api/database/${refTable}/records`);
				if (!res.ok) continue;
				tableCache[refTable] = await res.json() as { info: { fields: { key: string }[] }; rows: Record<string, unknown>[] };
			}
			const { info, rows } = tableCache[refTable];
			const labelKey = field.refLabelKey || info.fields[0]?.key || 'id';
			recordOptions[field.key] = rows.map(r => ({
				value: String(r.id),
				label: String(r[labelKey] ?? r.id)
			}));
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onsubmit({ ...values });
	}

	// フォーム選択肢（formOptions）に現在値が含まれない場合は options から補完して表示する
	// （例: 活動履歴「種類」のフォームでは選択不可だが、既存の「案件登録」レコードは編集時に表示できるようにする）
	function selectOptions(field: FieldDef): { label: string; value: string }[] {
		const opts = field.formOptions ?? field.options ?? [];
		const current = values[field.key];
		if (current && !opts.some(o => o.value === current)) {
			const fallback = field.options?.find(o => o.value === current);
			if (fallback) return [...opts, fallback];
		}
		return opts;
	}
</script>

<form class="form" onsubmit={handleSubmit}>
	{#each fields as field}
		<div class="field">
			{#if field.type === 'recordSelect'}
				<SearchSelect
					label={field.label}
					required={field.required}
					bind:value={values[field.key]}
					options={recordOptions[field.key] ?? []}
				/>
			{:else}
				<label for={field.key}>
					{field.label}
					{#if field.required}<span class="req">*</span>{/if}
				</label>

				{#if field.type === 'textarea'}
					<textarea
						id={field.key}
						required={field.required}
						bind:value={values[field.key]}
					></textarea>
				{:else if field.type === 'select'}
					<select id={field.key} required={field.required} bind:value={values[field.key]}>
						<option value="">選択してください</option>
						{#each selectOptions(field) as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				{:else}
					<input
						id={field.key}
						type={field.type}
						required={field.required}
						bind:value={values[field.key]}
					/>
				{/if}
			{/if}
		</div>
	{/each}

	<div class="footer">
		<button type="submit" disabled={submitting}>
			{submitting ? '保存中...' : '保存'}
		</button>
	</div>
</form>

<style lang="scss">
	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 560px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.req { color: var(--color-danger, var(--color-error)); margin-left: 2px; }

	input, textarea, select {
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
	}

	input:focus, textarea:focus, select:focus {
		border-color: var(--color-primary);
	}

	textarea { min-height: 100px; resize: vertical; }

	.footer {
		display: flex;
		justify-content: flex-end;
		padding-top: 8px;
	}

	button {
		padding: 8px 24px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	button:disabled { opacity: 0.5; cursor: not-allowed; }
	button:not(:disabled):hover { opacity: 0.88; }
</style>
