<script lang="ts">
	import { goto } from '$app/navigation';
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import X from '$lib/components/icon/X.svelte';

	type Props = {
		onclose: () => void;
	};

	let { onclose }: Props = $props();

	let uploading = $state(false);
	let error = $state('');

	async function handleFiles(files: File[]) {
		const file = files[0];
		if (!file) return;

		error = '';
		uploading = true;

		const body = new FormData();
		body.append('file', file);

		try {
			const res = await fetch('/api/imports', { method: 'POST', body });
			const data = (await res.json()) as { jobId: string } | { error: string };
			if (!res.ok || !('jobId' in data)) {
				error = 'error' in data ? data.error : '取り込みに失敗しました';
				uploading = false;
				return;
			}
			// 設計（読み取り＋AI設計）は非同期。プランページへ遷移して進捗を表示する。
			await goto(`/imports/${data.jobId}`);
		} catch {
			error = 'ネットワークエラーが発生しました';
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
			accept=".txt,.md,.markdown,.xlsx"
			disabled={uploading}
			onchange={handleFiles}
		/>
		<p class="hint">現在はテキスト/Markdown（.txt, .md）、Excel（.xlsx）のみ対応。最大5MB。</p>
		<p class="hint">Excelは見出し行とサンプル行から構造を設計します（データそのものは登録されません）。</p>
		<p class="hint">アップロード後、AIがアプリ構造を設計します（完了は通知でもお知らせします）。</p>

		{#if uploading}<p class="status">アップロード中…</p>{/if}
		{#if error}<p class="error">{error}</p>{/if}
	</div>

	<div class="dialog-footer">
		<button class="btn-ghost" onclick={onclose}>閉じる</button>
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
		width: min(520px, 95vw);
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

	.dialog-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
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
