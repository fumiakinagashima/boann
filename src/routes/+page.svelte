<script lang="ts">
	import { createAppListState } from './index.svelte';
	import type { PageData } from './$types';
	import AppCard from '$lib/components/ui/AppCard.svelte';
	import ImportAppDialog from '$lib/components/dialog/ImportAppDialog.svelte';
	import ChevronDown from '$lib/components/icon/ChevronDown.svelte';
	let { data }: { data: PageData } = $props();
	const s = createAppListState(() => data);

	let menuOpen = $state(false);
	let importOpen = $state(false);

	function createBlank() {
		menuOpen = false;
		s.createApp();
	}

	function openImport() {
		menuOpen = false;
		importOpen = true;
	}
</script>

{#snippet createMenu()}
	<div class="create">
		<button class="btn-primary" onclick={() => (menuOpen = !menuOpen)} disabled={s.creating}>
			Create app
			<ChevronDown size={16} />
		</button>
		{#if menuOpen}
			<button class="menu-backdrop" aria-label="Close" onclick={() => (menuOpen = false)}></button>
			<div class="menu" role="menu">
				<button class="menu-item" role="menuitem" onclick={createBlank}>Start from scratch</button>
				<button class="menu-item" role="menuitem" onclick={openImport}>Create from file</button>
			</div>
		{/if}
	</div>
{/snippet}

<div class="page">
	<div class="page-header">
		<div>
			<h1>Apps</h1>
		</div>
		{@render createMenu()}
	</div>

	{#if s.apps.length === 0}
		<div class="empty">
			<p class="empty-title">No apps yet</p>
			<p class="empty-desc">Get started with "Create app" and tell the AI your requirements.</p>
			{@render createMenu()}
		</div>
	{:else}
		<div class="app-grid">
			{#each s.apps as app (app.id)}
				<AppCard
					{app}
					bookmarked={s.bookmarkedIds.includes(app.id)}
					onToggleBookmark={(e) => s.toggleBookmark(app, e)}
				/>
			{/each}
		</div>
	{/if}
</div>

{#if importOpen}
	<ImportAppDialog onclose={() => (importOpen = false)} />
{/if}


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

	/* Create dropdown */
	.create {
		position: relative;
		display: inline-block;
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10;
		background: transparent;
		border: none;
		cursor: default;
	}

	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 11;
		min-width: 180px;
		display: flex;
		flex-direction: column;
		padding: 4px;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);
	}

	.menu-item {
		text-align: left;
		padding: 8px 12px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;

		&:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); }
	}

	/* Buttons */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
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
