<script lang="ts">
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import X from '$lib/components/icon/X.svelte';

	type Props = {
		onclose: () => void;
	};

	let { onclose }: Props = $props();

	type ImportResult = { filename: string; size: number; content: string };

	let uploading = $state(false);
	let error = $state('');
	let result = $state<ImportResult | null>(null);

	async function handleFiles(files: File[]) {
		const file = files[0];
		if (!file) return;

		error = '';
		result = null;
		uploading = true;

		const body = new FormData();
		body.append('file', file);

		try {
			const res = await fetch('/api/imports', { method: 'POST', body });
			const data = (await res.json()) as ImportResult | { error: string };
			if (!res.ok) {
				error = 'error' in data ? data.error : '取り込みに失敗しました';
				return;
			}
			result = data as ImportResult;
		} catch {
			error = 'ネットワークエラーが発生しました';
		} finally {
			uploading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" role="presentation" onclick={onclose}></div>

<div class="dialog" role="dialog" aria-modal="true" aria-label="ファイルからアプリを作成">
	<div class="dialog-header">
		<span class="dialog-title">ファイルからアプリを作成</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<FileUpload
			label="仕様メモやドキュメントをアップロード"
			accept=".txt,.md,.markdown"
			disabled={uploading}
			onchange={handleFiles}
		/>
		<p class="hint">現在はテキスト/Markdown（.txt, .md）のみ対応。最大1MB。</p>

		{#if uploading}
			<p class="status">読み込み中…</p>
		{/if}

		{#if error}
			<p class="error">{error}</p>
		{/if}

		{#if result}
			<div class="preview">
				<div class="preview-head">
					<span class="preview-name">{result.filename}</span>
					<span class="preview-size">{(result.size / 1024).toFixed(1)} KB</span>
				</div>
				<pre class="preview-body">{result.content}</pre>
			</div>
		{/if}
	</div>

	<div class="dialog-footer">
		<button class="btn-ghost" onclick={onclose}>閉じる</button>
		<button class="btn-primary" disabled={!result} title="アプリ生成は次フェーズで実装予定">
			次へ：アプリを生成
		</button>
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
		width: min(560px, 95vw);
		max-height: 90vh;
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

	.dialog-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.status {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.error {
		font-size: 0.875rem;
		color: var(--color-danger);
		margin: 0;
	}

	.preview {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.preview-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		font-size: 0.8125rem;
	}

	.preview-name {
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-size {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.preview-body {
		margin: 0;
		padding: 12px;
		max-height: 280px;
		overflow: auto;
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text);
	}

	.dialog-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.btn-primary {
		padding: 8px 18px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
		&:hover { opacity: 0.88; }
		&:disabled { opacity: 0.4; cursor: not-allowed; }
	}

	.btn-ghost {
		padding: 8px 18px;
		border-radius: 7px;
		font-size: 0.875rem;
		font-weight: 500;
		background: transparent;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		&:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); color: var(--color-text); }
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}
</style>
