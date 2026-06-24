export type ToastType = 'success' | 'error' | 'info';

type ToastItem = { id: number; type: ToastType; message: string };

class ToastStore {
	items = $state<ToastItem[]>([]);
	private nextId = 0;

	add(type: ToastType, message: string, duration = 4000) {
		const id = ++this.nextId;
		this.items = [...this.items, { id, type, message }];
		setTimeout(() => {
			this.items = this.items.filter((t) => t.id !== id);
		}, duration);
	}

	success(message: string) { this.add('success', message); }
	error(message: string) { this.add('error', message); }
	info(message: string) { this.add('info', message); }
}

export const toast = new ToastStore();
