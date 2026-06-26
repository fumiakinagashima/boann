import { goto, invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

export const CHAT_MIN = 220;
export const CHAT_MAX = 640;

export type AppTab = 'tables' | 'pages' | 'workflows';

export function createAppBuilderState(getData: () => PageData) {
	// ── App meta + spec (unified) ────────────────────────────────
	let appLabel = $state(getData().app.label);
	let appIcon = $state(getData().app.icon ?? 'layout-grid');
	let spec = $state(getData().app.spec ?? '');
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let deleting = $state(false);
	let aiTrigger = $state<string | null>(null);

	$effect(() => {
		appLabel = getData().app.label;
		appIcon = getData().app.icon ?? 'layout-grid';
		spec = getData().app.spec ?? '';
	});

	function markDirty() { dirty = true; saved = false; }

	async function save() {
		if (!appLabel.trim()) return;
		saving = true;
		try {
			await fetch(`/api/apps/${getData().app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: appLabel.trim(), icon: appIcon, spec })
			});
			await invalidateAll();
			dirty = false;
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} finally {
			saving = false;
		}
	}

	async function deleteApp() {
		if (!confirm(`「${appLabel}」を削除しますか？この操作は元に戻せません。`)) return;
		deleting = true;
		try {
			const res = await fetch(`/api/apps/${getData().app.id}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) goto('/');
		} finally {
			deleting = false;
		}
	}

	async function generateFromSpec() {
		if (!spec.trim()) return;
		await save();
		aiTrigger = `以下の仕様書に基づいて、このアプリのテーブルとページを設計・作成してください:\n\n${spec}`;
	}

	function clearTrigger() { aiTrigger = null; }

	// ── Tabs ─────────────────────────────────────────────────────
	let activeTab = $state<AppTab>('tables');

	// ── Add table ─────────────────────────────────────────────────
	let addingTable = $state(false);

	async function addTable() {
		addingTable = true;
		const name = 'table_' + Date.now();
		const res = await fetch('/api/database/tables', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, label: '新しいテーブル', appId: getData().app.id, fields: [] })
		});
		if (res.ok) {
			await invalidateAll();
		}
		addingTable = false;
	}

	// ── Add page ──────────────────────────────────────────────────
	let addingPage = $state(false);

	async function addPage() {
		addingPage = true;
		try {
			const res = await fetch(`/api/apps/${getData().app.id}/pages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: '新しいページ', components: [] })
			});
			if (res.ok) await invalidateAll();
		} finally {
			addingPage = false;
		}
	}

	// ── Add workflow ─────────────────────────────────────────────
	let addingWorkflow = $state(false);

	async function addWorkflow() {
		addingWorkflow = true;
		try {
			const res = await fetch('/api/workflows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: '新しいワークフロー', appId: getData().app.id })
			});
			if (res.ok) await invalidateAll();
		} finally {
			addingWorkflow = false;
		}
	}

	// ── Resizable split ──────────────────────────────────────────
	let chatWidth = $state(340);
	let resizing = $state(false);

	function onResizerMouseDown(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startWidth = chatWidth;
		function onMove(ev: MouseEvent) {
			const delta = startX - ev.clientX;
			chatWidth = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth + delta));
		}
		function onUp() {
			resizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	const chatContext = $derived({
		appId: getData().app.id,
		appLabel: getData().app.label,
		appName: getData().app.name,
		spec: getData().app.spec,
		tables: getData().tables.map((t) => ({ id: t.id, name: t.name, label: t.label }))
	});

	return {
		get appLabel() { return appLabel; },
		set appLabel(v) { appLabel = v; },
		get appIcon() { return appIcon; },
		set appIcon(v) { appIcon = v; },
		get spec() { return spec; },
		set spec(v) { spec = v; },
		get dirty() { return dirty; },
		get saving() { return saving; },
		get saved() { return saved; },
		get deleting() { return deleting; },
		get aiTrigger() { return aiTrigger; },
		get activeTab() { return activeTab; },
		set activeTab(v) { activeTab = v; },
		get addingTable() { return addingTable; },
		get addingPage() { return addingPage; },
		get addingWorkflow() { return addingWorkflow; },
		get chatWidth() { return chatWidth; },
		get resizing() { return resizing; },
		get chatContext() { return chatContext; },
		markDirty,
		save,
		deleteApp,
		generateFromSpec,
		clearTrigger,
		addTable,
		addPage,
		addWorkflow,
		onResizerMouseDown,
	};
}
