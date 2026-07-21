<script lang="ts">
	import X from '$lib/components/icon/X.svelte';
	import FieldEditor from './FieldEditor.svelte';
	import type { CustomFieldType, EditableField } from '$lib/server/db/table-service';

	type Props = {
		open: boolean;
		fields: EditableField[];
		onclose: () => void;
	};

	let { open, fields = $bindable([]), onclose }: Props = $props();

	// ワークフローの入力パラメータでは、対象テーブル解決の仕組みが別途必要になる
	// recordSelect/account は今回対象外（将来ここに追加するだけで拡張できる）。
	const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
		{ value: 'text', label: 'テキスト' },
		{ value: 'number', label: '数値' },
		{ value: 'select', label: '選択' },
		{ value: 'date', label: '日付' },
		{ value: 'email', label: 'メール' },
		{ value: 'tel', label: '電話番号' },
		{ value: 'textarea', label: '長文テキスト' }
	];
</script>

{#if open}
	<div class="panel-backdrop" role="presentation" onclick={onclose}></div>

	<aside class="panel" aria-label="入力パラメータ">
		<div class="panel-header">
			<span class="panel-title">入力パラメータ</span>
			<button class="panel-close" onclick={onclose} aria-label="閉じる">
				<X size={16} />
			</button>
		</div>
		<div class="panel-body">
			<p class="panel-desc">
				このワークフローを呼び出す側が渡す値を定義する。ステップ内で <code>@input:&lt;key&gt;</code> として参照できる。
			</p>
			<FieldEditor bind:fields fieldTypes={FIELD_TYPES} />
		</div>
	</aside>
{/if}

<style lang="scss">
	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 50;
		animation: backdrop-in 0.2s ease;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 680px;
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
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.panel-desc {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;

		code {
			font-family: ui-monospace, monospace;
			background: var(--color-surface);
			padding: 1px 5px;
			border-radius: 4px;
		}
	}

	@keyframes panel-in {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	@keyframes backdrop-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>
