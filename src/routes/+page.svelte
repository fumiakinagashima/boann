<script lang="ts">
	import { createAppListState } from './index.svelte';
	import type { PageData } from './$types';
	import AppCard from '$lib/components/ui/AppCard.svelte';
	let { data }: { data: PageData } = $props();
	const s = createAppListState(() => data);
</script>

<div class="page">
	<div class="page-header">
		<div>
			<h1>アプリ一覧</h1>
		</div>
		{#if data.account?.permission === 'admin'}
			<button class="btn-primary" onclick={s.createApp} disabled={s.creating}>
				アプリを作成
			</button>
		{/if}
	</div>

	{#if s.apps.length === 0}
		<div class="empty">
			<p class="empty-title">アプリがまだありません</p>
			{#if data.account?.permission === 'admin'}
				<p class="empty-desc">「アプリを作成」からはじめて、AIに仕様を伝えましょう。</p>
				<button class="btn-primary" onclick={s.createApp} disabled={s.creating}>
					アプリを作成
				</button>
			{:else}
				<p class="empty-desc">管理者にアプリの作成を依頼してください。</p>
			{/if}
		</div>
	{:else}
		<div class="app-grid">
			{#each s.apps as app (app.id)}
				<AppCard {app} />
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

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 80px 0;
		text-align: center;
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
