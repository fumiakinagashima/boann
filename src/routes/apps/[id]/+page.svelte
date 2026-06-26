<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createAppBuilderState, type AppTab } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon, { ICON_OPTIONS } from '$lib/components/AppIcon.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createAppBuilderState(() => data);
</script>

<div class="builder-layout" style="grid-template-columns: 1fr 5px {s.chatWidth}px" class:resizing={s.resizing}>
	<!-- Left panel: builder -->
	<div class="builder-panel">
		<div class="panel-header">
			<div class="header-top">
				<a href="/" class="back-link"><ChevronLeft size={15} />アプリ一覧</a>
				<div class="header-actions">
					{#if s.saved}<span class="saved-msg">✓ 保存しました</span>{/if}
					<button class="btn-danger-ghost" onclick={s.deleteApp} disabled={s.deleting}>削除</button>
					<button class="btn-save" onclick={s.save} disabled={s.saving || !s.dirty}>
						{s.saving ? '保存中…' : '保存'}
					</button>
				</div>
			</div>
			<div class="app-meta-edit">
				<div class="icon-grid">
					{#each ICON_OPTIONS as opt (opt.name)}
						<button
							type="button"
							class="icon-opt"
							class:selected={s.appIcon === opt.name}
							onclick={() => { s.appIcon = opt.name; s.markDirty(); }}
							title={opt.name}
						><AppIcon icon={opt.name} size={15} /></button>
					{/each}
				</div>
				<div class="app-name-row">
					<input
						class="app-name-input"
						type="text"
						bind:value={s.appLabel}
						oninput={s.markDirty}
						placeholder="アプリ名"
					/>
				</div>
			</div>
		</div>

		<div class="panel-body">
			<!-- Spec editor -->
			<section class="spec-section">
				<h2 class="section-label">仕様書</h2>
				<textarea
					class="spec-textarea"
					bind:value={s.spec}
					oninput={s.markDirty}
					placeholder="アプリの仕様をここに記述してください。AIが設計をサポートします。&#10;&#10;例:&#10;## 顧客商談管理&#10;&#10;### データ&#10;- 顧客マスタ（会社名, 担当者, 業種）&#10;- 商談（顧客, ステータス, 金額）&#10;- 活動履歴（商談, 種別, 日時, 内容）&#10;&#10;### ページ&#10;- 商談ボード（カンバン, ステータス別）"
				></textarea>
				<button class="btn-generate" onclick={s.generateFromSpec} disabled={!s.spec.trim() || s.saving}>
					✨ AIに設計・作成してもらう
				</button>
			</section>

			<!-- Tab bar -->
			<div class="tab-bar" role="tablist">
				{#each [['tables', 'テーブル'], ['pages', 'ページ'], ['workflows', 'ワークフロー']] as [tabId, label] (tabId)}
					<button
						class="tab-btn"
						class:active={s.activeTab === tabId}
						role="tab"
						aria-selected={s.activeTab === tabId}
						onclick={() => s.setActiveTab(tabId as AppTab)}
					>{label}</button>
				{/each}
			</div>

			<!-- Tab: Tables -->
			{#if s.activeTab === 'tables'}
				<div class="tab-content">
					{#each data.tables as table (table.id)}
						<div class="item-row">
							<p class="item-label">{table.label}</p>
							<div class="item-footer">
							<a
								href="/apps/{data.app.id}/tables/{table.id}/build"
								class="item-action"
							>テーブル設定</a>
							<a
								class="item-action"
								href={`/apps/${data.app.id}/tables/${table.id}`}
							>データ管理</a>
							</div>
						</div>
					{/each}
					<button class="btn-add-table" onclick={s.addTable} disabled={s.addingTable}>
						{s.addingTable ? '作成中…' : '+ テーブルを追加'}
					</button>
				</div>

			<!-- Tab: Pages -->
			{:else if s.activeTab === 'pages'}
				<div class="tab-content">
					{#each data.pages as pg (pg.id)}
						<div class="item-row">
							<p class="item-label">{pg.label}</p>
							<div class="item-footer">
							<a
								href="/apps/{data.app.id}/pages/{pg.id}/build"
								class="item-action"
							>ページ設定</a>
							<a
								class="item-action"
								href={`/apps/${data.app.id}/pages/${pg.id}`}
							>ページ表示</a>
							</div>
						</div>
					{/each}
					<button class="btn-add-table" onclick={s.addPage} disabled={s.addingPage}>
						{s.addingPage ? '作成中…' : '+ ページを追加'}
					</button>
				</div>

			<!-- Tab: Workflows -->
			{:else if s.activeTab === 'workflows'}
				<div class="tab-content">
					{#each data.workflows as wf (wf.id)}
						<div class="item-row">
							<p class="item-label">{wf.name}</p>
							<div class="item-footer">
								<a
									href="/apps/{data.app.id}/workflows/{wf.id}/build"
									class="item-action"
								>ワークフロー設定</a>
							</div>
						</div>
					{/each}
					<button class="btn-add-table" onclick={s.addWorkflow} disabled={s.addingWorkflow}>
						{s.addingWorkflow ? '作成中…' : '+ ワークフローを追加'}
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Resize handle -->
	<div
		class="resizer"
		onmousedown={s.onResizerMouseDown}
		role="separator"
		aria-label="パネル幅を調整"
		aria-orientation="vertical"
	></div>

	<!-- Right panel: AI chat -->
	<div class="chat-col">
		<div class="chat-col-header"><span>✨</span>AIアシスタント</div>
		<ChatPanel
			placeholder="仕様の相談・テーブル追加・修正の指示を入力…"
			onAction={() => invalidateAll()}
			context={s.chatContext}
			triggerMessage={s.aiTrigger}
			onTriggerConsumed={s.clearTrigger}
		/>
	</div>
</div>

<style lang="scss">
	.builder-layout {
		display: grid;
		height: 100%;
		overflow: hidden;

		&.resizing {
			cursor: col-resize;
			user-select: none;
		}
	}

	.resizer {
		width: 5px;
		cursor: col-resize;
		background: var(--color-border);
		transition: background 0.15s;
		position: relative;

		&::after { content: ''; position: absolute; inset: 0 -2px; }
		&:hover { background: var(--color-primary); }
	}

	/* ── Left panel ─────────────────────────────────────────── */
	.builder-panel {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-header {
		padding: 16px 24px 12px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.app-meta-edit {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.icon-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.icon-opt {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-background);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.12s, color 0.12s, background 0.12s;
		&:hover { border-color: var(--color-primary); color: var(--color-primary); }
		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 10%, transparent);
			color: var(--color-primary);
		}
	}

	.app-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.app-name-input {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: 7px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s;
		&:focus { border-color: var(--color-primary); }
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
		flex: 1;
		overflow-y: auto;
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ── Spec editor ─────────────────────────────────────────── */
	.section-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 8px;
	}

	.saved-msg {
		font-size: 0.8125rem;
		color: var(--color-success, #16a34a);
	}

	.btn-save {
		padding: 5px 14px;
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;

		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}

	.btn-danger-ghost {
		padding: 5px 12px;
		border-radius: 6px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover:not(:disabled) { border-color: var(--color-danger); color: var(--color-danger); }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.spec-textarea {
		width: 100%;
		min-height: 300px;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
		line-height: 1.7;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;

		&:focus { border-color: var(--color-primary); }
		&::placeholder { color: var(--color-text-muted); opacity: 0.5; }
	}

	.btn-generate {
		width: 100%;
		margin-top: 8px;
		padding: 9px 14px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s, border-color 0.15s;

		&:hover:not(:disabled) {
			background: color-mix(in srgb, var(--color-primary) 18%, transparent);
			border-color: var(--color-primary);
		}
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* ── Tabs ────────────────────────────────────────────────── */
	.tab-bar {
		display: flex;
		border-bottom: 1px solid var(--color-border);
		gap: 0;
		margin-bottom: -4px;
		flex-shrink: 0;
	}

	.tab-btn {
		padding: 8px 16px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;

		&:hover { color: var(--color-text); }
		&.active {
			color: var(--color-primary);
			border-bottom-color: var(--color-primary);
		}
	}

	/* ── Tab content rows ────────────────────────────────────── */
	.tab-content {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
		padding-top: 12px;
	}

	.item-row {
		gap: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--color-text);
		text-align: left;
		width: 100%;

	}
	
	.item-label { flex: 1; font-weight: 600; }
	.item-footer {
		display: flex;
		gap: 16px;
		margin-top: 4px;
		& .item-action {
			font-size: 0.8125rem;
			color: var(--color-primary);
			text-decoration: none;
			font-weight: 600;
			&:hover {
				opacity: 0.9;
				text-decoration: underline;
			}
		}
	}
	.empty-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 8px 2px;
		margin: 0;
	}

	.btn-add-table {
		margin-top: 4px;
		padding: 8px 14px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		border: 1px dashed var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		width: 100%;
		font-family: inherit;
		transition: border-color 0.15s, color 0.15s;

		&:hover { border-color: var(--color-primary); color: var(--color-primary); }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}


	/* ── Right chat column ───────────────────────────────────── */
	.chat-col {
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	.chat-col-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}
</style>
