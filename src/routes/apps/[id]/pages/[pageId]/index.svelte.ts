import { invalidateAll } from '$app/navigation';
import { formatJstDateTime } from '$lib/datetime';
import type { FieldDef, RecordRow } from '$lib/server/db/table-service';
import type { PageData } from './$types';
import type { ComponentData } from './+page.server';

export type ActiveEdit = {
	compIdx: number;
	mode: 'new' | 'edit';
	editingId: string | null;
	formData: Record<string, string>;
	saving: boolean;
	saveError: string;
	deleting: boolean;
};

export type FormSubmitState = { submitting: boolean; done: boolean; error: string };

export function createPageViewState(getData: () => PageData) {
	let componentData = $state(getData().componentData);
	$effect(() => { componentData = getData().componentData; });

	// ── Shared form drawer ───────────────────────────────────────
	let activeEdit = $state<ActiveEdit | null>(null);

	function openNew(compIdx: number) {
		const comp = componentData[compIdx];
		const init: Record<string, string> = {};
		for (const f of comp.fields) init[f.key] = f.defaultValue ?? '';
		activeEdit = { compIdx, mode: 'new', editingId: null, formData: init, saving: false, saveError: '', deleting: false };
	}

	function openEdit(compIdx: number, row: RecordRow) {
		const comp = componentData[compIdx];
		const init: Record<string, string> = {};
		for (const f of comp.fields) {
			const v = row[f.key];
			init[f.key] = v != null ? String(v) : (f.defaultValue ?? '');
		}
		activeEdit = { compIdx, mode: 'edit', editingId: row.id as string, formData: init, saving: false, saveError: '', deleting: false };
	}

	function closeForm() { activeEdit = null; }

	async function saveRecord() {
		if (!activeEdit) return;
		activeEdit.saving = true;
		activeEdit.saveError = '';
		try {
			const comp = componentData[activeEdit.compIdx];
			const url = activeEdit.mode === 'new'
				? `/api/database/${comp.tableName}/records`
				: `/api/database/${comp.tableName}/records/${activeEdit.editingId}`;
			const res = await fetch(url, {
				method: activeEdit.mode === 'new' ? 'POST' : 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(activeEdit.formData)
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				activeEdit.saveError = body.error ?? '保存に失敗しました';
				return;
			}
			closeForm();
			await invalidateAll();
		} finally {
			if (activeEdit) activeEdit.saving = false;
		}
	}

	async function deleteRecord() {
		if (!activeEdit?.editingId) return;
		if (!confirm('このレコードを削除しますか？')) return;
		activeEdit.deleting = true;
		try {
			const comp = componentData[activeEdit.compIdx];
			const res = await fetch(`/api/database/${comp.tableName}/records/${activeEdit.editingId}`, { method: 'DELETE' });
			if (res.ok || res.status === 204) {
				closeForm();
				await invalidateAll();
			}
		} finally {
			if (activeEdit) activeEdit.deleting = false;
		}
	}

	// ── Standalone form ──────────────────────────────────────────
	let formSubmitState = $state<Record<number, FormSubmitState>>({});

	function getFormSubmitState(idx: number): FormSubmitState {
		return formSubmitState[idx] ?? { submitting: false, done: false, error: '' };
	}

	async function submitStandaloneForm(compIdx: number, formEl: HTMLFormElement) {
		const comp = componentData[compIdx];
		formSubmitState = { ...formSubmitState, [compIdx]: { submitting: true, done: false, error: '' } };
		try {
			const data: Record<string, string> = {};
			for (const f of comp.fields) {
				const el = formEl.elements.namedItem(f.key) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
				if (el) data[f.key] = el.value;
			}
			const res = await fetch(`/api/database/${comp.tableName}/records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string };
				formSubmitState = { ...formSubmitState, [compIdx]: { submitting: false, done: false, error: body.error ?? '保存に失敗しました' } };
				return;
			}
			formEl.reset();
			formSubmitState = { ...formSubmitState, [compIdx]: { submitting: false, done: true, error: '' } };
			setTimeout(() => {
				formSubmitState = { ...formSubmitState, [compIdx]: { submitting: false, done: false, error: '' } };
			}, 2500);
			await invalidateAll();
		} finally {
			if (!formSubmitState[compIdx]?.done) {
				formSubmitState = { ...formSubmitState, [compIdx]: { ...(formSubmitState[compIdx] ?? {}), submitting: false, done: false, error: '' } };
			}
		}
	}

	// ── Cell formatting ──────────────────────────────────────────
	function formatCell(row: RecordRow, field: FieldDef, comp: ComponentData): string {
		const val = row[field.key];
		if (val == null || val === '') return '—';
		if (field.type === 'recordSelect') {
			const opts = comp.recordOptions[field.key] ?? [];
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

	const activeFields = $derived(activeEdit ? componentData[activeEdit.compIdx]?.fields ?? [] : []);
	const activeRecordOptions = $derived(activeEdit ? componentData[activeEdit.compIdx]?.recordOptions ?? {} : {});

	return {
		get componentData() { return componentData; },
		get activeEdit() { return activeEdit; },
		get activeFields() { return activeFields; },
		get activeRecordOptions() { return activeRecordOptions; },
		openNew,
		openEdit,
		closeForm,
		saveRecord,
		deleteRecord,
		getFormSubmitState,
		submitStandaloneForm,
		formatCell,
		formatTs,
	};
}
