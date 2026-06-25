<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { AppCard } from '$lib/server/db/table-service';

	let { data }: { data: PageData } = $props();

	let apps = $state<AppCard[]>(data.apps);
	$effect(() => { apps = data.apps; });

	let bookmarkedIds = $state<string[]>(data.bookmarkedIds ?? []);
	$effect(() => { bookmarkedIds = data.bookmarkedIds ?? []; });

	let showCreateDialog = $state(false);
	let creating = $state(false);
	let createError = $state('');
	let createLabel = $state('');
	let createIcon = $state('📋');

	function slugify(label: string): string {
		return label
			.toLowerCase()
			.replace(/[\s　]+/g, '_')
			.replace(/[^a-z0-9_]/g, '')
			.replace(/^_+|_+$/g, '')
			|| 'app_' + Date.now();
	}

	async function createApp() {
		if (!createLabel.trim()) return;
		creating = true;
		createError = '';
		try {
			const res = await fetch('/api/database/tables', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: createLabel.trim(), name: slugify(createLabel.trim()), icon: createIcon, fields: [] })
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				createError = body.error ?? '作成に失敗しました';
				return;
			}
			const { id } = (await res.json()) as { id: string };
			showCreateDialog = false;
			createLabel = '';
			createIcon = '📋';
			await invalidateAll();
			goto(`/apps/${id}/build`);
		} finally {
			creating = false;
		}
	}

	async function toggleBookmark(app: AppCard, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const res = await fetch('/api/bookmarks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entityTypeId: app.id })
		});
		if (res.ok) {
			const { bookmarked } = (await res.json()) as { bookmarked: boolean };
			if (bookmarked) {
				bookmarkedIds = [...bookmarkedIds, app.id];
			} else {
				bookmarkedIds = bookmarkedIds.filter((id) => id !== app.id);
			}
			await invalidateAll();
		}
	}

	const ICON_OPTIONS = ['📋', '📊', '👥', '🏢', '📦', '💼', '🛒', '📅', '🎯', '⚙️', '📝', '🔧'];
</script>

