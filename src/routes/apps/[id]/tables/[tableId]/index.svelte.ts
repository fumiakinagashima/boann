import { invalidateAll } from '$app/navigation';
import { formatJstDateTime } from '$lib/datetime';
import type { FieldDef, RecordRow } from '$lib/server/db/table-service';
import { isRefField } from '$lib/types/chat';
import type { PageData } from './$types';

export type FormMode = 'new' | 'edit';

export function createTableRecordsState(getData: () => PageData) {
	let records = $state<RecordRow[]>(getData().records);
	$effect(() => { records = getData().records; });

	const recordOptions = $derived(getData().recordOptions as Record<string, { value: string; label: string }[]>);
	const fields = $derived(getData().fields as FieldDef[]);
	const listFields = $derived(fields.filter((f) => f.listable !== false).slice(0, 7));

	// ── Form panel ───────────────────────────────────────────────
	let formMode = $state<FormMode>('new');
	let formOpen = $state(false);
	let formData = $state<Record<string, string>>({});
	let editingId = $state<string | null>(null);
	let saving = $state(false);
	let saveError = $state('');
	let deleting = $state(false);

	function openNew() {
		formMode = 'new';
		editingId = null;
		saveError = '';
		const init: Record<string, string> = {};
		for (const f of fields) init[f.key] = f.defaultValue ?? '';
		formData = init;
		formOpen = true;
	}

	function openEdit(row: RecordRow) {
		formMode = 'edit';
		editingId = row.id as string;
		saveError = '';
		const init: Record<string, string> = {};
		for (const f of fields) {
			const v = row[f.key];
			init[f.key] = v != null ? String(v) : (f.defaultValue ?? '');
		}
		formData = init;
		formOpen = true;
	}

	function closeForm() {
		formOpen = false;
		editingId = null;
	}

	async function saveRecord() {
		saving = true;
		saveError = '';
		try {
			const appName = getData().app.name;
			const appId = getData().appId;
			const url = formMode === 'new'
				? `/api/database/${appName}/records?appId=${appId}`
				: `/api/database/${appName}/records/${editingId}?appId=${appId}`;
			const res = await fetch(url, {
				method: formMode === 'new' ? 'POST' : 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				saveError = body.error ?? '保存に失敗しました';
				return;
			}
			closeForm();
			await invalidateAll();
		} finally {
			saving = false;
		}
	}

	async function deleteRecord() {
		if (!confirm('このレコードを削除しますか？')) return;
		deleting = true;
		try {
			const appName = getData().app.name;
			const appId = getData().appId;
			const res = await fetch(`/api/database/${appName}/records/${editingId}?appId=${appId}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				closeForm();
				await invalidateAll();
			}
		} finally {
			deleting = false;
		}
	}

	function formatCell(row: RecordRow, field: FieldDef): string {
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
		return String(val);
	}

	function formatTs(ts: number | null | undefined): string {
		if (!ts) return '—';
		return formatJstDateTime(new Date(ts * 1000));
	}

	return {
		get records() { return records; },
		get recordOptions() { return recordOptions; },
		get fields() { return fields; },
		get listFields() { return listFields; },
		get formMode() { return formMode; },
		get formOpen() { return formOpen; },
		get formData() { return formData; },
		get editingId() { return editingId; },
		get saving() { return saving; },
		get saveError() { return saveError; },
		get deleting() { return deleting; },
		openNew,
		openEdit,
		closeForm,
		saveRecord,
		deleteRecord,
		formatCell,
		formatTs,
	};
}
