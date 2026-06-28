import { invalidateAll } from '$app/navigation';
import type { FieldDef, PageConfig } from '$lib/server/db/table-service';
import type { PageData } from './$types';

export function createPageBuildState(getData: () => PageData) {
	let pageLabel = $state(getData().page.label);
	let tableId = $state<string | null>(getData().page.tableId ?? null);
	let config = $state<PageConfig>(structuredClone(getData().page.config));
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);

	function markDirty() { dirty = true; saved = false; }

	// ── Save ─────────────────────────────────────────────────────
	async function save() {
		if (!pageLabel.trim()) return;
		saving = true;
		try {
			const res = await fetch(`/api/apps/${getData().app.id}/pages/${getData().page.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: pageLabel.trim(), tableId, config })
			});
			if (res.ok) {
				dirty = false;
				saved = true;
				setTimeout(() => (saved = false), 2000);
				await invalidateAll();
			}
		} finally {
			saving = false;
		}
	}

	// ── Table ─────────────────────────────────────────────────────
	function setTableId(id: string | null) {
		tableId = id;
		config = { ...config, fields: null, detail: { relatedTables: [] } };
		markDirty();
	}

	const tableFields = $derived<FieldDef[]>(
		tableId ? ((getData().tableFields as Record<string, FieldDef[]>)[tableId] ?? []) : []
	);

	// ── Fields ────────────────────────────────────────────────────
	function isFieldShown(fieldKey: string): boolean {
		if (!config.fields?.length) return true;
		return config.fields.includes(fieldKey);
	}

	function getTableFields(): FieldDef[] { return tableFields; }

	function toggleField(fieldKey: string) {
		const all = tableFields;
		const current = config.fields ?? [];
		let next: string[] | null;
		if (current.length === 0) {
			const excluded = all.map(f => f.key).filter(k => k !== fieldKey);
			next = excluded.length > 0 ? excluded : null;
		} else if (current.includes(fieldKey)) {
			const remaining = current.filter(k => k !== fieldKey);
			next = remaining.length > 0 ? remaining : null;
		} else {
			const added = [...current, fieldKey];
			next = all.every(f => added.includes(f.key)) ? null : added;
		}
		config = { ...config, fields: next };
		markDirty();
	}

	// ── Actions ───────────────────────────────────────────────────
	function toggleAction(action: 'detail' | 'create' | 'edit' | 'delete') {
		const current = config.actions;
		const next = current.includes(action)
			? current.filter(a => a !== action)
			: [...current, action];
		config = { ...config, actions: next };
		markDirty();
	}

	// ── Related tables (detail config) ───────────────────────────
	function isRelatedTableEnabled(refTableId: string, refFieldKey: string): boolean {
		return config.detail.relatedTables.some(
			r => r.tableId === refTableId && r.refFieldKey === refFieldKey
		);
	}

	function toggleRelatedTable(refTableId: string, refFieldKey: string, label: string) {
		const current = config.detail.relatedTables;
		const exists = current.find(r => r.tableId === refTableId && r.refFieldKey === refFieldKey);
		const next = exists
			? current.filter(r => !(r.tableId === refTableId && r.refFieldKey === refFieldKey))
			: [...current, { tableId: refTableId, refFieldKey, label, fields: null, actions: ['create', 'edit', 'delete'] as ('detail' | 'create' | 'edit' | 'delete')[] }];
		config = { ...config, detail: { ...config.detail, relatedTables: next } };
		markDirty();
	}

	function isRelatedTableActionEnabled(refTableId: string, refFieldKey: string, action: 'detail' | 'create' | 'edit' | 'delete'): boolean {
		const entry = config.detail.relatedTables.find(r => r.tableId === refTableId && r.refFieldKey === refFieldKey);
		return entry?.actions.includes(action) ?? false;
	}

	function toggleRelatedTableAction(refTableId: string, refFieldKey: string, action: 'detail' | 'create' | 'edit' | 'delete') {
		const next = config.detail.relatedTables.map(r => {
			if (r.tableId !== refTableId || r.refFieldKey !== refFieldKey) return r;
			const actions = r.actions.includes(action)
				? r.actions.filter(a => a !== action)
				: [...r.actions, action];
			return { ...r, actions };
		});
		config = { ...config, detail: { ...config.detail, relatedTables: next } };
		markDirty();
	}

	function getRelatedTableFields(refTableId: string): FieldDef[] {
		return ((getData().tableFields as Record<string, FieldDef[]>)[refTableId] ?? []);
	}

	function isRelatedTableFieldShown(refTableId: string, refFieldKey: string, fieldKey: string): boolean {
		const entry = config.detail.relatedTables.find(r => r.tableId === refTableId && r.refFieldKey === refFieldKey);
		if (!entry?.fields?.length) return true;
		return entry.fields.includes(fieldKey);
	}

	function toggleRelatedTableField(refTableId: string, refFieldKey: string, fieldKey: string) {
		const allKeys = getRelatedTableFields(refTableId).map(f => f.key);
		const next = config.detail.relatedTables.map(r => {
			if (r.tableId !== refTableId || r.refFieldKey !== refFieldKey) return r;
			const current = r.fields ?? [];
			let nextFields: string[] | null;
			if (current.length === 0) {
				const excluded = allKeys.filter(k => k !== fieldKey);
				nextFields = excluded.length > 0 ? excluded : null;
			} else if (current.includes(fieldKey)) {
				const remaining = current.filter(k => k !== fieldKey);
				nextFields = remaining.length > 0 ? remaining : null;
			} else {
				const added = [...current, fieldKey];
				nextFields = allKeys.every(k => added.includes(k)) ? null : added;
			}
			return { ...r, fields: nextFields };
		});
		config = { ...config, detail: { ...config.detail, relatedTables: next } };
		markDirty();
	}

	return {
		get pageLabel() { return pageLabel; },
		set pageLabel(v: string) { pageLabel = v; markDirty(); },
		get tableId() { return tableId; },
		get config() { return config; },
		get tableFields() { return tableFields; },
		get dirty() { return dirty; },
		get saving() { return saving; },
		get saved() { return saved; },
		setTableId,
		isFieldShown,
		toggleField,
		toggleAction,
		isRelatedTableEnabled,
		toggleRelatedTable,
		isRelatedTableActionEnabled,
		toggleRelatedTableAction,
		getRelatedTableFields,
		isRelatedTableFieldShown,
		toggleRelatedTableField,
		save,
	};
}
