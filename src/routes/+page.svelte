<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { TableCard } from '$lib/server/db/table-service';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import Star from '@lucide/svelte/icons/star';

	let { data }: { data: PageData } = $props();

	let apps = $state<TableCard[]>(data.apps);
	$effect(() => { apps = data.apps; });

	let bookmarkedIds = $state<string[]>(data.bookmarkedIds ?? []);
	$effect(() => { bookmarkedIds = data.bookmarkedIds ?? []; });

	let creating = $state(false);

	async function createApp() {
		creating = true;
		const name = 'app_' + Date.now();
		const res = await fetch('/api/database/tables', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ label: '新しいテーブル', name, icon: 'layout-grid', fields: [] })
		});
		if (!res.ok) {
			creating = false;
			return;
		}
		const { id } = (await res.json()) as { id: string };
		goto(`/apps/${id}/build`);
	}

	async function toggleBookmark(app: TableCard, e: MouseEvent) {
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

</script>

<div class="page">
	<div class="page-header">
		<div>
			<h1>テーブル一覧</h1>
			<p class="subtitle">カスタムテーブルを作成・管理できます</p>
		</div>
		{#if data.account?.permission === 'admin'}
			<button class="btn-primary" onclick={createApp} disabled={creating}>
				テーブルを追加
			</button>
		{/if}
	</div>

	{#if apps.length === 0}
		<div class="empty">
			<div class="empty-icon">📋</div>
			<p class="empty-title">テーブルがまだありません</p>
			{#if data.account?.permission === 'admin'}
				<p class="empty-desc">「テーブルを追加」からテーブルを作成してください。<br>AIがフィールド設計をサポートします。</p>
				<button class="btn-primary" onclick={createApp} disabled={creating}>
					テーブルを追加
				</button>
			{:else}
				<p class="empty-desc">管理者にテーブルの作成を依頼してください。</p>
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
						<span class="card-icon">
							<AppIcon icon={app.icon} size={22} />
						</span>
						<button
							class="bookmark-btn"
							class:bookmarked={bookmarkedIds.includes(app.id)}
							onclick={(e) => toggleBookmark(app, e)}
							aria-label={bookmarkedIds.includes(app.id) ? 'ブックマーク解除' : 'ブックマーク'}
						>
							<Star size={15} fill={bookmarkedIds.includes(app.id) ? 'currentColor' : 'none'} />
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


<style lang="scss">
	.page {
		padding: 32px 40px;
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
		padding: 16px;
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
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		color: var(--color-primary);
	}

	.bookmark-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		transition: color 0.15s;

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

</style>
