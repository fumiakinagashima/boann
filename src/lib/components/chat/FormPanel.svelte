<script lang="ts">
	import Form from './Form.svelte';
	import X from '$lib/components/icon/X.svelte';
	import type { FormContent, FormField } from '$lib/types/chat';

	type Props = {
		form: FormContent;
		onsubmit: (tool: string, data: Record<string, string>) => void;
		oncancel: () => void;
	};

	let { form, onsubmit, oncancel }: Props = $props();

	let fields = $state<FormField[]>(form.fields);
	let title = $state(form.title ?? '入力');
	let loading = $state(true);
	let formKey = $state(0);

	$effect(() => {
		const tool = form.tool;
		// AIが提供した値（内容・日時など）をプリフィルとして抽出
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.value != null && f.value !== '') prefill[f.key] = f.value;
		}

		loading = true;
		let cancelled = false;
		fetch(`/api/forms/${tool}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ title?: string; fields: FormField[] }>) : null))
			.then((data) => {
				if (cancelled) return;
				if (data?.fields) {
					// サーバー定義のフィールド構造にAIプリフィル値を適用
					fields = data.fields.map((f) => ({ ...f, value: prefill[f.key] ?? f.value }));
					if (data.title) title = data.title;
				} else {
					// 未登録ツールはAI提供フィールドをそのまま使用
					fields = form.fields;
					title = form.title ?? '入力';
				}
				formKey += 1;
			})
			.catch(() => {
				if (cancelled) return;
				fields = form.fields;
				title = form.title ?? '入力';
				formKey += 1;
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="panel-backdrop" role="presentation" onclick={oncancel}></div>

<aside class="panel" aria-label="入力フォーム">
	<div class="panel-header">
		<span class="panel-title">{title}</span>
		<button class="panel-close" onclick={oncancel} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>
	<div class="panel-body">
		{#if loading}
			<div class="panel-loading">
				<span class="spinner"></span>
			</div>
		{:else}
			{#key formKey}
				<Form
					{fields}
					submitLabel={form.submitLabel}
					onsubmit={(data) => onsubmit(form.tool, data)}
				/>
			{/key}
		{/if}
	</div>
</aside>

<style lang="scss">
	.panel-backdrop {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 50;
		animation: backdrop-in 0.2s ease;

		@media (max-width: 767px) {
			display: block;
		}
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 420px;
		max-width: 100vw;
		background: var(--color-background);
		border-left: 1px solid var(--color-border);
		z-index: 51;
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
		animation: panel-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);

		@media (max-width: 767px) {
			width: 100vw;
		}
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.panel-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.panel-close {
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
		transition:
			background 0.15s,
			color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px 20px;
	}

	.panel-loading {
		display: flex;
		justify-content: center;
		padding: 48px 0;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes panel-in {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
