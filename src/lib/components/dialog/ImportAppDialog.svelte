<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import X from '$lib/components/icon/X.svelte';
	import type { ImportPlan } from '$lib/server/ai/import-plan';

	type Props = {
		onclose: () => void;
	};

	let { onclose }: Props = $props();

	type ImportResult = { filename: string; size: number; content: string };
	type Step = 'upload' | 'planning' | 'review' | 'applying';

	const FIELD_TYPE_LABELS: Record<string, string> = {
		text: 'テキスト',
		number: '数値',
		select: '選択',
		date: '日付',
		email: 'メール',
		tel: '電話',
		textarea: '長文',
		recordSelect: '参照'
	};

	let step = $state<Step>('upload');
	let error = $state('');
	let result = $state<ImportResult | null>(null);
	let plan = $state<ImportPlan | null>(null);

	function tableLabel(name: string): string {
		return plan?.tables.find((t) => t.name === name)?.label ?? name;
	}

	async function handleFiles(files: File[]) {
		const file = files[0];
		if (!file) return;

		error = '';
		result = null;
		plan = null;

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
		}
	}

	async function generatePlan() {
		if (!result) return;
		error = '';
		step = 'planning';
		try {
			const res = await fetch('/api/imports/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: result.content, filename: result.filename })
			});
			const data = (await res.json()) as { plan: ImportPlan } | { error: string };
			if (!res.ok || !('plan' in data)) {
				error = 'error' in data ? data.error : 'プラン生成に失敗しました';
				step = 'upload';
				return;
			}
			plan = data.plan;
			step = 'review';
		} catch {
			error = 'ネットワークエラーが発生しました';
			step = 'upload';
		}
	}

	let pollTimer: ReturnType<typeof setTimeout> | null = null;

	function stopPolling() {
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}
	}

	async function applyPlan() {
		if (!plan) return;
		error = '';
		step = 'applying';
		try {
			// apply は非同期。Queue にジョブを投入し、結果はポーリングで取得する。
			const res = await fetch('/api/imports/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan })
			});
			const data = (await res.json()) as { jobId: string } | { error: string };
			if (!res.ok || !('jobId' in data)) {
				error = 'error' in data ? data.error : 'アプリ作成の受付に失敗しました';
				step = 'review';
				return;
			}
			pollJob(data.jobId);
		} catch {
			error = 'ネットワークエラーが発生しました';
			step = 'review';
		}
	}

	function pollJob(jobId: string) {
		stopPolling();
		pollTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/imports/jobs/${jobId}`);
				const data = (await res.json()) as {
					status: 'queued' | 'processing' | 'done' | 'error';
					appId: string | null;
					error: string | null;
				};
				if (res.ok && data.status === 'done' && data.appId) {
					await goto(`/apps/${data.appId}`);
					return;
				}
				if (res.ok && data.status === 'error') {
					error = data.error ?? 'アプリ作成に失敗しました';
					step = 'review';
					return;
				}
				pollJob(jobId); // queued / processing → 継続
			} catch {
				pollJob(jobId); // 一時的なエラーは継続
			}
		}, 1500);
	}

	onDestroy(stopPolling);

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
		{#if step === 'upload'}
			<FileUpload
				label="仕様メモやドキュメントをアップロード"
				accept=".txt,.md,.markdown"
				onchange={handleFiles}
			/>
			<p class="hint">現在はテキスト/Markdown（.txt, .md）のみ対応。最大1MB。</p>

			{#if error}<p class="error">{error}</p>{/if}

			{#if result}
				<div class="preview">
					<div class="preview-head">
						<span class="preview-name">{result.filename}</span>
						<span class="preview-size">{(result.size / 1024).toFixed(1)} KB</span>
					</div>
					<pre class="preview-body">{result.content}</pre>
				</div>
			{/if}
		{:else if step === 'planning'}
			<div class="loading">
				<div class="spinner"></div>
				<p>ファイルからアプリ構造を設計中…</p>
			</div>
		{:else if step === 'review' && plan}
			<p class="section-intro">以下の内容でアプリを作成します。問題なければ「アプリを作成」を押してください。</p>

			<div class="app-summary">
				<span class="app-icon">{plan.app.icon ?? '📦'}</span>
				<div>
					<div class="app-label">{plan.app.label}</div>
					<div class="app-name">{plan.app.name}</div>
				</div>
			</div>

			<section>
				<h4>テーブル（{plan.tables.length}）</h4>
				{#each plan.tables as t (t.name)}
					<div class="table-card">
						<div class="table-head">
							<span>{t.icon ?? '🗂'} {t.label}</span>
							<span class="muted">{t.name}</span>
						</div>
						<div class="field-chips">
							{#each t.fields as f (f.key)}
								<span class="chip">
									{f.label}
									<span class="chip-type">{FIELD_TYPE_LABELS[f.type] ?? f.type}{#if f.type === 'recordSelect' && f.ref_table}→{tableLabel(f.ref_table)}{/if}</span>
									{#if f.required}<span class="chip-req">必須</span>{/if}
								</span>
							{/each}
						</div>
					</div>
				{/each}
			</section>

			{#if plan.pages.length > 0}
				<section>
					<h4>ページ（{plan.pages.length}）</h4>
					{#each plan.pages as p (p.label)}
						<div class="page-row">
							<span class="page-label">{p.label}</span>
							<span class="muted">
								{p.components.map((c) => `${c.type === 'list' ? '一覧' : 'フォーム'}: ${tableLabel(c.table_name)}`).join(' / ')}
							</span>
						</div>
					{/each}
				</section>
			{/if}

			{#if plan.workflows.length > 0}
				<section>
					<h4>ワークフロー（{plan.workflows.length}）</h4>
					<p class="wf-note">※ ワークフローは自動作成されません。アプリ作成後に手動で追加してください。</p>
					{#each plan.workflows as w (w.name)}
						<div class="page-row">
							<span class="page-label">{w.name}</span>
							{#if w.description}<span class="muted">{w.description}</span>{/if}
						</div>
					{/each}
				</section>
			{/if}

			{#if error}<p class="error">{error}</p>{/if}
		{:else if step === 'applying'}
			<div class="loading">
				<div class="spinner"></div>
				<p>アプリを作成中…</p>
				<p class="sub">このまま閉じても、完了したら通知でお知らせします。</p>
			</div>
		{/if}
	</div>

	<div class="dialog-footer">
		{#if step === 'upload'}
			<button class="btn-ghost" onclick={onclose}>閉じる</button>
			<button class="btn-primary" disabled={!result} onclick={generatePlan}>次へ：アプリを生成</button>
		{:else if step === 'review'}
			<button class="btn-ghost" onclick={() => (step = 'upload')}>戻る</button>
			<button class="btn-primary" onclick={applyPlan}>この内容でアプリを作成</button>
		{:else}
			<button class="btn-ghost" onclick={onclose}>閉じる</button>
		{/if}
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
		width: min(600px, 95vw);
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
		max-height: 200px;
		overflow: auto;
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text);
	}

	/* Loading */
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 48px 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.loading .sub {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	/* Review */
	.section-intro {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.app-summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--color-surface);
		border-radius: 8px;
	}

	.app-icon { font-size: 1.75rem; }

	.app-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.app-name {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	h4 {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 4px 0 0;
	}

	.table-card {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.table-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.muted {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--color-text-muted);
	}

	.field-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.75rem;
		color: var(--color-text);
	}

	.chip-type { color: var(--color-text-muted); }

	.chip-req {
		color: var(--color-danger);
		font-size: 0.6875rem;
	}

	.page-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}

	.page-label {
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.wf-note {
		font-size: 0.75rem;
		color: var(--color-text-muted);
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
		&:disabled { opacity: 0.4; cursor: not-allowed; }
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
