<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import AppIcon, { ICON_OPTIONS } from '$lib/components/AppIcon.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// ── App meta edit ─────────────────────────────────────────
	let appLabel = $state(data.app.label);
	let appIcon = $state(data.app.icon ?? 'layout-grid');
	let metaDirty = $state(false);
	let savingMeta = $state(false);
	let metaSaved = $state(false);

	$effect(() => { appLabel = data.app.label; appIcon = data.app.icon ?? 'layout-grid'; });

	function markMetaDirty() { metaDirty = true; }

	async function saveMeta() {
		if (!appLabel.trim()) return;
		savingMeta = true;
		try {
			await fetch(`/api/apps/${data.app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: appLabel.trim(), icon: appIcon })
			});
			await invalidateAll();
			metaDirty = false;
			metaSaved = true;
			setTimeout(() => (metaSaved = false), 2000);
		} finally {
			savingMeta = false;
		}
	}

	// ── Spec editor ───────────────────────────────────────────
	let spec = $state(data.app.spec ?? '');
	let saving = $state(false);
	let saved = $state(false);
	let aiTrigger = $state<string | null>(null);

	$effect(() => { spec = data.app.spec ?? ''; });

	async function saveSpec() {
		saving = true;
		try {
			await fetch(`/api/apps/${data.app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spec })
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} finally {
			saving = false;
		}
	}

	async function generateFromSpec() {
		if (!spec.trim()) return;
		await saveSpec();
		aiTrigger = `以下の仕様書に基づいて、このアプリのテーブルとページを設計・作成してください:\n\n${spec}`;
	}

	// ── Tabs ──────────────────────────────────────────────────
	type Tab = 'tables' | 'pages' | 'workflows';
	let activeTab = $state<Tab>('tables');


	// ── Resizable split ───────────────────────────────────────
	const CHAT_MIN = 220;
	const CHAT_MAX = 640;
	let chatWidth = $state(340);
	let resizing = $state(false);

	function onResizerMouseDown(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startWidth = chatWidth;
		function onMove(e: MouseEvent) {
			const delta = startX - e.clientX;
			chatWidth = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth + delta));
		}
		function onUp() {
			resizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	const chatContext = $derived({
		appId: data.app.id,
		appLabel: data.app.label,
		appName: data.app.name,
		spec: data.app.spec,
		tables: data.tables.map((t) => ({ id: t.id, name: t.name, label: t.label }))
	});

	function padTime(n: number) { return String(n).padStart(2, '0'); }
</script>

<div class="builder-layout" style="grid-template-columns: 1fr 5px {chatWidth}px" class:resizing>
	<!-- Left panel: builder -->
	<div class="builder-panel">
		<div class="panel-header">
			<a href="/" class="back-link"><ChevronLeft size={15} />アプリ一覧</a>
			{#if data.account?.permission === 'admin'}
				<div class="meta-edit">
					<div class="icon-grid">
						{#each ICON_OPTIONS as opt (opt.name)}
							<button
								type="button"
								class="icon-opt"
								class:selected={appIcon === opt.name}
								onclick={() => { appIcon = opt.name; markMetaDirty(); }}
								title={opt.name}
							><AppIcon icon={opt.name} size={15} /></button>
						{/each}
					</div>
					<div class="meta-name-row">
						<input
							class="meta-label-input"
							type="text"
							bind:value={appLabel}
							oninput={markMetaDirty}
							placeholder="アプリ名"
						/>
						{#if metaDirty || metaSaved}
							<div class="meta-actions">
								{#if metaSaved}<span class="saved-msg">✓</span>{/if}
								{#if metaDirty}
									<button class="btn-save-meta" onclick={saveMeta} disabled={savingMeta || !appLabel.trim()}>
										{savingMeta ? '…' : '保存'}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="app-title-row">
					<span class="app-icon"><AppIcon icon={data.app.icon} size={20} /></span>
					<h1>{data.app.label}</h1>
				</div>
			{/if}
		</div>

		<div class="panel-body">
			<!-- Spec editor -->
			<section class="spec-section">
				<div class="section-header">
					<h2 class="section-label">仕様書</h2>
					<div class="section-actions">
						{#if saved}<span class="saved-msg">✓ 保存しました</span>{/if}
						<button class="btn-save" onclick={saveSpec} disabled={saving}>
							{saving ? '保存中…' : '保存'}
						</button>
					</div>
				</div>
				<textarea
					class="spec-textarea"
					bind:value={spec}
					placeholder="アプリの仕様をここに記述してください。AIが設計をサポートします。&#10;&#10;例:&#10;## 顧客商談管理&#10;&#10;### データ&#10;- 顧客マスタ（会社名, 担当者, 業種）&#10;- 商談（顧客, ステータス, 金額）&#10;- 活動履歴（商談, 種別, 日時, 内容）&#10;&#10;### ページ&#10;- 商談ボード（カンバン, ステータス別）"
				></textarea>
				<button class="btn-generate" onclick={generateFromSpec} disabled={!spec.trim() || saving}>
					✨ AIに設計・作成してもらう
				</button>
			</section>

			<!-- Tab bar -->
			<div class="tab-bar" role="tablist">
				{#each [['tables', 'テーブル'], ['pages', 'ページ'], ['workflows', 'ワークフロー']] as [id, label] (id)}
					<button
						class="tab-btn"
						class:active={activeTab === id}
						role="tab"
						aria-selected={activeTab === id}
						onclick={() => (activeTab = id as Tab)}
					>{label}</button>
				{/each}
			</div>

			<!-- Tab: Tables -->
			{#if activeTab === 'tables'}
				<div class="tab-content">
					{#each data.tables as table (table.id)}
						<button
							class="item-row"
							onclick={() => goto(`/apps/${data.app.id}/tables/${table.id}`)}
						>
							<span class="item-label">{table.label}</span>
							<span class="item-meta">{table.recordCount} 件</span>
							{#if data.account?.permission === 'admin'}
								<a
									href="/apps/{data.app.id}/tables/{table.id}/build"
									class="item-action"
									onclick={(e) => e.stopPropagation()}
								>設定</a>
							{/if}
							<span class="item-arrow">›</span>
						</button>
					{:else}
						<p class="empty-hint">AIに「テーブルを追加して」と話しかけるか、手動で追加できます。</p>
					{/each}
					{#if data.account?.permission === 'admin'}
						<a href="/apps/{data.app.id}/tables/new" class="btn-add-table">
							+ テーブルを追加
						</a>
					{/if}
				</div>

			<!-- Tab: Pages -->
			{:else if activeTab === 'pages'}
				<div class="tab-content">
					{#each data.pages as page (page.id)}
						<a
							href="/apps/{data.app.id}/pages/{page.id}"
							class="item-row item-row--link"
						>
							<span class="item-label">{page.label}</span>
							{#if page.tableLabel && page.tableLabel !== page.label}
								<span class="item-meta">{page.tableLabel}</span>
							{/if}
							<span class="item-badge">{page.viewType}</span>
							<span class="item-arrow">›</span>
						</a>
					{:else}
						<p class="empty-hint">AIに「ページを追加して」と話しかけるか、仕様書を書いて「AIに設計・作成してもらう」ボタンを使ってください。</p>
					{/each}
				</div>

			<!-- Tab: Workflows -->
			{:else if activeTab === 'workflows'}
				<div class="tab-content">
					{#each data.workflows as wf (wf.id)}
						<div class="item-row item-row--static">
							<span class="item-icon">{wf.enabled ? '🟢' : '⚪'}</span>
							<span class="item-label">{wf.name}</span>
							<span class="item-meta">{padTime(wf.triggerHour)}:{padTime(wf.triggerMinute)}</span>
							<span class="item-badge">{wf.steps.length} ステップ</span>
						</div>
					{:else}
						<p class="empty-hint">AIに「ワークフローを作って」と話しかけてください。</p>
					{/each}
					{#if data.workflows.length > 0}
						<a href="/workflows" class="link-more">ワークフロー設定を開く →</a>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Resize handle -->
	<div
		class="resizer"
		onmousedown={onResizerMouseDown}
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
			context={chatContext}
			triggerMessage={aiTrigger}
			onTriggerConsumed={() => (aiTrigger = null)}
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

	.meta-edit {
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
		width: 30px;
		height: 30px;
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

	.meta-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.meta-label-input {
		flex: 1;
		padding: 7px 10px;
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

	.meta-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.btn-save-meta {
		padding: 5px 12px;
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

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		margin-bottom: 10px;
		&:hover { color: var(--color-text); }
	}

	.app-title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.app-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		color: var(--color-primary);
		flex-shrink: 0;
	}

	h1 {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
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
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.section-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.section-actions {
		display: flex;
		align-items: center;
		gap: 8px;
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

	.spec-textarea {
		width: 100%;
		min-height: 200px;
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
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 12px;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		font-size: 0.875rem;
		font-family: inherit;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: border-color 0.15s;

		&:hover { border-color: var(--color-primary); }

		&--static {
			cursor: default;
			&:hover { border-color: var(--color-border); }
		}

		&--link {
			text-decoration: none;
		}
	}

	.item-label { flex: 1; font-weight: 500; }
	.item-meta { font-size: 0.8125rem; color: var(--color-text-muted); }

	.item-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.item-action {
		font-size: 0.8125rem;
		color: var(--color-primary);
		text-decoration: none;
		padding: 2px 6px;
		border-radius: 4px;
		transition: background 0.1s;

		&:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
	}

	.item-arrow { font-size: 1rem; color: var(--color-text-muted); }

	.empty-hint {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 8px 2px;
		margin: 0;
	}

	.btn-add-table {
		display: block;
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
		text-align: center;
		text-decoration: none;
		box-sizing: border-box;
		transition: border-color 0.15s, color 0.15s;

		&:hover { border-color: var(--color-primary); color: var(--color-primary); }
	}

	.link-more {
		font-size: 0.875rem;
		color: var(--color-primary);
		text-decoration: none;
		padding: 4px 2px;
		&:hover { text-decoration: underline; }
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
