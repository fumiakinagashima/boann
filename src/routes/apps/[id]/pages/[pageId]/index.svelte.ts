import { invalidateAll, goto } from '$app/navigation';
import { page } from '$app/state';
import { formatJstDateTime } from '$lib/datetime';
import type { FieldDef, RecordRow } from '$lib/server/db/table-service';
import { isRefField } from '$lib/types/chat';
import type { PageData } from './$types';
import type { RelatedSection } from './+page.server';

export type DrawerMode = 'new' | 'edit';

export type Drawer = {
	mode: DrawerMode;
	tableId: string;
	tableName: string;
	fields: FieldDef[];
	recordOptions: Record<string, { value: string; label: string }[]>;
	editingId: string | null;
	formData: Record<string, string>;
	saving: boolean;
	saveError: string;
	deleting: boolean;
};

export function createPageViewState(getData: () => PageData) {
	let drawer = $state<Drawer | null>(null);

	// 一覧ビュー か 詳細ビュー か
	const recordId = $derived(page.url.searchParams.get('recordId'));
	const isDetail = $derived(!!recordId);

	// ── ドロワー（登録・編集）────────────────────────────────────
	function openNew(tableId: string, tableName: string, fields: FieldDef[], recordOptions: Record<string, { value: string; label: string }[]>, overrides: Record<string, string> = {}) {
		const init: Record<string, string> = {};
		for (const f of fields) init[f.key] = f.defaultValue ?? '';
		Object.assign(init, overrides);
		drawer = { mode: 'new', tableId, tableName, fields, recordOptions, editingId: null, formData: init, saving: false, saveError: '', deleting: false };
	}

	function openEdit(tableId: string, tableName: string, fields: FieldDef[], recordOptions: Record<string, { value: string; label: string }[]>, row: RecordRow) {
		const init: Record<string, string> = {};
		for (const f of fields) {
			const v = row[f.key];
			init[f.key] = v != null ? String(v) : (f.defaultValue ?? '');
		}
		drawer = { mode: 'edit', tableId, tableName, fields, recordOptions, editingId: row.id as string, formData: init, saving: false, saveError: '', deleting: false };
	}

	function closeDrawer() { drawer = null; }

	async function saveRecord() {
		if (!drawer) return;
		drawer.saving = true;
		drawer.saveError = '';
		try {
			const url = drawer.mode === 'new'
				? `/api/database/${drawer.tableName}/records`
				: `/api/database/${drawer.tableName}/records/${drawer.editingId}`;
			const res = await fetch(url, {
				method: drawer.mode === 'new' ? 'POST' : 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(drawer.formData)
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				drawer.saveError = body.error ?? '保存に失敗しました';
				return;
			}
			closeDrawer();
			await invalidateAll();
		} finally {
			if (drawer) drawer.saving = false;
		}
	}

	async function deleteRecord() {
		if (!drawer?.editingId) return;
		if (!confirm('このレコードを削除しますか？')) return;
		drawer.deleting = true;
		try {
			const res = await fetch(`/api/database/${drawer.tableName}/records/${drawer.editingId}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				closeDrawer();
				await invalidateAll();
			}
		} finally {
			if (drawer) drawer.deleting = false;
		}
	}

	// ── 詳細ビューナビゲーション ─────────────────────────────────
	function openDetail(id: string) {
		const u = new URL(page.url);
		u.searchParams.set('recordId', id);
		goto(u.toString());
	}

	function closeDetail() {
		const fromUrl = page.url.searchParams.get('from');
		if (fromUrl) {
			goto(fromUrl);
		} else {
			const u = new URL(page.url);
			u.searchParams.delete('recordId');
			goto(u.toString());
		}
	}

	// ── セル表示 ─────────────────────────────────────────────────
	function formatCell(row: RecordRow, field: FieldDef, recordOptions: Record<string, { value: string; label: string }[]>): string {
		const val = row[field.key];
		if (val == null || val === '') return '—';
		if (isRefField(field.type)) {
			const opts = recordOptions[field.key] ?? [];
			const opt = opts.find(o => o.value === String(val));
			return opt ? opt.label : String(val);
		}
		if (field.type === 'select') {
			const opt = (field.options ?? []).find(o => o.value === String(val));
			return opt ? opt.label : String(val);
		}
		if (field.type === 'date' && typeof val === 'number') {
			return new Date(val * 1000).toLocaleDateString('ja-JP');
		}
		if (field.type === 'timestamp' && typeof val === 'number') {
			return formatJstDateTime(new Date(val * 1000));
		}
		return String(val);
	}

	function formatTs(ts: number | null | undefined): string {
		if (!ts) return '—';
		return formatJstDateTime(new Date(ts * 1000));
	}

	// 詳細ビュー: フィールド表示値
	function displayValue(val: unknown, field: FieldDef, recordOptions: Record<string, { value: string; label: string }[]>): string {
		if (val == null || val === '') return '—';
		if (isRefField(field.type)) {
			const opts = recordOptions[field.key] ?? [];
			const opt = opts.find(o => o.value === String(val));
			return opt ? opt.label : String(val);
		}
		if (field.type === 'select') {
			const opt = (field.options ?? []).find(o => o.value === String(val));
			return opt ? opt.label : String(val);
		}
		if (field.type === 'date' && typeof val === 'number') {
			return new Date(val * 1000).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
		}
		if (field.type === 'timestamp' && typeof val === 'number') {
			return formatJstDateTime(new Date(val * 1000));
		}
		return String(val);
	}

	return {
		get drawer() { return drawer; },
		get isDetail() { return isDetail; },
		get recordId() { return recordId; },
		openNew,
		openEdit,
		closeDrawer,
		saveRecord,
		deleteRecord,
		openDetail,
		closeDetail,
		formatCell,
		formatTs,
		displayValue,
	};
}
