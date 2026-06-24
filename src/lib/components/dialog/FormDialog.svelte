<script lang="ts">
	import Form from '$lib/components/chat/Form.svelte';
	import DialogChatSide from './DialogChatSide.svelte';
	import X from '$lib/components/icon/X.svelte';
	import type { FormContent, FormField } from '$lib/types/chat';

	type Props = {
		form: FormContent;
		onsubmit: (tool: string, data: Record<string, string>) => void;
		oncancel: () => void;
	};

	let { form, onsubmit, oncancel }: Props = $props();

	// フォーム state
	let fields = $state<FormField[]>(form.fields);
	let formTitle = $state(form.title ?? '入力');
	let formLoading = $state(true);
	let formKey = $state(0);

	// フォーム外部送信用
	let formRef = $state<HTMLFormElement | null>(null);
	let submitLabel = $derived(form.submitLabel ?? '登録');

	// サーバー定義フォームを取得し、AIプリフィル値を適用
	$effect(() => {
		const tool = form.tool;
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.value != null && f.value !== '') prefill[f.key] = f.value;
		}

		let cancelled = false;
		formLoading = true;
		fetch(`/api/forms/${tool}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ title?: string; fields: FormField[] }>) : null))
			.then((data) => {
				if (cancelled) return;
				if (data?.fields) {
					fields = data.fields.map((f) => ({ ...f, value: prefill[f.key] ?? f.value }));
					if (data.title) formTitle = data.title;
				} else {
					fields = form.fields;
					formTitle = form.title ?? '入力';
				}
				formKey += 1;
			})
			.catch(() => {
				if (!cancelled) {
					fields = form.fields;
					formKey += 1;
				}
			})
			.finally(() => {
				if (!cancelled) formLoading = false;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<!-- モーダルオーバーレイ（クリックしても閉じない） -->
<div class="overlay" role="presentation"></div>

<!-- ダイアログ本体 -->
<div class="dialog" role="dialog" aria-modal="true" aria-label={formTitle}>
	<div class="dialog-header">
		<span class="dialog-title">{formTitle}</span>
		<button class="close-btn" onclick={oncancel} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<DialogChatSide contextTitle={formTitle} contextFields={fields.map((f) => ({ key: f.key, label: f.label }))} />

		<!-- フォーム側（右） -->
		<div class="form-side">
			{#if formLoading}
				<div class="form-loading"><span class="spinner"></span></div>
			{:else}
				{#key formKey}
					<Form
						{fields}
						hideActions
						fullWidth
						bind:formRef
						onsubmit={(data) => onsubmit(form.tool, data)}
					/>
				{/key}
			{/if}
		</div>
	</div>

	<div class="dialog-footer">
		<button class="footer-cancel" onclick={oncancel}>キャンセル</button>
		<button class="footer-submit" onclick={() => formRef?.requestSubmit()}>{submitLabel}</button>
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
		width: min(900px, 95vw);
		height: min(680px, 90vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* ---- ヘッダー ---- */
	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

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
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	/* ---- ボディ（フォーム + チャット） ---- */
	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}

	/* フォーム側（右） */
	.form-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px 20px;
		border-left: 1px solid var(--color-border);
	}

	.form-loading {
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

	/* ---- フッター ---- */
	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.footer-cancel {
		padding: 7px 18px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;

		&:hover {
			border-color: var(--color-text);
			color: var(--color-text);
		}
	}

	.footer-submit {
		padding: 7px 20px;
		border: none;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		cursor: pointer;
		transition: opacity 0.15s;

		&:hover { opacity: 0.88; }
		&:active { opacity: 0.75; }
	}

	/* ---- アニメーション ---- */
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
