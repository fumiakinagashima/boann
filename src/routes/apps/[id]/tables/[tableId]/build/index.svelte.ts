import { invalidateAll } from '$app/navigation';
import { tick, untrack } from 'svelte';
import type { PageData } from './$types';

export const FIELD_TYPES = [
	{ value: 'text',         label: 'テキスト' },
	{ value: 'textarea',     label: '長文テキスト' },
	{ value: 'number',       label: '数値' },
	{ value: 'date',         label: '日付' },
	{ value: 'select',       label: '選択肢' },
	{ value: 'email',        label: 'メールアドレス' },
	{ value: 'tel',          label: '電話番号' },
	{ value: 'recordSelect', label: 'リレーション' },
	{ value: 'account',      label: 'アカウント' },
] as const;

export type SelectOption = { label: string; value: string };

export type FieldRow = {
	_id: string;
	label: string;
	key: string;
	type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'email' | 'tel' | 'recordSelect' | 'account';
	required: boolean;
	defaultValue: string;
	description: string;
	options: SelectOption[];
	refTable: string;
	refLabelKey: string;
};

function slugify(s: string): string {
	return s.toLowerCase()
		.replace(/[\s　]+/g, '_')
		.replace(/[^a-z0-9_]/g, '')
		.replace(/^_+|_+$/g, '');
}

// 日本語ラベル等、slugify結果が空になる入力に対するフォールバック。
// 生のラベルをそのままkeyにしてしまうと日本語キーになってしまうため、ランダムな文字列にする。
function randomSlug(prefix: string): string {
	return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}


