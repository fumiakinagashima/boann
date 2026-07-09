import { invalidateAll } from '$app/navigation';
import type { PageData } from './$types';
import type { AppCard } from '$lib/server/db/table-service';

export function createAppListState(getData: () => PageData) {
	let apps = $state<AppCard[]>(getData().apps);
	let bookmarkedIds = $state<string[]>(getData().bookmarkedIds ?? []);
	let creating = $state(false);

	$effect(() => { apps = getData().apps; });
	$effect(() => { bookmarkedIds = getData().bookmarkedIds ?? []; });

	async function createApp() {
		creating = true;
		const name = 'app_' + Date.now();
		const res = await fetch('/api/apps', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, label: '新しいアプリ', icon: 'layout-grid' })
		});
		if (!res.ok) { creating = false; return; }
		await invalidateAll();
	}

	async function toggleBookmark(app: AppCard, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const res = await fetch('/api/bookmarks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ appId: app.id })
		});
		if (res.ok) {
			const { bookmarked } = (await res.json()) as { bookmarked: boolean };
			bookmarkedIds = bookmarked
				? [...bookmarkedIds, app.id]
				: bookmarkedIds.filter((id) => id !== app.id);
			await invalidateAll();
		}
	}

	return {
		get apps() { return apps; },
		get bookmarkedIds() { return bookmarkedIds; },
		get creating() { return creating; },
		createApp,
		toggleBookmark,
	};
}
