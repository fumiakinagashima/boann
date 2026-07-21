<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createTableBuildState, FIELD_TYPES } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import GripVertical from '$lib/components/icon/GripVertical.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import BuilderLayout from '$lib/components/BuilderLayout.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const s = createTableBuildState(() => data);

	function confirmDeleteTable(e: SubmitEvent) {
		if (!confirm(`テーブル「${data.app.label}」を削除しますか？\n全てのレコードも削除されます。`)) {
			e.preventDefault();
		}
	}
</script>

<BuilderLayout>
	{#snippet main()}
		<div class="settings-panel">
		<div class="panel-header">
			<a href="/apps/{data.appId}" class="back-link">
				<ChevronLeft size={15} />
				アプリ設定
			</a>
			<div class="meta-actions">
				<form method="POST" action="?/delete" onsubmit={confirmDeleteTable} class="delete-form">
					<button type="submit" class="btn-danger-sm" title="テーブルを削除">削除</button>
				</form>
				{#if s.saveError}<span class="save-error">{s.saveError}</span>{/if}
				{#if s.saved}<span class="saved-msg">✓ 保存しました</span>{/if}
				<button class="btn-save" onclick={s.save} disabled={s.saving || !s.dirty || !s.appLabel.trim()}>
					{s.saving ? '保存中…' : '保存'}
				</button>
			</div>
		</div>

		<div class="panel-body">
			<!-- App meta -->
			<section>
				<h2 class="section-title">テーブル情報</h2>
				<div class="meta-row">
					<div class="meta-label-wrap">
						<input
							type="text"
							class="meta-label-input"
							bind:value={s.appLabel}
							placeholder="テーブル名"
						/>
						<span class="meta-name-hint">{data.app.name}</span>
					</div>

				</div>
				{#if form?.message}<p class="delete-error">{form.message}</p>{/if}
			</section>

			<!-- MCP permissions -->
			<section>
				<h2 class="section-title">MCP公開設定</h2>
				<p class="section-hint">外部MCPエージェントに許可する操作を選択します。オフにした操作のツールは一覧・実行のいずれからも利用できなくなります。</p>
				<div class="mcp-toggle-list">
					<label class="mcp-toggle-row">
						<span>作成</span>
						<span class="toggle-wrap">
							<input type="checkbox" bind:checked={s.mcpCreate} />
							<span class="toggle"></span>
						</span>
					</label>
					<label class="mcp-toggle-row">
						<span>閲覧</span>
						<span class="toggle-wrap">
							<input type="checkbox" bind:checked={s.mcpRead} />
							<span class="toggle"></span>
						</span>
					</label>
					<label class="mcp-toggle-row">
						<span>更新</span>
						<span class="toggle-wrap">
							<input type="checkbox" bind:checked={s.mcpUpdate} />
							<span class="toggle"></span>
						</span>
					</label>
					<label class="mcp-toggle-row">
						<span>削除</span>
						<span class="toggle-wrap">
							<input type="checkbox" bind:checked={s.mcpDelete} />
							<span class="toggle"></span>
						</span>
					</label>
				</div>
			</section>

			<!-- Fields -->
			<section>
				<div class="fields-header">
					<h2 class="section-title">フィールド</h2>
				</div>

				<div class="field-list">
					{#each s.rows as row, i (row._id)}
						{@const isOpen = s.expandedId === row._id}
						<div
							class="field-card"
							class:is-open={isOpen}
							class:is-dragging={s.dragSrcId === row._id}
							class:drag-over={s.dragOverId === row._id}
							ondragover={(e) => s.onDragOver(e, row._id)}
							ondrop={(e) => s.onDrop(e, row._id)}
							ondragend={s.onDragEnd}
						>
							<!-- Card header (always visible) -->
							<div class="field-card-header">
								<span
									class="drag-handle"
									draggable="true"
									ondragstart={(e) => s.onDragStart(e, row._id)}
									aria-hidden="true"
								>
									<GripVertical size={14} />
								</span>
								<button
									class="field-card-header-btn"
									onclick={() => { s.expandedId = isOpen ? null : row._id; s.refTableQuery = ''; s.refTableDropdownOpen = false; }}
									aria-expanded={isOpen}
								>
								<span class="field-card-label" class:placeholder={!row.label}>
									{row.label || 'フィールド名未入力'}
								</span>
								<span class="field-type-badge">{s.typeLabel(row.type)}</span>
								{#if row.required}
									<span class="field-req-badge">必須</span>
								{/if}
								<span class="field-chevron" class:rotated={isOpen}>›</span>
								</button>
							</div>

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
											oninput={(e) => {
												const input = e.currentTarget as HTMLInputElement;
												if ((e as unknown as InputEvent).isComposing) {
													row.label = input.value;
													s.markDirty();
												} else {
													s.onLabelInput(row, input.value);
												}
											}}
											oncompositionend={(e) => s.onLabelInput(row, (e.currentTarget as HTMLInputElement).value)}
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
												onchange={s.markDirty}
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
													onchange={s.markDirty}
												/>
												<span class="toggle"></span>
											</label>
										</div>
									</div>

									{#if row.type === 'recordSelect'}
										<div class="form-row">
											<label class="form-label">参照先テーブル</label>
											<div class="combobox">
												<input
													type="text"
													class="form-input combobox-input"
													value={s.refTableDropdownOpen ? s.refTableQuery : s.refTableLabel(row.refTable)}
													placeholder="テーブルを検索…"
													autocomplete="off"
													onfocus={() => { s.refTableQuery = ''; s.refTableDropdownOpen = true; }}
													oninput={(e) => { s.refTableQuery = (e.currentTarget as HTMLInputElement).value; }}
													onblur={() => setTimeout(() => { s.refTableDropdownOpen = false; }, 150)}
												/>
												{#if s.refTableDropdownOpen}
													{@const filtered = data.otherApps.filter(a =>
														!s.refTableQuery ||
														a.label.toLowerCase().includes(s.refTableQuery.toLowerCase()) ||
														a.name.toLowerCase().includes(s.refTableQuery.toLowerCase())
													)}
													<div class="combobox-dropdown">
														{#if filtered.length === 0}
															<div class="combobox-empty">一致するテーブルがありません</div>
														{:else}
															{#each filtered as app}
																<button
																	type="button"
																	class="combobox-option"
																	class:selected={app.name === row.refTable}
																	onmousedown={() => { row.refTable = app.name; row.refLabelKey = ''; s.markDirty(); s.refTableDropdownOpen = false; s.refTableQuery = ''; }}
																>{app.label}</button>
															{/each}
														{/if}
													</div>
												{/if}
											</div>
											{#if row.refTable}
												<p class="form-hint">{row.refTable} のレコードIDを参照します</p>
											{/if}
										</div>

										{@const refApp = data.otherApps.find(a => a.name === row.refTable)}
										{#if refApp && refApp.fields.length > 0}
											<div class="form-row">
												<label class="form-label" for="reflabelkey-{row._id}">ラベルフィールド</label>
												<select
													id="reflabelkey-{row._id}"
													class="form-select"
													bind:value={row.refLabelKey}
													onchange={s.markDirty}
												>
													<option value="">（先頭フィールド）</option>
													{#each refApp.fields as f}
														<option value={f.key}>{f.label}</option>
													{/each}
												</select>
												<p class="form-hint">選択肢・一覧に表示するフィールド</p>
											</div>
										{/if}
									{/if}

									{#if row.type === 'account'}
										<div class="form-row">
											<p class="form-hint">アカウントを参照します。アカウントIDを保存し、選択肢・一覧では名前を表示します。</p>
										</div>
									{/if}

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
															oninput={(e) => s.onOptionLabelInput(row, oi, (e.currentTarget as HTMLInputElement).value)}
														/>
														<input
															class="form-input opt-value-input"
															type="text"
															value={opt.value}
															placeholder="例: in_progress"
															oninput={(e) => s.onOptionValueInput(row, oi, (e.currentTarget as HTMLInputElement).value)}
														/>
														<button class="opt-del" onclick={() => s.removeOption(row, oi)} aria-label="削除">×</button>
													</div>
												{/each}
												<button class="opt-add-btn" onclick={() => s.addOption(row)}>
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
												onchange={s.markDirty}
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
												oninput={s.markDirty}
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
											rows="4"
											oninput={s.markDirty}
										></textarea>
									</div>

									<div class="field-card-footer">
										<button class="btn-remove-field" onclick={() => s.removeField(row._id)}>
											このフィールドを削除
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}

					<button class="add-field-btn" onclick={s.addField}>
						<span class="add-icon">+</span>
						フィールドを追加
					</button>
				</div>

				{#if s.rows.length === 0}
					<p class="empty-hint">AIに「フィールドを追加して」と話しかけるか、「フィールドを追加」から手動で追加できます。</p>
				{/if}
			</section>
		</div>
	</div>
	{/snippet}

	{#snippet chat()}
		<ChatPanel
			placeholder="フィールドを追加・変更する指示を入力…"
			onAction={() => invalidateAll()}
			context={{
				appId: data.appId,
				appLabel: data.app.label,
				appName: data.app.name,
				tables: [{ id: data.app.id, name: data.app.name, label: data.app.label }]
			}}
		/>
	{/snippet}
</BuilderLayout>

<style lang="scss">
	.settings-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.panel-header {
		padding: 16px 24px 0;
		display: flex;
		justify-content: space-between;
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
		flex-direction: column;
		gap: 12px;
		flex-wrap: wrap;
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

	.btn-save {
		padding: 5px 14px;
		border-radius: 6px;
		font-size: 0.8125rem;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover:not(:disabled) { opacity: 0.85; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.saved-msg {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.save-error {
		font-size: 0.8125rem;
		color: var(--color-danger);
	}

	.delete-form { display: contents; }

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

	.delete-error {
		margin: 8px 0 0;
		font-size: 0.8125rem;
		color: var(--color-danger, var(--color-error));
	}

	/* ── MCP permissions ────────────────────── */
	.section-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: -6px 0 0;
		line-height: 1.5;
	}

	.mcp-toggle-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 4px 14px;
		background: var(--color-surface);
	}

	.mcp-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;

		& + & {
			border-top: 1px solid var(--color-border);
		}
	}

	/* ── Fields ─────────────────────────────── */
	.fields-header {
		display: flex;
		align-items: center;
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
		transition: border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
		cursor: grab;

		&:active { cursor: grabbing; }

		&.is-open {
			border-color: var(--color-primary);
		}

		&.is-dragging {
			opacity: 0.4;
		}

		&.drag-over {
			border-color: var(--color-primary);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
		}
	}

	.field-card-header {
		display: flex;
		align-items: center;
		width: 100%;
		transition: background 0.1s;

		&:hover {
			background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
		}
	}

	.drag-handle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px 4px 10px 10px;
		color: var(--color-text-muted);
		opacity: 0.3;
		cursor: grab;
		transition: opacity 0.1s;
		user-select: none;

		&:active { cursor: grabbing; }
		.field-card:hover & { opacity: 0.7; }
	}

	.field-card-header-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 10px 12px 10px 4px;
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
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
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
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
		font-size: 0.8125rem;
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
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	/* ── Relation combobox ──────────────────── */
	.combobox {
		position: relative;
	}

	.combobox-input {
		cursor: pointer;

		&:focus { cursor: text; }
	}

	.combobox-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		z-index: 100;
		max-height: 200px;
		overflow-y: auto;
		padding: 4px;
	}

	.combobox-option {
		display: block;
		width: 100%;
		padding: 7px 10px;
		border: none;
		background: none;
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		text-align: left;
		border-radius: 5px;
		cursor: pointer;
		transition: background 0.1s;

		&:hover { background: var(--color-background); }
		&.selected {
			background: color-mix(in srgb, var(--color-primary) 10%, transparent);
			color: var(--color-primary);
			font-weight: 500;
		}
	}

	.combobox-empty {
		padding: 10px 12px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
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

</style>
