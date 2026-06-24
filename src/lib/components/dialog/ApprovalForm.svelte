<script lang="ts">
	import type { Attachment } from '$lib/server/db/approval-service';
	import type { ApprovalDraftReviewResult } from '../../../routes/api/approvals/ai-review-draft/+server';
	import type { AccountRow } from '$lib/server/db/account-service';
	import { toast } from '$lib/stores/toast.svelte';

	type Props = {
		accountOptions: AccountRow[];
		onCreated?: (id: string) => void;
		oncancel?: () => void;
	};

	let { accountOptions, onCreated, oncancel }: Props = $props();

	const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

	type RouteEntry = {
		step: number;
		accountId: string;   // '' = manual
		approver: string;
		email: string;
		role: string;
	};

	let title = $state('');
	let content = $state('');
	let routeEntries = $state<RouteEntry[]>([
		{ step: 1, accountId: '', approver: '', email: '', role: '' }
	]);
	// Files are uploaded to R2 on submit; this holds pending File objects before upload
	let pendingFiles = $state<File[]>([]);

	function selectAccount(entry: RouteEntry, id: string) {
		entry.accountId = id;
		if (id) {
			const acc = accountOptions.find(a => a.id === id);
			if (acc) {
				entry.approver = acc.name;
				entry.email = acc.email ?? '';
				entry.role = acc.role ?? '';
			}
		} else {
			entry.approver = '';
			entry.email = '';
			entry.role = '';
		}
		routeEntries = [...routeEntries]; // trigger reactivity
	}

	let saving = $state(false);
	let error = $state('');
	let fileError = $state('');

	let aiReview = $state<ApprovalDraftReviewResult | null>(null);
	let aiReviewLoading = $state(false);
	let aiReviewError = $state('');

	async function runAiReview() {
		if (aiReviewLoading) return;
		if (!title.trim() && !content.trim()) {
			aiReviewError = 'タイトルまたは申請内容を入力してください。';
			return;
		}
		aiReviewLoading = true;
		aiReviewError = '';
		aiReview = null;
		try {
			const res = await fetch('/api/approvals/ai-review-draft', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					content: content.trim(),
					route: routeEntries.filter(r => r.approver.trim()).map(r => ({ step: r.step, approver: r.approver.trim(), role: r.role.trim() || undefined }))
				})
			});
			const result = await res.json() as ApprovalDraftReviewResult & { error?: string };
			if (!res.ok) {
				aiReviewError = result.error ?? 'AIレビューに失敗しました。';
				return;
			}
			aiReview = result;
		} catch (e) {
			aiReviewError = e instanceof Error ? e.message : String(e);
		} finally {
			aiReviewLoading = false;
		}
	}

	function addStep() {
		const maxStep = Math.max(...routeEntries.map(r => r.step), 0);
		routeEntries = [...routeEntries, { step: maxStep + 1, accountId: '', approver: '', email: '', role: '' }];
	}

	function removeStep(i: number) {
		routeEntries = routeEntries.filter((_, idx) => idx !== i);
	}

	function handleFiles(e: Event) {
		fileError = '';
		const input = e.target as HTMLInputElement;
		if (!input.files) return;
		for (const file of input.files) {
			if (file.size > MAX_FILE_BYTES) {
				fileError = `${file.name} は10MBを超えています。`;
				continue;
			}
			if (!pendingFiles.find(f => f.name === file.name && f.size === file.size)) {
				pendingFiles = [...pendingFiles, file];
			}
		}
		input.value = '';
	}

	function removeFile(i: number) {
		pendingFiles = pendingFiles.filter((_, idx) => idx !== i);
	}

	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	async function uploadFiles(): Promise<Attachment[]> {
		const results: Attachment[] = [];
		for (const file of pendingFiles) {
			const form = new FormData();
			form.append('file', file);
			const res = await fetch('/api/attachments', { method: 'POST', body: form });
			if (!res.ok) {
				const e = await res.json() as { error: string };
				throw new Error(`${file.name}: ${e.error}`);
			}
			results.push(await res.json() as Attachment);
		}
		return results;
	}

	async function submit() {
		if (!title.trim()) { error = 'タイトルは必須です。'; return; }
		if (routeEntries.some(r => !r.approver.trim())) { error = '承認者名をすべて入力してください。'; return; }

		saving = true;
		error = '';
		try {
			let attachments: Attachment[] = [];
			if (pendingFiles.length > 0) {
				try {
					attachments = await uploadFiles();
				} catch (e) {
					error = `ファイルのアップロードに失敗しました: ${e instanceof Error ? e.message : String(e)}`;
					return;
				}
			}

			const res = await fetch('/api/approvals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: title.trim(),
					content: content.trim() || undefined,
					attachments,
					route: routeEntries.map(r => ({
						step: r.step,
						accountId: r.accountId || undefined,
						approver: r.approver.trim(),
						email: r.email.trim() || undefined,
						role: r.role.trim() || undefined
					}))
				})
			});
			if (!res.ok) {
				const e = await res.json() as { error: string };
				error = e.error;
				return;
			}
			const row = await res.json() as { id: string };
			toast.success('申請を作成しました');
			onCreated?.(row.id);
		} finally {
			saving = false;
		}
	}
