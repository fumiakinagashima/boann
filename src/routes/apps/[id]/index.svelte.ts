import { goto, invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

// テーブル／ワークフローの2種別（D&D並べ替えのキーに使用）
export type AppTab = 'tables' | 'workflows';

export function createAppBuilderState(getData: () => PageData) {
	// ── App meta ─────────────────────────────────────────────────
	let appLabel = $state(getData().app.label);
	let appIcon = $state(getData().app.icon ?? 'layout-grid');
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let deleting = $state(false);

	$effect(() => {
		appLabel = getData().app.label;
		appIcon = getData().app.icon ?? 'layout-grid';
	});

	function markDirty() { dirty = true; saved = false; }

	async function save() {
		if (!appLabel.trim()) return;
		saving = true;
		try {
			await fetch(`/api/apps/${getData().app.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: appLabel.trim(), icon: appIcon })
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

	// ── List ordering (drag & drop) ──────────────────────────────
	// data からローカルにコピーし、D&D 中は楽観的に並べ替える。保存後 invalidateAll で確定。
	let tables = $state(getData().tables);
	let workflows = $state(getData().workflows);

	$effect(() => {
		tables = getData().tables;
		workflows = getData().workflows;
	});

	let dragKind = $state<AppTab | null>(null);
	let dragId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function onDragStart(kind: AppTab, id: string, e: DragEvent) {
		dragKind = kind;
		dragId = id;
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragOver(kind: AppTab, id: string, e: DragEvent) {
		if (dragKind !== kind) return;
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		if (id !== dragId) dragOverId = id;
	}

	function onDragEnd() {
		dragKind = null;
		dragId = null;
		dragOverId = null;
	}

	function reorderList<T extends { id: string }>(arr: T[], srcId: string, targetId: string): T[] {
		const from = arr.findIndex((x) => x.id === srcId);
		const to = arr.findIndex((x) => x.id === targetId);
		if (from === -1 || to === -1) return arr;
		const next = [...arr];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		return next;
	}

	async function onDrop(kind: AppTab, targetId: string, e: DragEvent) {
		e.preventDefault();
		const srcId = dragId;
		const srcKind = dragKind;
		onDragEnd();
		if (srcKind !== kind || !srcId || srcId === targetId) return;

		let orderedIds: string[];
		if (kind === 'tables') {
			tables = reorderList(tables, srcId, targetId);
			orderedIds = tables.map((t) => t.id);
		} else {
			workflows = reorderList(workflows, srcId, targetId);
			orderedIds = workflows.map((w) => w.id);
		}

		await fetch(`/api/apps/${getData().app.id}/reorder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kind, orderedIds })
		});
		await invalidateAll();
	}


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

	// ── トークン管理（MCP連携） ─────────────────────────────────────
	let mcpStatus = $state(getData().mcpStatus);
	let issuingMcpToken = $state(false);
	let issuedMcpToken = $state<string | null>(null); // 発行直後の平文。表示後は破棄する
	let mcpTokenCopied = $state(false);

	$effect(() => {
		mcpStatus = getData().mcpStatus;
	});

	async function issueMcpToken() {
		issuingMcpToken = true;
		try {
			const res = await fetch(`/api/apps/${getData().app.id}/mcp-token`, { method: 'POST' });
			if (res.ok) {
				const body = await res.json() as { token: string };
				issuedMcpToken = body.token;
				await invalidateAll();
			}
		} finally {
			issuingMcpToken = false;
		}
	}

	async function reissueMcpToken() {
		if (!confirm('トークンを再発行しますか？現在のトークンは無効になります。')) return;
		await issueMcpToken();
	}

	async function deleteMcpToken() {
		if (!confirm('MCPトークンを削除しますか？連携中のエージェントからアクセスできなくなります。')) return;
		await fetch(`/api/apps/${getData().app.id}/mcp-token`, { method: 'DELETE' });
		await invalidateAll();
	}

	function dismissIssuedMcpToken() {
		issuedMcpToken = null;
		mcpTokenCopied = false;
	}

	async function copyMcpToken() {
		if (!issuedMcpToken) return;
		await navigator.clipboard.writeText(issuedMcpToken);
		mcpTokenCopied = true;
		setTimeout(() => (mcpTokenCopied = false), 2000);
	}

	const chatContext = $derived({
		appId: getData().app.id,
		appLabel: getData().app.label,
		appName: getData().app.name,
		tables: getData().tables.map((t) => ({ id: t.id, name: t.name, label: t.label }))
	});

	return {
		get appLabel() { return appLabel; },
		set appLabel(v) { appLabel = v; },
		get appIcon() { return appIcon; },
		set appIcon(v) { appIcon = v; },
		get dirty() { return dirty; },
		get saving() { return saving; },
		get saved() { return saved; },
		get deleting() { return deleting; },
		get addingTable() { return addingTable; },
		get addingWorkflow() { return addingWorkflow; },
		get chatContext() { return chatContext; },
		get tables() { return tables; },
		get workflows() { return workflows; },
		get dragOverId() { return dragOverId; },
		get mcpStatus() { return mcpStatus; },
		get issuingMcpToken() { return issuingMcpToken; },
		get issuedMcpToken() { return issuedMcpToken; },
		get mcpTokenCopied() { return mcpTokenCopied; },
		markDirty,
		save,
		deleteApp,
		addTable,
		addWorkflow,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
		issueMcpToken,
		reissueMcpToken,
		deleteMcpToken,
		dismissIssuedMcpToken,
		copyMcpToken,
	};
}
