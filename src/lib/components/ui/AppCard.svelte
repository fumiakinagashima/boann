<script lang="ts">
	import AppIcon from '$lib/components/AppIcon.svelte';
	import Star from '@lucide/svelte/icons/star';
	import type { AppCard } from '$lib/server/db/table-service';

	type Props = { app: AppCard };
	let { app }: Props = $props();

</script>

<div class="app-card">
	<div class="card-header">
		<span class="card-icon">
			<AppIcon icon={app.icon} size={22} />
		</span>
		<!--<button
			class="bookmark-btn"
			class:bookmarked={s.bookmarkedIds.includes(app.id)}
			onclick={(e) => s.toggleBookmark(app, e)}
			aria-label={s.bookmarkedIds.includes(app.id) ? 'ブックマーク解除' : 'ブックマーク'}
		>
			<Star size={15} fill={s.bookmarkedIds.includes(app.id) ? 'currentColor' : 'none'} />
		</button>-->
	</div>
	<div class="card-body">
		<h2 class="card-title">{app.label}</h2>
		<p class="card-name">{app.name}</p>
	</div>
	<div class="card-footer">
		{#if app.indexPageId}
			<a href={`/apps/${app.id}/pages/${app.indexPageId}`}>画面表示</a>
		{/if}
		<a href={`/apps/${app.id}`} class="settings-link">アプリ設定</a>
	</div>
</div>

<style lang="scss">
	.app-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
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
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		color: var(--color-primary);
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
		gap: 8px;
		& a {
			color: var(--color-primary);
			text-decoration: none;
			font-size: 0.8rem;
			font-weight: 600;
			&:hover {
				opacity: 0.9;
				text-decoration: underline;
			}
		}
	}


</style>