<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import { notificationCenter } from '$lib/stores/notifications.svelte';
	import NotificationDrawer from '$lib/components/ui/NotificationDrawer.svelte';
	import Bell from '$lib/components/icon/Bell.svelte';
	import Users from '$lib/components/icon/Users.svelte';
	import Workflow from '$lib/components/icon/Workflow.svelte';
	import Settings from '$lib/components/icon/Settings.svelte';
	import LogOut from '$lib/components/icon/LogOut.svelte';
	import ChevronRight from '$lib/components/icon/ChevronRight.svelte';
	import AppIcon from '$lib/components/AppIcon.svelte';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Star from '@lucide/svelte/icons/star';
	import type { AccountRow } from '$lib/server/db/account-service';

	type AppItem = { id: string; name: string; label: string; icon: string | null };
	type Props = {
		account: AccountRow;
		bookmarkedIds: string[];
		apps: AppItem[];
	};
	let { account, bookmarkedIds, apps }: Props = $props();

	let notificationDrawerOpen = $state(false);
	let bookmarksOpen = $state(true);

	function toggleNotificationDrawer() {
		notificationDrawerOpen = !notificationDrawerOpen;
		if (notificationDrawerOpen) notificationCenter.loadItems();
	}

	function formatBadgeCount(count: number): string {
		return count > 99 ? '99+' : String(count);
	}

	async function handleSignout() {
		if (!confirm(m.signout_confirm())) return;
		await fetch('/api/auth/signout', { method: 'POST' });
		window.location.href = '/signin';
	}

	const bookmarkedApps = $derived(apps.filter((a) => bookmarkedIds.includes(a.id)));

	function isActive(href: string) {
		return page.url.pathname === href;
	}

	function isUnderPath(prefix: string) {
		return page.url.pathname.startsWith(prefix);
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<a href="/" class="logo">BOANN</a>
	</div>

	<nav class="nav">
		<a href="/" class="nav-item" class:active={isActive('/')}>
			<span class="nav-icon"><LayoutGrid size={15} /></span>
			<span>アプリ一覧</span>
		</a>

		{#if bookmarkedApps.length > 0}
			<div class="section">
				<button
					class="section-header"
					onclick={() => (bookmarksOpen = !bookmarksOpen)}
					aria-expanded={bookmarksOpen}
				>
					<span class="nav-icon"><Star size={14} /></span>
					<span>ブックマーク</span>
					<span class="chevron" class:open={bookmarksOpen}>
						<ChevronRight size={12} />
					</span>
				</button>
				{#if bookmarksOpen}
					<div class="section-items">
						{#each bookmarkedApps as app (app.id)}
							<a
								href={`/apps/${app.id}`}
								class="nav-item nav-sub"
								class:active={isUnderPath(`/apps/${app.id}`)}
							>
								<span class="app-icon"><AppIcon icon={app.icon} size={13} /></span>
								<span>{app.label}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
		<!--<a href="/workflows" class="nav-item" class:active={isUnderPath('/workflows')}>
			<span class="nav-icon"><Workflow size={15} /></span>
			<span>ワークフロー</span>
		</a>-->
	</nav>

	<div class="sidebar-footer">
		<button class="footer-item notification-toggle" onclick={toggleNotificationDrawer}>
			<Bell size={15} />
			{m.notifications()}
			{#if notificationCenter.unreadCount > 0}
				<span class="notification-badge">{formatBadgeCount(notificationCenter.unreadCount)}</span>
			{/if}
		</button>

		{#if account.permission === 'admin'}
			<a href="/accounts" class="footer-item" class:active={isUnderPath('/accounts')}>
				<Users size={15} />
				アカウント
			</a>
		{/if}

		<a href="/settings" class="footer-item" class:active={isUnderPath('/settings')}>
			<Settings size={15} />
			{m.settings()}
		</a>

		<div class="account-row">
			<span class="account-name">{account.name}</span>
			<button class="signout-btn" onclick={handleSignout} title={m.signout()} aria-label={m.signout()}>
				<LogOut size={15} />
			</button>
		</div>
	</div>
</aside>

<NotificationDrawer open={notificationDrawerOpen} onclose={() => (notificationDrawerOpen = false)} />

<style lang="scss">
	.sidebar {
		display: flex;
		flex-direction: column;
		background: var(--sidebar-bg);
		overflow: hidden;
	}

	.sidebar-header {
		padding: 14px 12px 10px;
	}

	.logo {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-primary);
		padding: 0 4px;
		letter-spacing: -0.01em;
		font-family: Georgia, 'Times New Roman', Times, serif;
		text-decoration: none;
	}

	.nav {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		transition: background 0.15s;

		&:hover { background: var(--sidebar-hover); }
		&.active {
			background: var(--sidebar-hover);
			color: var(--color-text);
			font-weight: 500;
		}
	}

	.nav-sub {
		padding-left: 28px;
		font-size: 0.8125rem;
		color: var(--sidebar-text-muted);
	}

	.nav-icon {
		flex-shrink: 0;
		width: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.app-icon {
		flex-shrink: 0;
		width: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		border-radius: 8px;
		background: transparent;
		font: inherit;
		font-size: 0.875rem;
		color: var(--sidebar-text-muted);
		text-align: left;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--sidebar-hover);
			color: var(--sidebar-text);
		}
	}

	.chevron {
		margin-left: auto;
		color: var(--sidebar-text-muted);
		display: flex;
		align-items: center;
		transition: transform 0.2s;

		&.open { transform: rotate(90deg); }
	}

	.section-items {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-footer {
		padding: 8px;
		border-top: 1px solid var(--sidebar-border);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.footer-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text-muted);
		text-decoration: none;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--sidebar-hover);
			color: var(--sidebar-text);
		}
		&.active {
			color: var(--color-text);
		}
	}

	button.footer-item {
		width: 100%;
		border: none;
		background: transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	button.notification-toggle {
		font-size: 0.875rem;
	}

	.notification-badge {
		margin-left: auto;
		min-width: 18px;
		padding: 1px 5px;
		border-radius: 999px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.4;
		text-align: center;
	}

	.account-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		margin-top: 4px;
		border-top: 1px solid var(--sidebar-border);
	}

	.account-name {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--sidebar-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.signout-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--sidebar-hover);
			color: var(--sidebar-text);
		}
	}
</style>
