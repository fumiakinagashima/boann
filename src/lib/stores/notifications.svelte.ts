import type { MessageContent } from '$lib/types/chat';

export type NotificationItem = {
	id: string;
	type: string;
	title: string;
	body: string;
	seedContent: MessageContent[];
	isRead: boolean;
	createdAt: string;
};

class NotificationCenterStore {
	unreadCount = $state(0);
	items = $state<NotificationItem[]>([]);
	loaded = $state(false);

	async loadItems() {
		try {
			const res = await fetch('/api/notifications');
			if (!res.ok) return;
			const data = (await res.json()) as { items: NotificationItem[] };
			this.items = data.items;
			this.unreadCount = this.items.filter((n) => !n.isRead).length;
			this.loaded = true;
		} catch {
			// ignore fetch errors, keep previous state
		}
	}

	async refreshUnreadCount() {
		try {
			const res = await fetch('/api/notifications/unread-count');
			if (!res.ok) return;
			const data = (await res.json()) as { unreadCount: number };
			this.unreadCount = data.unreadCount;
		} catch {
			// ignore fetch errors, keep previous state
		}
	}

	async markRead(id: string) {
		const item = this.items.find((n) => n.id === id);
		if (item && !item.isRead) {
			item.isRead = true;
			this.unreadCount = Math.max(0, this.unreadCount - 1);
		}
		try {
			await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
		} catch {
			// best-effort, ignore errors
		}
	}
}

export const notificationCenter = new NotificationCenterStore();