export function createTableBuildState(getData: () => PageData) {
	// ── Meta ─────────────────────────────────────────────────────
	let appLabel = $state(getData().app.label);
	let mcpCreate = $state(getData().app.mcpCreate);
	let mcpRead = $state(getData().app.mcpRead);
	let mcpUpdate = $state(getData().app.mcpUpdate);
	let mcpDelete = $state(getData().app.mcpDelete);

	// サーバーデータが変わったとき、未保存変更がなければラベル・MCP設定を同期する
	$effect(() => {
		const server = getData().app;
		if (!untrack(() => dirty) && !untrack(() => saving)) {
			appLabel = server.label;
			mcpCreate = server.mcpCreate;
			mcpRead = server.mcpRead;
			mcpUpdate = server.mcpUpdate;
			mcpDelete = server.mcpDelete;
		}
	});

	// ── Fields ───────────────────────────────────────────────────
	function fromServerFields(): FieldRow[] {
		return getData().fields.map((f) => ({
			_id: crypto.randomUUID(),
			label: f.label,
			key: f.key,
			type: f.type as FieldRow['type'],
			required: f.required ?? false,
			defaultValue: f.defaultValue ?? '',
			description: f.description ?? '',
			options: (f.options as SelectOption[]) ?? [],
			refTable: f.refTable ?? '',
			refLabelKey: f.refLabelKey ?? '',
		}));
	}

	let rows = $state<FieldRow[]>(fromServerFields());
	let dirty = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let saveError = $state('');
	let expandedId = $state<string | null>(null);

	// dirty=true または saving=true のときはリセットしない（AIチャットのinvalidateAll等で変更が消えないよう）
	$effect(() => {
		const serverKeys = getData().fields.map((f) => f.key).sort().join(',');
		const localKeys = untrack(() => rows.map((r) => r.key).sort().join(','));
		if (serverKeys !== localKeys && !untrack(() => dirty) && !untrack(() => saving)) {
			rows = fromServerFields();
			dirty = false;
		}
	});

	function markDirty() { dirty = true; saved = false; }

	// ── Unified save ─────────────────────────────────────────────
	async function save() {
		if (!appLabel.trim()) return;
		const validRows = rows.filter((r) => r.label.trim() && r.key.trim());
		saving = true;
		saveError = '';
		try {
			const appId = getData().appId;
			const res = await fetch(`/api/database/tables/${getData().app.name}?appId=${appId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					label: appLabel.trim(),
					mcpCreate, mcpRead, mcpUpdate, mcpDelete,
					fields: validRows.map((r, i) => ({
						_id: r._id,
						key: r.key,
						label: r.label.trim(),
						type: r.type,
						required: r.required,
						options: r.options.filter(o => o.label.trim()),
						defaultValue: r.defaultValue || null,
						description: r.description || null,
						refTable: r.refTable || null,
						refLabelKey: r.refLabelKey || null,
						sortOrder: i
					}))
				})
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				saveError = body.error ?? '保存に失敗しました';
				return;
			}
			rows = validRows;
			dirty = false;
			saved = true;
			setTimeout(() => (saved = false), 2000);
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	function addField() {
		const newRow: FieldRow = {
			_id: crypto.randomUUID(), label: '', key: '', type: 'text',
			required: false, defaultValue: '', description: '', options: [], refTable: '', refLabelKey: ''
		};
		rows = [...rows, newRow];
		expandedId = newRow._id;
		markDirty();
		tick().then(() => {
			document.querySelector<HTMLInputElement>(`#label-${newRow._id}`)?.focus();
		});
	}

	function removeField(id: string) {
		rows = rows.filter((r) => r._id !== id);
		if (expandedId === id) expandedId = null;
		markDirty();
	}

	function onLabelInput(row: FieldRow, val: string) {
		const prevSlug = slugify(row.label);
		row.label = val;
		if (!row.key || row.key === prevSlug) {
			row.key = slugify(val) || randomSlug('field_');
		}
		markDirty();
	}

	// ── Select options ───────────────────────────────────────────
	function addOption(row: FieldRow) {
		row.options = [...row.options, { label: '', value: '' }];
		markDirty();
	}

	function onOptionLabelInput(row: FieldRow, idx: number, val: string) {
		const prevSlug = slugify(row.options[idx].label);
		row.options[idx].label = val;
		if (!row.options[idx].value || row.options[idx].value === prevSlug) {
			row.options[idx].value = slugify(val) || randomSlug('opt_');
		}
		markDirty();
	}

	function onOptionValueInput(row: FieldRow, idx: number, val: string) {
		row.options[idx].value = val;
		markDirty();
	}

	function removeOption(row: FieldRow, idx: number) {
		row.options = row.options.filter((_, i) => i !== idx);
		markDirty();
	}

	function typeLabel(type: string) {
		return FIELD_TYPES.find(t => t.value === type)?.label ?? type;
	}

	// ── Relation combobox ────────────────────────────────────────
	let refTableQuery = $state('');
	let refTableDropdownOpen = $state(false);

	function refTableLabel(name: string): string {
		return getData().otherApps.find(a => a.name === name)?.label ?? '';
	}

	// ── Drag & drop reorder ──────────────────────────────────────
	let dragSrcId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function onDragStart(e: DragEvent, id: string) {
		dragSrcId = id;
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragOver(e: DragEvent, id: string) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		if (id !== dragSrcId) dragOverId = id;
	}

	function onDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		if (!dragSrcId || dragSrcId === targetId) return;
		const from = rows.findIndex(r => r._id === dragSrcId);
		const to   = rows.findIndex(r => r._id === targetId);
		if (from === -1 || to === -1) return;
		const next = [...rows];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		rows = next;
		markDirty();
		dragSrcId = null;
		dragOverId = null;
	}

	function onDragEnd() {
		dragSrcId = null;
		dragOverId = null;
	}

	return {
		get appLabel() { return appLabel; },
		set appLabel(v: string) { appLabel = v; markDirty(); },
		get mcpCreate() { return mcpCreate; },
		set mcpCreate(v: boolean) { mcpCreate = v; markDirty(); },
		get mcpRead() { return mcpRead; },
		set mcpRead(v: boolean) { mcpRead = v; markDirty(); },
		get mcpUpdate() { return mcpUpdate; },
		set mcpUpdate(v: boolean) { mcpUpdate = v; markDirty(); },
		get mcpDelete() { return mcpDelete; },
		set mcpDelete(v: boolean) { mcpDelete = v; markDirty(); },
		get rows() { return rows; },
		get dirty() { return dirty; },
		get saving() { return saving; },
		get saved() { return saved; },
		get saveError() { return saveError; },
		get expandedId() { return expandedId; },
		set expandedId(v: string | null) { expandedId = v; },
		get refTableQuery() { return refTableQuery; },
		set refTableQuery(v: string) { refTableQuery = v; },
		get refTableDropdownOpen() { return refTableDropdownOpen; },
		set refTableDropdownOpen(v: boolean) { refTableDropdownOpen = v; },
		get dragSrcId() { return dragSrcId; },
		get dragOverId() { return dragOverId; },
		save,
		markDirty,
		addField,
		removeField,
		onLabelInput,
		addOption,
		onOptionLabelInput,
		onOptionValueInput,
		removeOption,
		typeLabel,
		refTableLabel,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
	};
}
