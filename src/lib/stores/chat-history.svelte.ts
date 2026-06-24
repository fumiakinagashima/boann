export type ChatSummary = { id: string; title: string; updatedAt: string };

class ChatHistoryStore {
	items = $state<ChatSummary[]>([]);

	seed(items: ChatSummary[]) {
		this.items = items;
	}

	prepend(chat: ChatSummary) {
		this.items = [chat, ...this.items.filter((c) => c.id !== chat.id)];
	}

	updateTitle(id: string, title: string) {
		const item = this.items.find((c) => c.id === id);
		if (item) item.title = title;
	}

	remove(id: string) {
		this.items = this.items.filter((c) => c.id !== id);
	}
}

export const chatHistory = new ChatHistoryStore();
