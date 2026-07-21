<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { createAppBuilderState } from './index.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon, { ICON_OPTIONS } from '$lib/components/AppIcon.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import BuilderLayout from '$lib/components/BuilderLayout.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = createAppBuilderState(() => data);

	// アプリ自体の名称・アイコン変更／削除は、作成者本人か管理者のみ許可する
	// （accountId が null の既存データは所有者不明の共有アプリとして誰でも操作可）。
	// テーブル・ページ・ワークフローの追加はこれとは別に全員に開放したまま。
	const canManageApp = $derived(
		!data.app.accountId || data.account?.permission === 'admin' || data.app.accountId === data.account?.id
	);
</script>

<BuilderLayout>
	{#snippet main()}
		<div class="panel-header">
			<div class="header-top">
				<a href="/" class="back-link"><ChevronLeft size={15} />アプリ一覧</a>
				{#if canManageApp}
					<div class="header-actions">
						{#if s.saved}<span class="saved-msg">✓ 保存しました</span>{/if}
						<button class="btn-danger-ghost" onclick={s.deleteApp} disabled={s.deleting}>削除</button>
						<button class="btn-save" onclick={s.save} disabled={s.saving || !s.dirty}>
							{s.saving ? '保存中…' : '保存'}
						</button>
					</div>
				{/if}
			</div>
			<div class="app-meta-edit">
				<div class="icon-grid">
					{#each ICON_OPTIONS as opt (opt.name)}
						<button
							type="button"
							class="icon-opt"
							class:selected={s.appIcon === opt.name}
							onclick={() => { s.appIcon = opt.name; s.markDirty(); }}
							disabled={!canManageApp}
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
						disabled={!canManageApp}
						placeholder="アプリ名"
					/>
				</div>
			</div>
		</div>

		<div class="panel-body">
			<!-- テーブル -->
			<section class="list-section">
				<h2 class="section-label">テーブル</h2>
				<div class="item-list">
					{#each s.tables as table (table.id)}
						<div
							class="item-row"
							class:drag-over={s.dragOverId === table.id}
							draggable="true"
							role="listitem"
							ondragstart={(e) => s.onDragStart('tables', table.id, e)}
							ondragover={(e) => s.onDragOver('tables', table.id, e)}
							ondrop={(e) => s.onDrop('tables', table.id, e)}
							ondragend={s.onDragEnd}
						>
							<div class="item-head">
								<span class="drag-handle" aria-hidden="true">⠿</span>
								<p class="item-label">{table.label}</p>
							</div>
							<div class="item-footer">
								<a href="/apps/{data.app.id}/tables/{table.id}/build" class="item-action">テーブル設定</a>
								<a href={`/apps/${data.app.id}/tables/${table.id}`} class="item-action">データ管理</a>
							</div>
						</div>
					{/each}
					<button class="btn-add-table" onclick={s.addTable} disabled={s.addingTable}>
						{s.addingTable ? '作成中…' : '+ テーブルを追加'}
					</button>
				</div>
			</section>

			<!-- ワークフロー -->
			<section class="list-section">
				<h2 class="section-label">ワークフロー</h2>
				<div class="item-list">
					{#each s.workflows as wf (wf.id)}
						<div
							class="item-row"
							class:drag-over={s.dragOverId === wf.id}
							draggable="true"
							role="listitem"
							ondragstart={(e) => s.onDragStart('workflows', wf.id, e)}
							ondragover={(e) => s.onDragOver('workflows', wf.id, e)}
							ondrop={(e) => s.onDrop('workflows', wf.id, e)}
							ondragend={s.onDragEnd}
						>
							<div class="item-head">
								<span class="drag-handle" aria-hidden="true">⠿</span>
								<p class="item-label">{wf.name}</p>
							</div>
							<div class="item-footer">
								<a href="/apps/{data.app.id}/workflows/{wf.id}/build" class="item-action">ワークフロー設定</a>
							</div>
						</div>
					{/each}
					<button class="btn-add-table" onclick={s.addWorkflow} disabled={s.addingWorkflow}>
						{s.addingWorkflow ? '作成中…' : '+ ワークフローを追加'}
					</button>
				</div>
			</section>

			<!-- トークン管理 -->
			<section class="list-section">
				<h2 class="section-label">トークン管理</h2>
				{#if s.issuedMcpToken}
					<div class="mcp-token-reveal">
						<p class="mcp-token-reveal-note">発行されたトークンです。閉じたら二度と表示されません。</p>
						<div class="mcp-token-reveal-row">
							<code class="mcp-token-value">{s.issuedMcpToken}</code>
							<button class="btn-secondary" onclick={s.copyMcpToken}>
								{s.mcpTokenCopied ? 'コピーしました' : 'コピーする'}
							</button>
						</div>
						<div class="mcp-panel-actions">
							<button class="btn-secondary" onclick={s.dismissIssuedMcpToken}>閉じる</button>
						</div>
					</div>
				{/if}
				<div class="mcp-panel">
					<div class="mcp-endpoint-row">
						<span class="mcp-label">エンドポイント</span>
						<code class="mcp-endpoint">/api/apps/{data.app.id}/mcp</code>
					</div>
					<div class="mcp-status-row">
						{#if s.mcpStatus.issued}
							<span class="mcp-label">トークン</span>
							<span class="mcp-token-prefix">{s.mcpStatus.tokenPrefix}</span>
							<span class="mcp-badge">有効</span>
						{:else}
							<span class="empty-hint">まだトークンが発行されていません</span>
						{/if}
					</div>
					<div class="mcp-panel-actions">
						{#if !s.mcpStatus.issued}
							<button class="btn-save" onclick={s.issueMcpToken} disabled={s.issuingMcpToken}>
								{s.issuingMcpToken ? '発行中…' : '発行する'}
							</button>
						{:else}
							<button class="btn-secondary" onclick={s.reissueMcpToken} disabled={s.issuingMcpToken}>
								再発行する
							</button>
							<button class="btn-danger-ghost" onclick={s.deleteMcpToken}>削除する</button>
						{/if}
					</div>
				</div>
			</section>
		</div>
	{/snippet}

	{#snippet chat()}
		<ChatPanel
			placeholder="テーブル追加・修正の指示を入力…"
			onAction={() => invalidateAll()}
			context={s.chatContext}
		/>
	{/snippet}
</BuilderLayout>

<style lang="scss">
	/* ── Left panel ─────────────────────────────────────────── */
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
		&:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
		&.selected {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 10%, transparent);
			color: var(--color-primary);
		}
		&:disabled { opacity: 0.5; cursor: not-allowed; }
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
		&:disabled { opacity: 0.6; cursor: not-allowed; }
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

	/* ── Section header ──────────────────────────────────────── */
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

	/* ── Section lists ───────────────────────────────────────── */
	.list-section {
		display: flex;
		flex-direction: column;
	}

	.item-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
		padding-top: 4px;
	}

	.item-row {
		box-sizing: border-box;
		height: 64px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 0 12px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--color-text);
		text-align: left;
		width: 100%;
		cursor: grab;
		transition: border-color 0.12s, box-shadow 0.12s;

		&:active { cursor: grabbing; }
		&.drag-over {
			border-color: var(--color-primary);
			box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
		}
	}

	.item-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.drag-handle {
		color: var(--color-text-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: grab;
		user-select: none;
	}

	.item-label { flex: 1; font-weight: 600; }
	.item-footer {
		display: flex;
		gap: 16px;
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

	/* ── トークン管理 ──────────────────────────────────────────── */
	.btn-secondary {
		padding: 5px 12px;
		border-radius: 6px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s;
		&:hover:not(:disabled) { background: var(--color-border); }
		&:disabled { opacity: 0.45; cursor: not-allowed; }
	}

	.mcp-panel-actions {
		display: flex;
		gap: 8px;
	}

	.mcp-panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 14px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.mcp-endpoint-row,
	.mcp-status-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8125rem;
	}

	.mcp-label {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.mcp-endpoint,
	.mcp-token-prefix {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--color-text);
		word-break: break-all;
	}

	.mcp-badge {
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--color-success, #16a34a) 15%, transparent);
		color: var(--color-success, #16a34a);
	}

	.mcp-token-reveal {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 14px;
		margin-bottom: 8px;
		border-radius: 8px;
		border: 1px solid var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.mcp-token-reveal-note {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.mcp-token-reveal-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.mcp-token-value {
		flex: 1;
		font-family: monospace;
		font-size: 0.8125rem;
		word-break: break-all;
		user-select: all;
	}

	.btn-add-table {
		box-sizing: border-box;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 14px;
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


</style>
