<script lang="ts">
	import { createPageBuildState } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createPageBuildState(() => data);
</script>

<div class="build-page">
	<div class="build-header">
		<a href="/apps/{data.app.id}" class="back-link"><ChevronLeft size={15} />{data.app.label}</a>
		<div class="header-main">
			<div class="header-title">
				<input
					class="page-label-input"
					type="text"
					bind:value={s.pageLabel}
					oninput={s.markDirty}
					placeholder="ページ名"
				/>
				<span class="page-badge">ページ設定</span>
			</div>
			<div class="header-actions">
				{#if s.saved}<span class="saved-msg">✓ 保存しました</span>{/if}
				<button class="btn-danger-ghost" onclick={s.deletePage} disabled={s.deleting}>削除</button>
				<a href="/apps/{data.app.id}/pages/{data.page.id}" class="btn-secondary">プレビュー</a>
				<button class="btn-primary" onclick={s.save} disabled={s.saving || !s.dirty}>
					{s.saving ? '保存中…' : '保存'}
				</button>
			</div>
		</div>
	</div>

	<div class="build-body">
		<section class="section">
			<h2 class="section-title">コンポーネント</h2>
			<p class="section-desc">ページに表示するコンポーネントを追加・設定します。上から順に表示されます。</p>

			{#if s.components.length === 0}
				<div class="empty-comp">
					<p>コンポーネントがまだありません。</p>
				</div>
			{/if}

			{#each s.components as comp, i (comp.id)}
				{@const tableFields = s.getTableFields(comp.tableId)}
				<div class="comp-card" class:expanded={comp.expanded}>
					<div class="comp-card-header" role="button" tabindex="0"
						onclick={() => s.toggleExpand(comp.id)}
						onkeydown={(e) => { if (e.key === 'Enter') s.toggleExpand(comp.id); }}
					>
						<span class="comp-type-badge" class:form={comp.type === 'form'}>
							{comp.type === 'list' ? '一覧' : 'フォーム'}
						</span>
						<span class="comp-summary">
							<strong>{comp.title || s.getTableLabel(comp.tableId)}</strong>
							<span class="comp-meta">{s.getDisplaySummary(comp)}</span>
						</span>
						<div class="comp-card-actions" role="presentation" onclick={(e) => e.stopPropagation()}>
							<button class="icon-btn" onclick={() => s.moveUp(i)} disabled={i === 0} title="上へ">↑</button>
							<button class="icon-btn" onclick={() => s.moveDown(i)} disabled={i === s.components.length - 1} title="下へ">↓</button>
							<button class="icon-btn danger" onclick={() => s.removeComponent(comp.id)} title="削除">×</button>
						</div>
						<span class="expand-icon">{comp.expanded ? '▲' : '▼'}</span>
					</div>

					{#if comp.expanded}
						<div class="comp-card-body">
							<!-- Type -->
							<div class="field-group">
								<label class="field-label">種類</label>
								<div class="radio-group">
									<label class="radio-label">
										<input type="radio" name="type-{comp.id}" value="list"
											checked={comp.type === 'list'}
											onchange={() => s.updateComponent(comp.id, { type: 'list' })}
										/>
										一覧（テーブル表示・編集可）
									</label>
									<label class="radio-label">
										<input type="radio" name="type-{comp.id}" value="form"
											checked={comp.type === 'form'}
											onchange={() => s.updateComponent(comp.id, { type: 'form' })}
										/>
										フォーム（新規登録）
									</label>
								</div>
							</div>

							<!-- Table -->
							<div class="field-group">
								<label class="field-label" for="table-{comp.id}">テーブル</label>
								{#if data.tables.length === 0}
									<p class="field-hint">このアプリにテーブルがありません。</p>
								{:else}
									<select
										id="table-{comp.id}"
										class="field-select"
										value={comp.tableId}
										onchange={(e) => s.updateComponent(comp.id, { tableId: e.currentTarget.value, fields: null })}
									>
										{#each data.tables as t}
											<option value={t.id}>{t.label}</option>
										{/each}
									</select>
								{/if}
							</div>

							<!-- Title -->
							<div class="field-group">
								<label class="field-label" for="title-{comp.id}">タイトル（省略可）</label>
								<input
									id="title-{comp.id}"
									class="field-input"
									type="text"
									value={comp.title ?? ''}
									oninput={(e) => s.updateComponent(comp.id, { title: e.currentTarget.value || null })}
									placeholder="省略するとテーブル名を使用"
								/>
							</div>

							<!-- Fields -->
							{#if tableFields.length > 0}
								<div class="field-group">
									<label class="field-label">表示フィールド</label>
									<div class="check-grid">
										{#each tableFields as f}
											<label class="check-label">
												<input
													type="checkbox"
													checked={s.isFieldShown(comp, f.key)}
													onchange={() => s.toggleField(comp.id, f.key, tableFields)}
												/>
												{f.label}
												<span class="field-type-tag">{f.type}</span>
											</label>
										{/each}
									</div>
									{#if !comp.fields?.length}
										<p class="field-hint">全フィールドを表示中</p>
									{/if}
								</div>
							{/if}

							<!-- Actions -->
							<div class="field-group">
								<label class="field-label">使用可能なアクション</label>
								<div class="check-row">
									{#each [['create', '作成'], ['edit', '編集'], ['delete', '削除']] as [action, label]}
										<label class="check-label">
											<input
												type="checkbox"
												checked={(comp.actions ?? []).includes(action as 'create' | 'edit' | 'delete')}
												onchange={() => s.toggleAction(comp.id, action as 'create' | 'edit' | 'delete')}
											/>
											{label}
										</label>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<button class="btn-add" onclick={s.addComponent} disabled={data.tables.length === 0}>
				+ コンポーネントを追加
			</button>
		</section>

		<section class="section index-section">
			<h2 class="section-title">indexページ設定</h2>
			<p class="section-desc">アプリカードの「画面表示」ボタンから開くページを指定します。</p>
			<div class="index-row">
				<div class="index-status">
					{#if s.isIndexPage}
						<span class="index-badge active">このページがindexページです</span>
					{:else}
						<span class="index-badge">indexページ未設定</span>
					{/if}
				</div>
				<button
					class="btn-index"
					class:active={s.isIndexPage}
					onclick={s.setAsIndexPage}
					disabled={s.settingIndex}
				>
					{s.settingIndex ? '更新中…' : s.isIndexPage ? 'indexページを解除' : 'indexページに設定'}
				</button>
			</div>
		</section>
	</div>
</div>

<style lang="scss">
	.build-page {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── Header ──────────────────────────────────────────────── */
	.build-header {
		padding: 16px 32px 12px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
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

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.page-label-input {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		outline: none;
		padding: 2px 4px;
		font-family: inherit;
		transition: border-color 0.15s;
		&:focus { border-bottom-color: var(--color-primary); }
	}

	.page-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.saved-msg {
		font-size: 0.8125rem;
		color: var(--color-success, #16a34a);
	}

	/* ── Body ────────────────────────────────────────────────── */
	.build-body {
		flex: 1;
		overflow-y: auto;
		padding: 28px 32px;
	}

	.section {
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.section-desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0 0 4px;
	}

	.empty-comp {
		padding: 24px;
		border: 1px dashed var(--color-border);
		border-radius: 8px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* ── Component card ──────────────────────────────────────── */
	.comp-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-surface);
		overflow: hidden;
		transition: border-color 0.15s;

		&.expanded { border-color: var(--color-primary); }
	}

	.comp-card-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		cursor: pointer;
		user-select: none;

		&:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }
	}

	.comp-type-badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
		white-space: nowrap;
		flex-shrink: 0;

		&.form {
			background: color-mix(in srgb, #8b5cf6 12%, transparent);
			color: #7c3aed;
		}
	}

	.comp-summary {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;

		strong {
			font-size: 0.9375rem;
			color: var(--color-text);
		}
	}

	.comp-meta {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.comp-card-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.icon-btn {
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 5px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s, color 0.1s;

		&:hover:not(:disabled) { background: var(--color-border); color: var(--color-text); }
		&:disabled { opacity: 0.3; cursor: not-allowed; }
		&.danger:hover:not(:disabled) { color: var(--color-danger); }
	}

	.expand-icon {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.comp-card-body {
		padding: 16px 20px;
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* ── Field groups inside card ────────────────────────────── */
	.field-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.field-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.field-input, .field-select {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.15s;
		&:focus { border-color: var(--color-primary); }
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.check-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 6px;
	}

	.check-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.check-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.field-type-tag {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		background: var(--color-border);
		padding: 1px 5px;
		border-radius: 3px;
	}

	/* ── Add component button ────────────────────────────────── */
	.btn-add {
		padding: 10px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px dashed var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		width: 100%;
		font-family: inherit;
		transition: border-color 0.15s, color 0.15s;

		&:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* ── Index page section ──────────────────────────────────── */
	.index-section {
		margin-top: 8px;
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
	}

	.index-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.index-status {
		flex: 1;
	}

	.index-badge {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 0.8125rem;
		background: var(--color-border);
		color: var(--color-text-muted);

		&.active {
			background: color-mix(in srgb, var(--color-primary) 12%, transparent);
			color: var(--color-primary);
			font-weight: 600;
		}
	}

	.btn-index {
		padding: 7px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
		transition: border-color 0.15s, color 0.15s, background 0.15s;

		&:hover:not(:disabled) {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}

		&.active {
			border-color: var(--color-primary);
			color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, transparent);

			&:hover:not(:disabled) {
				background: color-mix(in srgb, var(--color-danger) 8%, transparent);
				border-color: var(--color-danger);
				color: var(--color-danger);
			}
		}

		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* ── Buttons ─────────────────────────────────────────────── */
	.btn-primary {
		padding: 7px 18px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover:not(:disabled) { opacity: 0.88; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.btn-secondary {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
		&:hover { background: var(--color-border); }
	}

	.btn-danger-ghost {
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}
</style>
