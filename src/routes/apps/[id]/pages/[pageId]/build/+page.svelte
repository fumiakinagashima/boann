<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createPageBuildState } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import BuilderLayout from '$lib/components/BuilderLayout.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createPageBuildState(() => data);

	function confirmDeletePage(e: SubmitEvent) {
		if (!confirm('このページを削除しますか？')) e.preventDefault();
	}

	const ACTION_LABELS: Record<string, string> = {
		detail: '詳細',
		create: '登録',
		edit: '編集',
		delete: '削除'
	};
	const ALL_ACTIONS = ['detail', 'create', 'edit', 'delete'] as const;
</script>

<BuilderLayout>
	{#snippet main()}
		<div class="build-page">
			<div class="panel-header">
				<a href="/apps/{data.app.id}" class="back-link"><ChevronLeft size={15} />{data.app.label}</a>
				<div class="meta-actions">
					<form method="POST" action="?/delete" onsubmit={confirmDeletePage} class="delete-form">
						<button type="submit" class="btn-danger-ghost">削除</button>
					</form>
					<a href="/apps/{data.app.id}/pages/{data.page.id}" class="btn-secondary">プレビュー</a>
					<button class="btn-primary" onclick={s.save} disabled={s.saving || !s.dirty}>
						{s.saving ? '保存中…' : '保存'}
					</button>
					{#if s.saved}<span class="saved-msg">✓ 保存しました</span>{/if}
				</div>
			</div>

			<div class="build-body">
				<!-- ── ページ名 ──────────────────────────────────────── -->
				<section class="section">
					<h2 class="section-title">ページ名</h2>
					<input
						class="label-input"
						type="text"
						value={s.pageLabel}
						oninput={(e) => (s.pageLabel = e.currentTarget.value)}
						placeholder="ページの表示名"
					/>
				</section>

				<!-- ── テーブル選択 ─────────────────────────────────── -->
				<section class="section">
					<h2 class="section-title">テーブル</h2>
					<p class="section-desc">このページで表示するテーブルを選択します。</p>
					{#if data.tables.length === 0}
						<p class="hint">このアプリにテーブルがありません。先にテーブルを作成してください。</p>
					{:else}
						<select
							class="field-select"
							value={s.tableId ?? ''}
							onchange={(e) => s.setTableId(e.currentTarget.value || null)}
						>
							<option value="">— 選択してください —</option>
							{#each data.tables as t}
								<option value={t.id}>{t.label}</option>
							{/each}
						</select>
					{/if}
				</section>

				{#if s.tableId}
					<!-- ── 表示フィールド ───────────────────────────── -->
					<section class="section">
						<h2 class="section-title">一覧に表示するフィールド</h2>
						<p class="section-desc">チェックを外すと一覧から非表示になります。</p>
						{#if s.tableFields.length === 0}
							<p class="hint">このテーブルにフィールドがありません。</p>
						{:else}
							<div class="check-grid">
								{#each s.tableFields as f}
									<label class="check-label">
										<input
											type="checkbox"
											checked={s.isFieldShown(f.key)}
											onchange={() => s.toggleField(f.key)}
										/>
										{f.label}
										<span class="type-tag">{f.type}</span>
									</label>
								{/each}
							</div>
							{#if !s.config.fields?.length}
								<p class="hint">全フィールドを表示中</p>
							{/if}
						{/if}
					</section>

					<!-- ── アクション ────────────────────────────────── -->
					<section class="section">
						<h2 class="section-title">使用するアクション</h2>
						<p class="section-desc">一覧・詳細で使える操作を選択します。</p>
						<div class="check-row">
							{#each ALL_ACTIONS as action}
								<label class="check-label">
									<input
										type="checkbox"
										checked={s.config.actions.includes(action)}
										onchange={() => s.toggleAction(action)}
									/>
									{ACTION_LABELS[action]}
								</label>
							{/each}
						</div>
					</section>

					<!-- ── 詳細画面: 関連データ ─────────────────────── -->
					{#if s.config.actions.includes('detail')}
						<section class="section">
							<h2 class="section-title">詳細画面の関連データ</h2>
							<p class="section-desc">
								このテーブルのレコードを参照している他のテーブルを、詳細画面に表示できます。
							</p>
							{#if data.referencingTables.length === 0}
								<p class="hint">このテーブルを参照しているテーブルはありません。</p>
							{:else}
								<div class="related-list">
									{#each data.referencingTables as rt}
										<div class="related-entry">
											<label class="check-label related-item">
												<input
													type="checkbox"
													checked={s.isRelatedTableEnabled(rt.tableId, rt.refFieldKey)}
													onchange={() => s.toggleRelatedTable(rt.tableId, rt.refFieldKey, rt.tableLabel)}
												/>
												<span class="related-name">{rt.tableLabel}</span>
												<span class="related-via">← {rt.refFieldLabel}</span>
											</label>
											{#if s.isRelatedTableEnabled(rt.tableId, rt.refFieldKey)}
												{@const rtFields = s.getRelatedTableFields(rt.tableId)}
												<div class="related-actions-row">
													{#each ALL_ACTIONS as action}
														<label class="check-label check-label-sm">
															<input
																type="checkbox"
																checked={s.isRelatedTableActionEnabled(rt.tableId, rt.refFieldKey, action)}
																onchange={() => s.toggleRelatedTableAction(rt.tableId, rt.refFieldKey, action)}
															/>
															{ACTION_LABELS[action]}
														</label>
													{/each}
												</div>
												{#if rtFields.length > 0}
													<div class="related-fields-row">
														<span class="related-fields-label">表示フィールド:</span>
														{#each rtFields as rf}
															<label class="check-label check-label-sm">
																<input
																	type="checkbox"
																	checked={s.isRelatedTableFieldShown(rt.tableId, rt.refFieldKey, rf.key)}
																	onchange={() => s.toggleRelatedTableField(rt.tableId, rt.refFieldKey, rf.key)}
																/>
																{rf.label}
															</label>
														{/each}
													</div>
												{/if}
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</section>
					{/if}
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet chat()}
		<ChatPanel
			placeholder="ページ構成の相談・指示を入力…"
			onAction={() => invalidateAll()}
			context={{
				appId: data.app.id,
				appLabel: data.app.label,
				appName: data.app.name,
				tables: data.tables.map((t) => ({ id: t.id, name: t.name, label: t.label }))
			}}
		/>
	{/snippet}
</BuilderLayout>

<style lang="scss">
.build-page {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────── */
.panel-header {
	padding: 16px 24px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	border-bottom: 1px solid var(--color-border);
	flex-shrink: 0;
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

.meta-actions {
	display: flex;
	align-items: center;
	gap: 8px;
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
	display: flex;
	flex-direction: column;
	gap: 28px;
}

/* ── Section ─────────────────────────────────────────────── */
.section {
	max-width: 640px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.section-title {
	font-size: 0.9375rem;
	font-weight: 600;
	color: var(--color-text);
	margin: 0;
}

.section-desc {
	font-size: 0.875rem;
	color: var(--color-text-muted);
	margin: 0;
}

.hint {
	font-size: 0.875rem;
	color: var(--color-text-muted);
	margin: 0;
}

/* ── Inputs ──────────────────────────────────────────────── */
.label-input {
	padding: 8px 12px;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	background: var(--color-background);
	color: var(--color-text);
	font-size: 0.9375rem;
	font-family: inherit;
	outline: none;
	width: 100%;
	box-sizing: border-box;
	&:focus { border-color: var(--color-primary); }
}

.field-select {
	padding: 8px 10px;
	border: 1px solid var(--color-border);
	border-radius: 6px;
	background: var(--color-background);
	color: var(--color-text);
	font-size: 0.875rem;
	font-family: inherit;
	outline: none;
	width: 100%;
	box-sizing: border-box;
	&:focus { border-color: var(--color-primary); }
}

/* ── Checkboxes ──────────────────────────────────────────── */
.check-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 8px;
}

.check-row {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
}

.check-label {
	display: flex;
	align-items: center;
	gap: 7px;
	font-size: 0.875rem;
	color: var(--color-text);
	cursor: pointer;
	user-select: none;
}

.type-tag {
	font-size: 0.7rem;
	color: var(--color-text-muted);
	background: var(--color-border);
	padding: 1px 5px;
	border-radius: 3px;
}

/* ── Related tables ──────────────────────────────────────── */
.related-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.related-entry {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.related-item { align-items: center; }

.related-name { font-weight: 500; }

.related-via {
	font-size: 0.8125rem;
	color: var(--color-text-muted);
}

.related-actions-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	padding-left: 22px;
}

.related-fields-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	padding-left: 22px;
}

.related-fields-label {
	font-size: 0.8125rem;
	color: var(--color-text-muted);
	white-space: nowrap;
}

.check-label-sm {
	font-size: 0.8125rem;
	color: var(--color-text-muted);
}

/* ── Buttons ─────────────────────────────────────────────── */
.btn-primary {
	padding: 6px 14px;
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
	padding: 6px 12px;
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

.delete-form { display: contents; }

.btn-danger-ghost {
	padding: 6px 12px;
	border-radius: 6px;
	font-size: 0.875rem;
	border: 1px solid var(--color-border);
	background: none;
	color: var(--color-text-muted);
	cursor: pointer;
	transition: border-color 0.15s, color 0.15s;
	&:hover:not(:disabled) { border-color: var(--color-error); color: var(--color-error); }
}
</style>