</script>

<div class="page">
	<form class="form" onsubmit={(e) => { e.preventDefault(); submit(); }}>

		<!-- Title -->
		<div class="field">
			<label>タイトル <span class="req">*</span></label>
			<input type="text" bind:value={title} placeholder="例: ABC社 特別値引き申請" autofocus />
		</div>

		<!-- Content -->
		<div class="field">
			<label>申請内容</label>
			<textarea class="content-input" bind:value={content} rows="5" placeholder="申請の背景・理由・詳細を記入してください。"></textarea>
		</div>

		<!-- AI Review (draft) -->
		<div class="field">
			<div class="field-header">
				<label>AIレビュー <span class="limit">（提出前のチェック）</span></label>
				<button type="button" class="btn-ai-review" onclick={runAiReview} disabled={aiReviewLoading}>
					{#if aiReviewLoading}
						レビュー中...
					{:else if aiReview}
						✨ 再レビュー
					{:else}
						✨ 内容をAIにレビューしてもらう
					{/if}
				</button>
			</div>
			{#if aiReviewError}
				<p class="ai-review-error">{aiReviewError}</p>
			{/if}
			{#if aiReview}
				<div class="ai-review-box">
					<p class="ai-review-summary">{aiReview.summary}</p>
					{#if aiReview.issues.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">誤字脱字・表現</h3>
							<ul class="ai-review-list">
								{#each aiReview.issues as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if aiReview.missing.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">不足している情報</h3>
							<ul class="ai-review-list">
								{#each aiReview.missing as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if aiReview.suggestions.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">改善提案</h3>
							<ul class="ai-review-list">
								{#each aiReview.suggestions as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Attachments -->
		<div class="field">
			<label>添付ファイル <span class="limit">（1ファイル最大10MB）</span></label>
			<label class="file-drop">
				<input type="file" multiple onchange={handleFiles} class="file-hidden" />
				<span class="file-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
						<polyline points="17 8 12 3 7 8"/>
						<line x1="12" y1="3" x2="12" y2="15"/>
					</svg>
				</span>
				<span>クリックまたはドラッグしてファイルを追加</span>
			</label>
			{#if fileError}
				<p class="file-error">{fileError}</p>
			{/if}
			{#if pendingFiles.length > 0}
				<ul class="file-list">
					{#each pendingFiles as file, i}
						<li class="file-item">
							<span class="file-name">{file.name}</span>
							<span class="file-size">{fmtSize(file.size)}</span>
							<button type="button" class="file-remove" onclick={() => removeFile(i)}>✕</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Route -->
		<div class="field">
			<div class="field-header">
				<label>承認ルート <span class="req">*</span></label>
				<button type="button" class="btn-add-step" onclick={addStep}>+ 承認者追加</button>
			</div>
			<div class="route-list">
				{#each routeEntries as entry, i}
					<div class="route-entry">
						<div class="step-num-wrap">
							<span class="step-label">Step</span>
							<input type="number" class="step-num-input" bind:value={entry.step} min="1" />
						</div>
						<div class="sub-field sub-field-wide">
							<label>承認者 <span class="req">*</span></label>
							{#if accountOptions.length > 0}
								<select
									class="account-select"
									value={entry.accountId}
									onchange={(e) => selectAccount(entry, (e.target as HTMLSelectElement).value)}
								>
									<option value="">— 手動入力 —</option>
									{#each accountOptions as acc}
										<option value={acc.id}>{acc.name}{acc.role ? `（${acc.role}）` : ''}</option>
									{/each}
								</select>
							{/if}
							{#if !entry.accountId}
								<input type="text" bind:value={entry.approver} placeholder="承認者名を入力" class="manual-input" />
							{:else}
								<div class="account-preview">
									<span class="acc-name">{entry.approver}</span>
									{#if entry.role}<span class="acc-meta">{entry.role}</span>{/if}
									{#if entry.email}<span class="acc-meta">{entry.email}</span>{/if}
								</div>
							{/if}
						</div>
						{#if routeEntries.length > 1}
							<button type="button" class="btn-remove" onclick={() => removeStep(i)}>✕</button>
						{/if}
					</div>
				{/each}
			</div>
			<p class="hint">同じStep番号にすると並列承認（AND）になります。</p>
		</div>

		{#if error}
			<p class="error-msg">{error}</p>
		{/if}

		<div class="form-actions">
			<button type="button" class="btn-cancel" onclick={() => oncancel?.()}>キャンセル</button>
			<button type="submit" class="btn-submit" disabled={saving}>
				{saving ? '作成中...' : '申請を作成'}
			</button>
		</div>
	</form>
</div>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form { display: flex; flex-direction: column; gap: 20px; }

	.field { display: flex; flex-direction: column; gap: 6px; }

	.field-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.req { color: var(--color-danger, var(--color-error)); }
	.limit { font-weight: 400; opacity: 0.7; }

	/* AI Review */
	.btn-ai-review {
		padding: 6px 14px;
		background: none;
		border: 1px solid var(--color-primary);
		color: var(--color-primary);
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-ai-review:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
	.btn-ai-review:disabled { opacity: 0.5; cursor: not-allowed; }

	.ai-review-error {
		margin: 0;
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: 6px;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.ai-review-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
	}
	.ai-review-summary { margin: 0; font-size: 0.9375rem; line-height: 1.7; }
	.ai-review-group { display: flex; flex-direction: column; gap: 6px; }
	.ai-review-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}
	.ai-review-list { margin: 0; padding-left: 1.4em; font-size: 0.875rem; line-height: 1.7; display: flex; flex-direction: column; gap: 4px; }

	input[type="text"], input[type="email"], input[type="number"] {
		padding: 9px 11px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
	}
	input:focus { outline: none; border-color: var(--color-primary); }

	.content-input {
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		resize: vertical;
		line-height: 1.6;
	}
	.content-input:focus { outline: none; border-color: var(--color-primary); }

	/* File attachment */
	.file-drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px;
		border: 2px dashed var(--color-border);
		border-radius: 8px;
		cursor: pointer;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		transition: border-color 0.15s, background 0.15s;
		font-weight: 400;
	}
	.file-drop:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 4%, transparent);
		color: var(--color-text);
	}
	.file-hidden { display: none; }

	.file-error { font-size: 0.8125rem; color: var(--color-danger, var(--color-error)); margin: 0; }

	.file-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.file-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
	}
	.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.file-size { flex-shrink: 0; color: var(--color-text-muted); font-size: 0.8125rem; }
	.file-remove {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0;
		font-size: 0.875rem;
		flex-shrink: 0;
	}
	.file-remove:hover { color: var(--color-danger, var(--color-error)); }

	/* Route builder */
	.route-list { display: flex; flex-direction: column; gap: 8px; }

	.route-entry {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.step-num-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
	.step-label { font-size: 0.75rem; font-weight: 500; color: var(--color-text-muted); }
	.step-num-input {
		width: 52px;
		padding: 8px 6px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		text-align: center;
		font-family: inherit;
	}
	.step-num-input:focus { outline: none; border-color: var(--color-primary); }

	.sub-field { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
	.sub-field-wide { flex: 2; }

	.account-select {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		cursor: pointer;
	}
	.account-select:focus { outline: none; border-color: var(--color-primary); }

	.manual-input {
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
	}
	.manual-input:focus { outline: none; border-color: var(--color-primary); }

	.account-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-primary) 5%, var(--color-background));
		font-size: 0.875rem;
	}
	.acc-name { font-weight: 500; }
	.acc-meta { color: var(--color-text-muted); font-size: 0.8125rem; }

	.btn-add-step {
		padding: 4px 10px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.btn-add-step:hover { border-color: var(--color-primary); color: var(--color-primary); }

	.btn-remove {
		padding: 6px 6px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.875rem;
		flex-shrink: 0;
	}
	.btn-remove:hover { color: var(--color-danger, var(--color-error)); }

	.hint { font-size: 0.8125rem; color: var(--color-text-muted); margin: 0; }

	.error-msg {
		padding: 10px 14px;
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: 6px;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding-top: 4px;
	}

	.btn-cancel {
		padding: 8px 18px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		text-decoration: none;
		font-family: inherit;
		cursor: pointer;
	}
	.btn-cancel:hover { border-color: var(--color-text-muted); color: var(--color-text); }

	.btn-submit {
		padding: 8px 22px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9375rem;
		cursor: pointer;
	}
	.btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
