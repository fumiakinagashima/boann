<script lang="ts">
	import Form from '$lib/components/chat/Form.svelte';
	import RecordDetail from './RecordDetail.svelte';
	import DialogChatSide from './DialogChatSide.svelte';
	import X from '$lib/components/icon/X.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { fieldDefsToFormFields, type RecordFormSpec } from './field-adapter';
	import type { FieldDef } from '$lib/server/db/table-service';
	import { toJstDatetimeLocal } from '$lib/datetime';
	import type { FormField } from '$lib/types/chat';

	type Props = {
		// テーブル種別。コア4種に限らずカスタム(entity)テーブル名も受け付ける
		type: string;
		recordId?: string | null;
		initialView?: 'detail' | 'form';
		prefill?: Record<string, string>;
		onclose: () => void;
		onSaved?: (record: Record<string, unknown>) => void;
		onDeleted?: (id: string) => void;
	};

	let { type, recordId = null, initialView = 'detail', prefill, onclose, onSaved, onDeleted }: Props = $props();

	type View =
		| { kind: 'detail' }
		| { kind: 'form'; type: string; mode: 'create' | 'edit'; recordId?: string; prefill?: Record<string, string> };

	let viewStack = $state<View[]>([]);
	let currentView = $derived(viewStack[viewStack.length - 1] ?? { kind: 'detail' });

	// 詳細 state
	let genericFields = $state<FieldDef[]>([]);
	let genericRecord = $state<Record<string, unknown> | null>(null);
	let detailLoading = $state(true);
	// テーブル表示名（カスタムテーブルは info から解決）
	let tableLabel = $state('');

	// フォーム state
	let formFields = $state<FormField[]>([]);
	let formLabel = $state('');
	let formLoading = $state(false);
	let formRef = $state<HTMLFormElement | null>(null);
	let formKey = $state(0);

	function labelFor(t: string): string {
		return (t === type ? tableLabel : '') || t;
	}

	async function loadDetail() {
		detailLoading = true;
		genericRecord = null;
		try {
			if (recordId) {
				const [infoRes, recRes] = await Promise.all([
					fetch(`/api/database/${type}/info`),
					fetch(`/api/database/${type}/records/${recordId}`)
				]);
				if (infoRes.ok && recRes.ok) {
					const { info } = (await infoRes.json()) as { info: { label: string; fields: FieldDef[] } };
					genericFields = info.fields;
					tableLabel = info.label;
					genericRecord = (await recRes.json()) as Record<string, unknown>;
				}
			}
		} catch {
			genericRecord = null;
		} finally {
			detailLoading = false;
		}
	}

	// props 変化（別レコードを開いた）でスタックを初期化
	$effect(() => {
		void type;
		void recordId;
		void initialView;
		if (initialView === 'form') {
			viewStack = [{ kind: 'form', type, mode: recordId ? 'edit' : 'create', recordId: recordId ?? undefined, prefill }];
		} else {
			viewStack = [{ kind: 'detail' }];
			loadDetail();
		}
	});

	// フォームビューに入ったらフィールド定義を取得し、値を注入
	$effect(() => {
		const view = currentView;
		if (view.kind !== 'form') return;
		let cancelled = false;
		formLoading = true;
		(async () => {
			try {
				const infoRes = await fetch(`/api/database/${view.type}/info`);
				const { info } = infoRes.ok
					? ((await infoRes.json()) as { info: { label: string; fields: FieldDef[] } })
					: { info: { label: labelFor(view.type), fields: [] as FieldDef[] } };
				let values: Record<string, unknown> = view.prefill ?? {};
				if (view.mode === 'edit' && view.recordId) {
					const recRes = await fetch(`/api/database/${view.type}/records/${view.recordId}`);
					if (recRes.ok) values = (await recRes.json()) as Record<string, unknown>;
				}
				if (view.mode === 'create') {
					// datetime-local フィールドにデフォルト値がなければ現在日時を設定
					for (const f of info.fields) {
						if (f.type === 'datetime-local' && (values[f.key] == null || values[f.key] === '')) {
							values = { ...values, [f.key]: toJstDatetimeLocal(new Date()) };
						}
					}
				}
				if (cancelled) return;
				formLabel = info.label ?? labelFor(view.type);
				formFields = fieldDefsToFormFields(info.fields, values);
				formKey += 1;
			} finally {
				if (!cancelled) formLoading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function pushFormSpec(spec: RecordFormSpec) {
		viewStack = [
			...viewStack,
			{ kind: 'form', type: spec.type, mode: spec.recordId ? 'edit' : 'create', recordId: spec.recordId, prefill: spec.prefill }
		];
	}

	function goBack() {
		viewStack = viewStack.slice(0, -1);
	}

	async function submitForm(view: Extract<View, { kind: 'form' }>, data: Record<string, string>) {
		try {
			const url =
				view.mode === 'edit'
					? `/api/database/${view.type}/records/${view.recordId}`
					: `/api/database/${view.type}/records`;
			const res = await fetch(url, {
				method: view.mode === 'edit' ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			if (!res.ok) {
				toast.error('保存に失敗しました');
				return;
			}
			const record = (await res.json()) as Record<string, unknown>;
			if (viewStack.length > 1) {
				// 詳細の上に重ねたフォーム → 詳細へ戻って再取得
				goBack();
				await loadDetail();
			} else {
				onSaved?.(record);
			}
		} catch {
			toast.error('保存に失敗しました');
		}
	}

	async function handleDelete(targetType: string, targetId: string) {
		if (!confirm('このレコードを削除しますか？')) return;
		try {
			const res = await fetch(`/api/database/${targetType}/records/${targetId}`, { method: 'DELETE' });
			if (!res.ok) {
				toast.error('削除に失敗しました');
				return;
			}
			onDeleted?.(targetId);
		} catch {
			toast.error('削除に失敗しました');
		}
	}

	const dialogTitle = $derived.by(() => {
		if (currentView.kind === 'form') {
			const label = currentView.type === type ? formLabel || labelFor(currentView.type) : labelFor(currentView.type);
			return currentView.mode === 'edit' ? `${label}を編集` : `${label}を登録`;
		}
		const r = genericRecord;
		return (r?.name as string) ?? (r?.title as string) ?? `${labelFor(type)}詳細`;
	});

	const chatContextFields = $derived(
		currentView.kind === 'form' ? formFields.map((f) => ({ key: f.key, label: f.label })) : []
	);

	// 詳細表示中のレコードを AI アシスタントに渡す
	const chatRecordContext = $derived.by(() => {
		if (currentView.kind !== 'detail' || !genericRecord) return null;
		const data: Record<string, unknown> = {};
		for (const f of genericFields) {
			const v = genericRecord[f.key];
			if (v != null && v !== '') data[f.label] = v;
		}
		return {
			type,
			typeLabel: labelFor(type),
			id: String(genericRecord.id),
			label: dialogTitle,
			data
		};
	});
</script>

<div class="overlay" role="presentation"></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={dialogTitle}>
	<div class="dialog-header">
		{#if viewStack.length > 1}
			<button class="back-btn" onclick={goBack} aria-label="戻る">
				<ChevronLeft size={16} />
			</button>
		{/if}
		<span class="dialog-title">{dialogTitle}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<DialogChatSide contextTitle={dialogTitle} contextFields={chatContextFields} recordContext={chatRecordContext} />

		<div class="content-side">
			{#if currentView.kind === 'detail'}
				{#if detailLoading}
					<div class="loading-wrap"><span class="spinner"></span></div>
				{:else if !genericRecord}
					<p class="error-text">レコードを取得できませんでした。</p>
				{:else}
					<RecordDetail
						fields={genericFields}
						record={genericRecord}
						onEdit={() => pushFormSpec({ type, recordId: String(genericRecord!.id) })}
						onDelete={() => handleDelete(type, String(genericRecord!.id))}
					/>
				{/if}
			{:else if formLoading}
				<div class="loading-wrap"><span class="spinner"></span></div>
			{:else}
				{#key formKey}
					<Form
						fields={formFields}
						fullWidth
						onsubmit={(data) => submitForm(currentView as Extract<View, { kind: 'form' }>, data)}
						oncancel={viewStack.length > 1 ? goBack : onclose}
					/>
				{/key}
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
		animation: fade-in 0.2s ease;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(1280px, 97vw);
		height: min(840px, 97vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		flex: 1;
		min-width: 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.back-btn,
	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}

	.content-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px 20px;
		border-left: 1px solid var(--color-border);
	}

	.loading-wrap {
		display: flex;
		justify-content: center;
		padding: 48px 0;
	}

	.spinner {
		width: 22px;
		height: 22px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.error-text {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-align: center;
		padding: 32px 0;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
