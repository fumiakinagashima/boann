import { invalidateAll } from '$app/navigation';
import type { PageComponent, FieldDef } from '$lib/server/db/table-service';
import type { PageData } from './$types';

export type LocalComponent = PageComponent & { expanded: boolean };

export function createPageBuildState(getData: () => PageData) {
	let pageLabel = $state(getData().page.label);
	let components = $state<LocalComponent[]>(
		getData().page.components.map(c => ({ ...c, expanded: false }))
	);
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);

	function markDirty() { dirty = true; saved = false; }

	// ── Save ─────────────────────────────────────────────────────
	async function save() {
		if (!pageLabel.trim()) return;
		saving = true;
		try {
			const payload = {
				label: pageLabel.trim(),
				components: components.map(({ expanded, ...c }) => ({
					...c,
					title: c.title || null,
					fields: (c.fields?.length) ? c.fields : null
				}))
			};
			const res = await fetch(`/api/apps/${getData().app.id}/pages/${getData().page.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
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


	// ── Components ───────────────────────────────────────────────
	function addComponent() {
		const firstTable = getData().tables[0];
		if (!firstTable) return;
		components = [...components, {
			id: crypto.randomUUID(),
			type: 'list',
			tableId: firstTable.id,
			title: null,
			fields: null,
			actions: ['create', 'edit', 'delete'],
			expanded: true
		}];
		markDirty();
	}

	function removeComponent(id: string) {
		components = components.filter(c => c.id !== id);
		markDirty();
	}

	function toggleExpand(id: string) {
		components = components.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c);
	}

	function moveUp(idx: number) {
		if (idx === 0) return;
		const arr = [...components];
		[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
		components = arr;
		markDirty();
	}

	function moveDown(idx: number) {
		if (idx === components.length - 1) return;
		const arr = [...components];
		[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
		components = arr;
		markDirty();
	}

	function updateComponent(id: string, patch: Partial<LocalComponent>) {
		components = components.map(c => c.id === id ? { ...c, ...patch } : c);
		markDirty();
	}

	function toggleAction(compId: string, action: 'create' | 'edit' | 'delete') {
		const comp = components.find(c => c.id === compId);
		if (!comp) return;
		const current = comp.actions ?? [];
		const next = current.includes(action)
			? current.filter(a => a !== action)
			: [...current, action];
		updateComponent(compId, { actions: next });
	}

	function toggleField(compId: string, fieldKey: string, tableFields: FieldDef[]) {
		const comp = components.find(c => c.id === compId);
		if (!comp) return;
		const currentFields = comp.fields ?? [];
		if (currentFields.length === 0) {
			const next = tableFields.map(f => f.key).filter(k => k !== fieldKey);
			updateComponent(compId, { fields: next.length === tableFields.length - 1 ? next : null });
		} else if (currentFields.includes(fieldKey)) {
			const next = currentFields.filter(k => k !== fieldKey);
			updateComponent(compId, { fields: next.length > 0 ? next : null });
		} else {
			const next = [...currentFields, fieldKey];
			const isAll = tableFields.every(f => next.includes(f.key));
			updateComponent(compId, { fields: isAll ? null : next });
		}
	}

	function getTableFields(tableId: string): FieldDef[] {
		return (getData().tableFields as Record<string, FieldDef[]>)[tableId] ?? [];
	}

	function isFieldShown(comp: LocalComponent, fieldKey: string): boolean {
		if (!comp.fields?.length) return true;
		return comp.fields.includes(fieldKey);
	}

	function getTableLabel(tableId: string): string {
		return getData().tables.find(t => t.id === tableId)?.label ?? tableId;
	}

	function getDisplaySummary(comp: LocalComponent): string {
		const fields = comp.fields?.length
			? `${comp.fields.length}フィールド`
			: '全フィールド';
		const actions = (comp.actions ?? []).map(a =>
			a === 'create' ? '作成' : a === 'edit' ? '編集' : '削除'
		).join('・') || 'アクションなし';
		return `${fields} / ${actions}`;
	}

	return {
		get pageLabel() { return pageLabel; },
		set pageLabel(v) { pageLabel = v; },
		get components() { return components; },
		get dirty() { return dirty; },
		get saving() { return saving; },
		get saved() { return saved; },
		markDirty,
		save,
		addComponent,
		removeComponent,
		toggleExpand,
		moveUp,
		moveDown,
		updateComponent,
		toggleAction,
		toggleField,
		getTableFields,
		isFieldShown,
		getTableLabel,
		getDisplaySummary,
	};
}
