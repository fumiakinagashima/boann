<script lang="ts">
	import { goto } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { notificationCenter, type NotificationItem } from '$lib/stores/notifications.svelte';
	import X from '$lib/components/icon/X.svelte';

	type Props = {
		open: boolean;
		onclose: () => void;
	};

	let { open, onclose }: Props = $props();

	function truncate(text: string, max = 40): string {
		return text.length > max ? `${text.slice(0, max)}...` : text;
	}

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('ja-JP', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
	}

	async function selectNotification(item: NotificationItem) {
		onclose();
		await notificationCenter.markRead(item.id);
		// リンク型のシードを持つ通知（アプリ生成など）は対象ページへ直接遷移する。
		const link = item.seedContent.find((c) => c.type === 'link');
		if (link && link.type === 'link') {
			await goto(link.href);
			return;
		}
		await goto(`/?notification=${item.id}`);
	}
</script>

<div class="overlay" class:open role="presentation" onclick={onclose}></div>
<aside class="drawer" class:open aria-hidden={!open}>
	<div class="drawer-header">
		<h2>{m.notifications()}</h2>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="drawer-body">
		{#if notificationCenter.items.length === 0}
			<p class="empty">{m.notifications_empty()}</p>
		{:else}
			{#each notificationCenter.items as item (item.id)}
				<button class="notification-item" class:unread={!item.isRead} onclick={() => selectNotification(item)}>
					<span class="unread-dot" aria-hidden="true"></span>
					<div class="notification-content">
						<div class="notification-title">{item.title}</div>
						<div class="notification-body">{truncate(item.body)}</div>
						<div class="notification-date">{formatDate(item.createdAt)}</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</aside>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 99;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;

		&.open {
			opacity: 1;
			pointer-events: auto;
		}
	}

	.drawer {
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh;
		width: 320px;
		max-width: 85vw;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.08);
		z-index: 100;
		display: flex;
		flex-direction: column;
		transform: translateX(-100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

		&.open { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 12px;
		border-bottom: 1px solid var(--color-border);

		h2 {
			margin: 0;
			font-size: 1rem;
			font-weight: 600;
			color: var(--color-text);
		}
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--color-background);
			color: var(--color-text);
		}
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.empty {
		padding: 24px 12px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.notification-item {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s ease;

		&:hover { background: var(--color-background); }
	}

	.unread-dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		margin-top: 6px;
		border-radius: 50%;
		background: var(--color-primary);
		visibility: hidden;
	}

	.notification-item.unread {
		.unread-dot { visibility: visible; }
		.notification-title { font-weight: 700; }
	}

	.notification-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.notification-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.notification-body {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.notification-date {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		opacity: 0.8;
	}
</style>
