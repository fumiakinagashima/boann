import { invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

export const CHAT_MIN = 220;
export const CHAT_MAX = 640;

export type AppTab = 'tables' | 'pages' | 'workflows';

export function createAppBuilderState(getData: () => PageData) {
	// ── App meta ────────────────────────────────────────────────
	let appLabel = $state(getData().app.label);
	let appIcon = $state(getData().app.icon ?? 'layout-grid');
	let metaDirty = $state(false);
	let savingMeta = $state(false);
	let metaSaved = $state(false);

	$effect(() => {
		appLabel = getData().app.label;
		appIcon = getData().app.icon ?? 'layout-grid';
	});

	async function saveMeta() {
		if (!appLabel.trim()) return;
		savingMeta = true;
		try {
			await fetch(`/api/apps/${getData().app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: appLabel.trim(), icon: appIcon })
			});
			await invalidateAll();
			metaDirty = false;
			metaSaved = true;
			setTimeout(() => (metaSaved = false), 2000);
		} finally {
			savingMeta = false;
		}
	}

	// ── Spec editor ─────────────────────────────────────────────
	let spec = $state(getData().app.spec ?? '');
	let saving = $state(false);
	let saved = $state(false);
	let aiTrigger = $state<string | null>(null);

	$effect(() => { spec = getData().app.spec ?? ''; });

	async function saveSpec() {
		saving = true;
		try {
			await fetch(`/api/apps/${getData().app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ spec })
			});
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} finally {
			saving = false;
		}
	}

	async function generateFromSpec() {
		if (!spec.trim()) return;
		await saveSpec();
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

	function padTime(n: number) { return String(n).padStart(2, '0'); }

	return {
		get appLabel() { return appLabel; },
		set appLabel(v) { appLabel = v; },
		get appIcon() { return appIcon; },
		set appIcon(v) { appIcon = v; },
		get metaDirty() { return metaDirty; },
		set metaDirty(v) { metaDirty = v; },
		get savingMeta() { return savingMeta; },
		get metaSaved() { return metaSaved; },
		get spec() { return spec; },
		set spec(v) { spec = v; },
		get saving() { return saving; },
		get saved() { return saved; },
		get aiTrigger() { return aiTrigger; },
		get activeTab() { return activeTab; },
		set activeTab(v) { activeTab = v; },
		get addingTable() { return addingTable; },
		get chatWidth() { return chatWidth; },
		get resizing() { return resizing; },
		get chatContext() { return chatContext; },
		saveMeta,
		saveSpec,
		generateFromSpec,
		clearTrigger,
		addTable,
		onResizerMouseDown,
		padTime,
	};
}
