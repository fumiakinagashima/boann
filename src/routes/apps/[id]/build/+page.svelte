<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── App meta ──────────────────────────────────────────────
	let appLabel = $state(data.app.label);
	let appIcon = $state(data.app.icon ?? '📋');
	let savingMeta = $state(false);
	let metaSaved = $state(false);

	async function saveMeta() {
		savingMeta = true;
		try {
			await fetch(`/api/database/tables/${data.app.name}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: appLabel, icon: appIcon })
			});
			await invalidateAll();
			metaSaved = true;
			setTimeout(() => (metaSaved = false), 2000);
		} finally {
			savingMeta = false;
		}
	}

	let deletingApp = $state(false);
	async function deleteApp() {
		if (!confirm(`アプリ「${data.app.label}」を削除しますか？\n全てのレコードも削除されます。`)) return;
		deletingApp = true;
		const res = await fetch(`/api/database/tables/${data.app.name}`, { method: 'DELETE' });
		if (res.ok || res.status === 204) {
			await invalidateAll();
			goto('/');
		}
		deletingApp = false;
	}

	const ICON_OPTIONS = ['📋', '📊', '👥', '🏢', '📦', '💼', '🛒', '📅', '🎯', '⚙️', '📝', '🔧'];

	// ── Fields ────────────────────────────────────────────────
	type SelectOption = { label: string; value: string };

	type FieldRow = {
		_id: string;
		label: string;
		key: string;
		type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'email' | 'tel';
		required: boolean;
		defaultValue: string;
		description: string;
		options: SelectOption[];
	};

	const FIELD_TYPES = [
		{ value: 'text',     label: 'テキスト' },
		{ value: 'textarea', label: '長文テキスト' },
		{ value: 'number',   label: '数値' },
		{ value: 'date',     label: '日付' },
		{ value: 'select',   label: '選択肢' },
		{ value: 'email',    label: 'メールアドレス' },
		{ value: 'tel',      label: '電話番号' },
	] as const;

	function slugify(s: string): string {
		return s.toLowerCase()
			.replace(/[\s　]+/g, '_')
			.replace(/[^a-z0-9_]/g, '')
			.replace(/^_+|_+$/g, '');
	}

	function fromServerFields(): FieldRow[] {
		return data.fields.map((f) => ({
			_id: crypto.randomUUID(),
			label: f.label,
			key: f.key,
			type: f.type as FieldRow['type'],
			required: f.required ?? false,
			defaultValue: f.defaultValue ?? '',
			description: f.description ?? '',
			options: (f.options as SelectOption[]) ?? [],
		}));
	}

	let rows = $state<FieldRow[]>(fromServerFields());
	let dirty = $state(false);
	let saving = $state(false);
	let saveError = $state('');
	let expandedId = $state<string | null>(null);

	// Sync from server when AI changes fields
	$effect(() => {
		const serverKeys = data.fields.map((f) => f.key).join(',');
		const localKeys = rows.map((r) => r.key).join(',');
		if (serverKeys !== localKeys) {
			rows = fromServerFields();
			dirty = false;
		}
	});

	function addField() {
		const newRow: FieldRow = {
			_id: crypto.randomUUID(), label: '', key: '', type: 'text',
			required: false, defaultValue: '', description: '', options: []
		};
		rows = [...rows, newRow];
		expandedId = newRow._id;
		dirty = true;
		tick().then(() => {
			document.querySelector<HTMLInputElement>(`#label-${newRow._id}`)?.focus();
		});
	}

	function removeField(id: string) {
		rows = rows.filter((r) => r._id !== id);
		if (expandedId === id) expandedId = null;
		dirty = true;
	}

	function onLabelInput(row: FieldRow, val: string) {
		row.label = val;
		row.key = slugify(val) || row.key;
		dirty = true;
	}

	function markDirty() { dirty = true; }

	// ── Select options ────────────────────────────────────────
	function addOption(row: FieldRow) {
		row.options = [...row.options, { label: '', value: '' }];
		dirty = true;
	}

	function onOptionLabelInput(row: FieldRow, idx: number, val: string) {
		const prevSlug = slugify(row.options[idx].label);
		row.options[idx].label = val;
		if (!row.options[idx].value || row.options[idx].value === prevSlug) {
			row.options[idx].value = slugify(val) || val;
		}
		dirty = true;
	}

	function onOptionValueInput(row: FieldRow, idx: number, val: string) {
		row.options[idx].value = val;
		dirty = true;
	}

	function removeOption(row: FieldRow, idx: number) {
		row.options = row.options.filter((_, i) => i !== idx);
		dirty = true;
	}

	// ── Save ──────────────────────────────────────────────────
	async function saveFields() {
		const validRows = rows.filter((r) => r.label.trim() && r.key.trim());
		saving = true;
		saveError = '';
		try {
			const res = await fetch(`/api/database/tables/${data.app.name}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fields: validRows.map((r, i) => ({
						_id: r._id,
						key: r.key,
						label: r.label.trim(),
						type: r.type,
						required: r.required,
						options: r.options.filter(o => o.label.trim()),
						defaultValue: r.defaultValue || null,
						description: r.description || null,
						sortOrder: i
					}))
				})
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				saveError = body.error ?? '保存に失敗しました';
				return;
			}
			dirty = false;
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	function typeLabel(type: string) {
		return FIELD_TYPES.find(t => t.value === type)?.label ?? type;
	}
</script>

<div class="build-layout">
	<!-- Left panel -->
	<div class="settings-panel">
		<div class="panel-header">
			<a href="/apps/{data.app.id}" class="back-link">
				<ChevronLeft size={15} />
				{data.app.label}
			</a>
		</div>

		<div class="panel-body">
			<!-- App meta -->
			<section>
				<h2 class="section-title">アプリ情報</h2>
				<div class="meta-row">
					<div class="meta-icon-picker">
						{#each ICON_OPTIONS as icon}
							<button class="icon-opt" class:selected={appIcon === icon} onclick={() => (appIcon = icon)}>{icon}</button>
						{/each}
					</div>
					<div class="meta-label-wrap">
						<input
							type="text"
							class="meta-label-input"
							bind:value={appLabel}
							placeholder="アプリ名"
						/>
						<span class="meta-name-hint">{data.app.name}</span>
					</div>
					<div class="meta-actions">
						<button class="btn-save-meta" onclick={saveMeta} disabled={savingMeta || !appLabel.trim()}>
							{savingMeta ? '…' : '保存'}
						</button>
						{#if metaSaved}<span class="saved-msg">✓</span>{/if}
						<button class="btn-danger-sm" onclick={deleteApp} disabled={deletingApp} title="アプリを削除">
							削除
						</button>
					</div>
				</div>
			</section>

			<!-- Fields -->
			<section>
				<div class="fields-header">
					<h2 class="section-title">フィールド</h2>
					{#if dirty}
						<div class="dirty-actions">
							{#if saveError}<span class="save-error">{saveError}</span>{/if}
							<button class="btn-save-fields" onclick={saveFields} disabled={saving}>
								{saving ? '保存中…' : '変更を保存'}
							</button>
						</div>
					{/if}
				</div>

				<div class="field-list">
					{#each rows as row, i (row._id)}
						{@const isOpen = expandedId === row._id}
						<div class="field-card" class:is-open={isOpen}>
							<!-- Card header (always visible) -->
							<button
								class="field-card-header"
								onclick={() => { expandedId = isOpen ? null : row._id; }}
								aria-expanded={isOpen}
							>
								<span class="field-no">{i + 1}</span>
								<span class="field-card-label" class:placeholder={!row.label}>
									{row.label || 'フィールド名未入力'}
								</span>
								<span class="field-type-badge">{typeLabel(row.type)}</span>
								{#if row.required}
									<span class="field-req-badge">必須</span>
								{/if}
								<span class="field-chevron" class:rotated={isOpen}>›</span>
							</button>

							<!-- Expanded form -->
							{#if isOpen}
								<div class="field-card-body">
									<div class="form-row">
										<label class="form-label" for="label-{row._id}">フィールド名 <span class="req-mark">*</span></label>
										<input
											id="label-{row._id}"
											type="text"
											class="form-input"
											value={row.label}
											placeholder="例: 担当者名、ステータス"
											oninput={(e) => onLabelInput(row, (e.currentTarget as HTMLInputElement).value)}
										/>
										{#if row.key}
											<p class="form-hint">識別キー: {row.key}</p>
										{/if}
									</div>

									<div class="form-row-2col">
										<div class="form-row">
											<label class="form-label" for="type-{row._id}">型</label>
											<select
												id="type-{row._id}"
												class="form-select"
												bind:value={row.type}
												onchange={markDirty}
											>
												{#each FIELD_TYPES as t}
													<option value={t.value}>{t.label}</option>
												{/each}
											</select>
										</div>
										<div class="form-row form-row-check">
											<label class="form-label" for="req-{row._id}">必須</label>
											<label class="toggle-wrap">
												<input
													id="req-{row._id}"
													type="checkbox"
													bind:checked={row.required}
													onchange={markDirty}
												/>
												<span class="toggle"></span>
											</label>
										</div>
									</div>

									{#if row.type === 'select'}
										<div class="form-row">
											<label class="form-label">選択肢</label>
											<div class="options-list">
												{#if row.options.length > 0}
													<div class="options-head">
														<span>ラベル（表示名）</span>
														<span>値（内部キー）</span>
													</div>
												{/if}
												{#each row.options as opt, oi (oi)}
													<div class="option-item">
														<input
															class="form-input"
															type="text"
															value={opt.label}
															placeholder="例: 進行中"
															oninput={(e) => onOptionLabelInput(row, oi, (e.currentTarget as HTMLInputElement).value)}
														/>
														<input
															class="form-input opt-value-input"
															type="text"
															value={opt.value}
															placeholder="例: in_progress"
															oninput={(e) => onOptionValueInput(row, oi, (e.currentTarget as HTMLInputElement).value)}
														/>
														<button class="opt-del" onclick={() => removeOption(row, oi)} aria-label="削除">×</button>
													</div>
												{/each}
												<button class="opt-add-btn" onclick={() => addOption(row)}>
													+ 選択肢を追加
												</button>
											</div>
										</div>
									{/if}

									<div class="form-row">
										<label class="form-label" for="default-{row._id}">初期値</label>
										{#if row.type === 'select'}
											<select
												id="default-{row._id}"
												class="form-select"
												bind:value={row.defaultValue}
												onchange={markDirty}
											>
												<option value="">（なし）</option>
												{#each row.options.filter(o => o.value) as opt}
													<option value={opt.value}>{opt.label || opt.value}</option>
												{/each}
											</select>
										{:else}
											<input
												id="default-{row._id}"
												type="text"
												class="form-input"
												bind:value={row.defaultValue}
												placeholder="入力がない場合のデフォルト値"
												oninput={markDirty}
											/>
										{/if}
									</div>

									<div class="form-row">
										<label class="form-label" for="desc-{row._id}">備考</label>
										<textarea
											id="desc-{row._id}"
											class="form-textarea"
											bind:value={row.description}
											placeholder="このフィールドに関するメモや説明"
											rows="2"
											oninput={markDirty}
										></textarea>
									</div>

									<div class="field-card-footer">
										<button class="btn-remove-field" onclick={() => removeField(row._id)}>
											このフィールドを削除
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}

					<button class="add-field-btn" onclick={addField}>
						<span class="add-icon">+</span>
						フィールドを追加
					</button>
				</div>

				{#if rows.length === 0}
					<p class="empty-hint">AIに「フィールドを追加して」と話しかけるか、「フィールドを追加」から手動で追加できます。</p>
				{/if}
			</section>
		</div>
	</div>

	<!-- Right panel: AI chat -->
	<div class="chat-col">
		<div class="chat-col-header">
			<span>✨</span>
			AIアシスタント
		</div>
		<ChatPanel
			placeholder="フィールドを追加・変更する指示を入力…"
			onAction={() => invalidateAll()}
		/>
	</div>
</div>

<style lang="scss">
	.build-layout {
		display: grid;
		grid-template-columns: 1fr 340px;
		height: 100%;
		overflow: hidden;
	}

	.settings-panel {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.panel-header {
		padding: 16px 24px 0;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		&:hover { color: var(--color-text); }
	}

	.panel-body {
		padding: 20px 24px 40px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ── App meta ───────────────────────────── */
	.meta-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.meta-icon-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-opt {
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		background: var(--color-background);
		font-size: 0.875rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s;

		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
		}
	}

	.meta-label-wrap {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 120px;
	}

	.meta-label-input {
		padding: 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-weight: 600;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		&:focus { border-color: var(--color-primary); }
	}

	.meta-name-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-family: ui-monospace, monospace;
		padding-left: 2px;
	}

	.meta-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.btn-save-meta {
		padding: 5px 14px;
		border-radius: 6px;
		font-size: 0.8125rem;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.85; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.saved-msg {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.btn-danger-sm {
		padding: 5px 12px;
		border-radius: 6px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* ── Fields ─────────────────────────────── */
	.fields-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.dirty-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.save-error {
		font-size: 0.8125rem;
		color: var(--color-danger);
	}

	.btn-save-fields {
		padding: 5px 14px;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.85; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.field-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	/* ── Field card ─────────────────────────── */
	.field-card {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--color-surface);
		transition: border-color 0.15s;

		&.is-open {
			border-color: var(--color-primary);
		}
	}

	.field-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition: background 0.1s;

		&:hover {
			background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
		}
	}

	.field-no {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		width: 18px;
		text-align: right;
		flex-shrink: 0;
	}

	.field-card-label {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		&.placeholder {
			color: var(--color-text-muted);
			font-weight: 400;
			font-style: italic;
		}
	}

	.field-type-badge {
		font-size: 0.6875rem;
		padding: 2px 7px;
		border-radius: 4px;
		background: var(--color-border);
		color: var(--color-text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.field-req-badge {
		font-size: 0.6875rem;
		padding: 2px 6px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.field-chevron {
		font-size: 1rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
		transition: transform 0.15s;
		line-height: 1;

		&.rotated {
			transform: rotate(90deg);
		}
	}

	/* ── Field card body (form) ─────────────── */
	.field-card-body {
		padding: 16px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: var(--color-background);
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.form-row-2col {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 12px;
		align-items: start;
	}

	.form-row-check {
		flex-direction: row;
		align-items: center;
		gap: 10px;
		padding-top: 19px;
	}

	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.req-mark {
		color: var(--color-danger);
	}

	.form-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.form-input {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		width: 100%;
		box-sizing: border-box;

		&:focus { border-color: var(--color-primary); }
		&::placeholder { color: var(--color-text-muted); opacity: 0.6; }
	}

	.form-select {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		cursor: pointer;
		width: 100%;
		transition: border-color 0.15s;

		&:focus { border-color: var(--color-primary); }
	}

	.form-textarea {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		resize: vertical;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.15s;

		&:focus { border-color: var(--color-primary); }
		&::placeholder { color: var(--color-text-muted); opacity: 0.6; }
	}

	/* Toggle switch */
	.toggle-wrap {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		gap: 0;

		input[type="checkbox"] {
			position: absolute;
			opacity: 0;
			width: 0;
			height: 0;
		}
	}

	.toggle {
		display: inline-block;
		width: 36px;
		height: 20px;
		border-radius: 10px;
		background: var(--color-border);
		position: relative;
		transition: background 0.15s;
		flex-shrink: 0;

		&::after {
			content: '';
			position: absolute;
			top: 3px;
			left: 3px;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: #fff;
			transition: transform 0.15s;
		}
	}

	.toggle-wrap input:checked + .toggle {
		background: var(--color-primary);

		&::after {
			transform: translateX(16px);
		}
	}

	/* ── Select options ─────────────────────── */
	.options-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-primary) 2%, var(--color-surface));
	}

	.options-head {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 0 30px 0 0;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.option-item {
		display: grid;
		grid-template-columns: 1fr 1fr 24px;
		gap: 6px;
		align-items: center;
	}

	.opt-value-input {
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.opt-del {
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: color 0.1s, background 0.1s;

		&:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 8%, transparent); }
	}

	.opt-add-btn {
		align-self: flex-start;
		padding: 4px 10px;
		border: 1px dashed var(--color-border);
		border-radius: 5px;
		background: none;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.1s, color 0.1s;

		&:hover { border-color: var(--color-primary); color: var(--color-primary); }
	}

	.field-card-footer {
		padding-top: 4px;
		border-top: 1px solid var(--color-border);
		display: flex;
		justify-content: flex-end;
	}

	.btn-remove-field {
		font-size: 0.8125rem;
		padding: 4px 10px;
		border: none;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		border-radius: 5px;
		transition: color 0.1s, background 0.1s;

		&:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 6%, transparent); }
	}

	/* ── Add field button ───────────────────── */
	.add-field-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border: 1px dashed var(--color-border);
		border-radius: 8px;
		background: none;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
		}
	}

	.add-icon {
		font-size: 1.125rem;
		line-height: 1;
		color: var(--color-primary);
	}

	.empty-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
		margin: 0;
	}

	/* ── Chat col ───────────────────────────── */
	.chat-col {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.chat-col-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 16px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		border-left: 1px solid var(--color-border);
		background: var(--color-surface);
	}
</style>
