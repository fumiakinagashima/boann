<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { notificationCenter } from '$lib/stores/notifications.svelte';
	import { chatSession } from '$lib/stores/chat-session.svelte';
	import { chatHistory, type ChatSummary } from '$lib/stores/chat-history.svelte';
	import NotificationDrawer from '$lib/components/ui/NotificationDrawer.svelte';
	import Plus from '$lib/components/icon/Plus.svelte';
	import MoreVertical from '$lib/components/icon/MoreVertical.svelte';
	import Bell from '$lib/components/icon/Bell.svelte';
	import Database from '$lib/components/icon/Database.svelte';
	import ClipboardCheck from '$lib/components/icon/ClipboardCheck.svelte';
	import Users from '$lib/components/icon/Users.svelte';
	import Clock from '$lib/components/icon/Clock.svelte';
	import Workflow from '$lib/components/icon/Workflow.svelte';
	import CreditCard from '$lib/components/icon/CreditCard.svelte';
	import Settings from '$lib/components/icon/Settings.svelte';
	import LogOut from '$lib/components/icon/LogOut.svelte';
	import type { AccountRow } from '$lib/server/db/account-service';

	type Props = { account: AccountRow };
	let { account }: Props = $props();

	let notificationDrawerOpen = $state(false);

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

	const historyGroups = $derived.by(() => {
		const startOfToday = new Date();
		startOfToday.setHours(0, 0, 0, 0);
		const startOfYesterday = new Date(startOfToday);
		startOfYesterday.setDate(startOfYesterday.getDate() - 1);
		const startOfLast7Days = new Date(startOfToday);
		startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);

		const groups = [
			{ label: m.history_today(), items: [] as typeof chatHistory.items },
			{ label: m.history_yesterday(), items: [] as typeof chatHistory.items },
			{ label: m.history_last_7_days(), items: [] as typeof chatHistory.items },
			{ label: m.history_older(), items: [] as typeof chatHistory.items }
		];

		for (const chat of chatHistory.items) {
			const updatedAt = new Date(chat.updatedAt);
			if (updatedAt >= startOfToday) groups[0].items.push(chat);
			else if (updatedAt >= startOfYesterday) groups[1].items.push(chat);
			else if (updatedAt >= startOfLast7Days) groups[2].items.push(chat);
			else groups[3].items.push(chat);
		}

		return groups.filter((g) => g.items.length > 0);
	});

	let openMenuId = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function toggleHistoryMenu(id: string) {
		openMenuId = openMenuId === id ? null : id;
	}

	function startRename(item: ChatSummary) {
		renamingId = item.id;
		renameValue = item.title;
		openMenuId = null;
	}

	async function commitRename(id: string) {
		if (renamingId !== id) return;
		renamingId = null;
		const title = renameValue.trim();
		const current = chatHistory.items.find((c) => c.id === id);
		if (!title || !current || title === current.title) return;
		chatHistory.updateTitle(id, title);
		try {
			await fetch(`/api/chats/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
		} catch {
			// 失敗時もUI上は変更後のタイトルを維持する
		}
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.isComposing) {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			renamingId = null;
		}
	}

	async function deleteChatItem(item: ChatSummary) {
		openMenuId = null;
		if (!confirm(m.history_delete_confirm())) return;
		chatHistory.remove(item.id);
		if (page.url.searchParams.get('id') === item.id) goto('/');
		try {
			await fetch(`/api/chats/${item.id}`, { method: 'DELETE' });
		} catch {
			// ローカル一覧からは削除済み。失敗時はリロードで復活する
		}
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	$effect(() => {
		if (!openMenuId) return;
		const close = () => (openMenuId = null);
		const id = setTimeout(() => document.addEventListener('click', close), 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener('click', close);
		};
	});
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<span class="logo">MIDLETON</span>
	</div>

	<a href="/" class="new-chat-row" onclick={() => chatSession.startNew()}>
		<Plus size={14} />
		{m.new_chat()}
	</a>

	<nav class="history">
		{#each historyGroups as group}
			<p class="group-label">{group.label}</p>
			{#each group.items as item}
				<div class="history-item-row" class:active={page.url.searchParams.get('id') === item.id}>
					{#if renamingId === item.id}
						<input
							class="history-rename-input"
							bind:value={renameValue}
							onkeydown={handleRenameKeydown}
							onblur={() => commitRename(item.id)}
							use:focusOnMount
						/>
					{:else}
						<a href="/?id={item.id}" class="history-item">
							{item.title || m.new_chat()}
						</a>
					{/if}
					<div class="history-menu-wrap">
						<button
							class="history-menu-btn"
							aria-label={m.history_menu()}
							aria-expanded={openMenuId === item.id}
							onclick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								toggleHistoryMenu(item.id);
							}}
						>
							<MoreVertical size={14} />
						</button>
						{#if openMenuId === item.id}
							<div class="history-menu">
								<button class="history-menu-item" onclick={() => startRename(item)}>
									{m.history_rename()}
								</button>
								<button class="history-menu-item danger" onclick={() => deleteChatItem(item)}>
									{m.history_delete()}
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		{/each}
	</nav>

	<div class="sidebar-footer">
		<button class="settings-row notification-toggle" onclick={toggleNotificationDrawer}>
			<Bell size={15} />
			{m.notifications()}
			{#if notificationCenter.unreadCount > 0}
				<span class="notification-badge">{formatBadgeCount(notificationCenter.unreadCount)}</span>
			{/if}
		</button>

		<a href="/database" class="settings-row">
			<Database size={15} />
			データ管理
		</a>

		<a href="/database/approvals" class="settings-row">
			<ClipboardCheck size={15} />
			申請管理
		</a>

		{#if account.permission === 'admin'}
			<a href="/database/accounts" class="settings-row">
				<Users size={15} />
				アカウント
			</a>
		{/if}

		<a href="/database/reminders" class="settings-row">
			<Clock size={15} />
			リマインダー
		</a>

		<a href="/database/workflows" class="settings-row">
			<Workflow size={15} />
			ワークフロー
		</a>

		<a href="/bizcard" class="settings-row">
			<CreditCard size={15} />
			名刺取り込み
		</a>

		<a href="/settings" class="settings-row">
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 12px 10px;
	}

	.logo {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-primary);
		padding: 0 4px;
		letter-spacing: -0.01em;
		font-family: Georgia, 'Times New Roman', Times, serif;
	}

	.new-chat-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 8px 4px;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		transition: background 0.15s;

		&:hover { background: var(--sidebar-hover); }
	}

	.history {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.group-label {
		font-size: 0.75rem;
		color: var(--sidebar-text-muted);
		padding: 8px 10px 4px;
		font-weight: 500;
	}

	.history-item-row {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: 8px;
		transition: background 0.15s;

		&:hover,
		&.active { background: var(--sidebar-hover); }

		&.active .history-item { color: var(--color-text); }
	}

	.history-item {
		flex: 1;
		min-width: 0;
		display: block;
		padding: 7px 10px;
		border-radius: 8px;
		font-size: 0.875rem;
		color: var(--sidebar-text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history-rename-input {
		flex: 1;
		min-width: 0;
		padding: 6px 9px;
		margin: 1px 0;
		border: 1px solid var(--color-primary);
		border-radius: 8px;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
	}

	.history-menu-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.history-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		margin-right: 4px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--sidebar-text-muted);
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;

		&:hover,
		&[aria-expanded='true'] {
			background: var(--color-border);
			color: var(--sidebar-text);
		}
	}

	.history-menu {
		position: absolute;
		top: calc(100% + 2px);
		right: 0;
		min-width: 140px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.08),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 4px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 20;
	}

	.history-menu-item {
		display: block;
		width: 100%;
		padding: 7px 10px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;

		&:hover { background: var(--color-background); }
		&.danger { color: var(--color-danger); }
	}

	.sidebar-footer {
		padding: 8px;
		border-top: 1px solid var(--sidebar-border);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.settings-row {
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
	}

	button.settings-row {
		width: 100%;
		border: none;
		background: transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
		font-size: 0.87rem;
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