<div class="page">
	<div class="page-header">
		<div>
			<h1>アプリ一覧</h1>
			<p class="subtitle">カスタムアプリを作成・管理できます</p>
		</div>
		{#if data.account?.permission === 'admin'}
			<button class="btn-primary" onclick={() => (showCreateDialog = true)}>
				+ 新規アプリ作成
			</button>
		{/if}
	</div>

	{#if apps.length === 0}
		<div class="empty">
			<div class="empty-icon">📋</div>
			<p class="empty-title">アプリがまだありません</p>
			{#if data.account?.permission === 'admin'}
				<p class="empty-desc">「新規アプリ作成」からアプリを追加してください。<br>AIがフィールド設計をサポートします。</p>
				<button class="btn-primary" onclick={() => (showCreateDialog = true)}>
					+ 新規アプリ作成
				</button>
			{:else}
				<p class="empty-desc">管理者にアプリの作成を依頼してください。</p>
			{/if}
		</div>
	{:else}
		<div class="app-grid">
			{#each apps as app (app.id)}
				<div class="app-card" role="link" tabindex="0"
					onclick={() => goto(`/apps/${app.id}`)}
					onkeydown={(e) => { if (e.key === 'Enter') goto(`/apps/${app.id}`); }}
				>
					<div class="card-header">
						<span class="card-icon">{app.icon ?? '📋'}</span>
						<button
							class="bookmark-btn"
							class:bookmarked={bookmarkedIds.includes(app.id)}
							onclick={(e) => toggleBookmark(app, e)}
							aria-label={bookmarkedIds.includes(app.id) ? 'ブックマーク解除' : 'ブックマーク'}
						>
							{bookmarkedIds.includes(app.id) ? '★' : '☆'}
						</button>
					</div>
					<div class="card-body">
						<h2 class="card-title">{app.label}</h2>
						<p class="card-name">{app.name}</p>
					</div>
					<div class="card-footer">
						<span class="card-meta">フィールド {app.fieldCount}件</span>
						<span class="card-dot">·</span>
						<span class="card-meta">レコード {app.recordCount}件</span>
						{#if data.account?.permission === 'admin'}
							<button
								class="card-settings"
								onclick={(e) => { e.stopPropagation(); goto(`/apps/${app.id}/build`); }}
							>
								設定
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showCreateDialog}
	<div class="dialog-backdrop" onclick={() => (showCreateDialog = false)} onkeydown={(e) => { if (e.key === 'Escape') showCreateDialog = false; }} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
			<h2>新規アプリ作成</h2>
			<div class="dialog-body">
				<div class="icon-picker">
					<p class="field-label">アイコン</p>
					<div class="icon-grid">
						{#each ICON_OPTIONS as icon}
							<button
								class="icon-opt"
								class:selected={createIcon === icon}
								onclick={() => (createIcon = icon)}
							>{icon}</button>
						{/each}
					</div>
				</div>
				<div class="field">
					<label class="field-label" for="app-label">アプリ名</label>
					<input
						id="app-label"
						type="text"
						class="field-input"
						bind:value={createLabel}
						placeholder="例: 備品管理、採用候補者"
						onkeydown={(e) => { if (e.key === 'Enter' && !e.isComposing) createApp(); }}
					/>
					{#if createLabel}
						<p class="field-hint">識別名: {slugify(createLabel)}</p>
					{/if}
				</div>
				{#if createError}<p class="form-error">{createError}</p>{/if}
				<p class="ai-hint">
					💡 作成後、アプリ設定画面でAIにフィールド設計を相談できます
				</p>
			</div>
			<div class="dialog-footer">
				<button class="btn-secondary" onclick={() => (showCreateDialog = false)}>キャンセル</button>
				<button class="btn-primary" onclick={createApp} disabled={creating || !createLabel.trim()}>
					{creating ? '作成中…' : '作成する'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.page {
		padding: 32px 40px;
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 32px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0 0 4px;
	}

	.subtitle {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 80px 0;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
	}

	.empty-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
	}

	.empty-desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.6;
		margin: 0;
	}

	.app-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.app-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;

		&:hover {
			border-color: var(--color-primary);
			box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
		}
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-icon {
		font-size: 1.75rem;
	}

	.bookmark-btn {
		background: none;
		border: none;
		font-size: 1.125rem;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 4px;
		border-radius: 4px;
		transition: color 0.15s;
		line-height: 1;

		&:hover { color: var(--color-primary); }
		&.bookmarked { color: #f59e0b; }
	}

	.card-body {
		flex: 1;
	}

	.card-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0 0 4px;
	}

	.card-name {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.card-footer {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.card-meta {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.card-dot {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.card-settings {
		margin-left: auto;
		font-size: 0.8125rem;
		color: var(--color-primary);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: inherit;

		&:hover { text-decoration: underline; }
	}

	/* Buttons */
	.btn-primary {
		padding: 8px 18px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.15s;

		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	/* Dialog */
	.dialog-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.dialog {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		width: min(480px, calc(100vw - 32px));
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);

		h2 {
			font-size: 1.0625rem;
			font-weight: 600;
			padding: 20px 24px 0;
			margin: 0;
		}
	}

	.dialog-body {
		padding: 20px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.field-input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 7px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.15s;

		&:focus { border-color: var(--color-primary); }
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
		font-family: ui-monospace, monospace;
	}

	.icon-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.icon-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.icon-opt {
		width: 36px;
		height: 36px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		font-size: 1.125rem;
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

	.ai-hint {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
		border: 1px solid color-mix(in srgb, var(--color-primary) 15%, var(--color-border));
		border-radius: 7px;
		padding: 10px 12px;
		margin: 0;
	}

	.form-error {
		font-size: 0.8125rem;
		color: var(--color-danger);
		margin: 0;
	}

	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 16px 24px;
		border-top: 1px solid var(--color-border);
	}

	.btn-secondary {
		padding: 8px 16px;
		border-radius: 7px;
		font-size: 0.875rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		transition: background 0.15s;

		&:hover { background: var(--color-border); }
	}
</style>
