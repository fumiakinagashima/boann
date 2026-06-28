<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import type { ImportPlan } from '$lib/server/ai/import-plan';
	import type { ImportJobStatus } from '$lib/server/db/import-job-service';

	let { data }: { data: PageData } = $props();

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

	let status = $state<ImportJobStatus>(data.job.status);
	let plan = $state<ImportPlan | null>(data.job.plan);
	let appId = $state<string | null>(data.job.appId);
	let jobError = $state<string | null>(data.job.error);
	let applyError = $state('');

	const jobId = data.job.id;

	function tableLabel(name: string): string {
		return plan?.tables.find((t) => t.name === name)?.label ?? name;
	}

	let polling = false;

	async function pollOnce() {
		const res = await fetch(`/api/imports/${jobId}`);
		if (!res.ok) return;
		const d = (await res.json()) as {
			status: ImportJobStatus;
			plan: ImportPlan | null;
			appId: string | null;
			error: string | null;
		};
		status = d.status;
		plan = d.plan;
		appId = d.appId;
		jobError = d.error;
		if (status === 'done' && appId) {
			await goto(`/apps/${appId}`);
		}
	}

	function startPolling() {
		if (polling) return;
		polling = true;
		const tick = async () => {
			if (!polling) return;
			await pollOnce();
			if (status === 'designing' || status === 'applying') {
				setTimeout(tick, 1500);
			} else {
				polling = false;
			}
		};
		setTimeout(tick, 1500);
	}

	onMount(() => {
		if (status === 'designing' || status === 'applying') startPolling();
		else if (status === 'done' && appId) goto(`/apps/${appId}`);
		return () => { polling = false; };
	});

	async function applyPlan() {
		applyError = '';
		status = 'applying';
		try {
			const res = await fetch(`/api/imports/${jobId}/apply`, { method: 'POST' });
			const d = (await res.json()) as { jobId: string } | { error: string };
			if (!res.ok || !('jobId' in d)) {
				applyError = 'error' in d ? d.error : 'アプリ作成の受付に失敗しました';
				status = 'ready';
				return;
			}
			startPolling();
		} catch {
			applyError = 'ネットワークエラーが発生しました';
			status = 'ready';
		}
	}
</script>

<div class="page">
	<div class="header">
		<h1>アプリのプラン</h1>
		{#if data.job.filename}<span class="filename">{data.job.filename}</span>{/if}
	</div>

	{#if status === 'designing'}
		<div class="loading">
			<div class="spinner"></div>
			<p>ファイルからアプリ構造を設計中…</p>
			<p class="sub">完了したら通知でもお知らせします。</p>
		</div>
	{:else if status === 'error'}
		<div class="error-box">
			<p class="error-title">処理中にエラーが発生しました</p>
			<p class="error-detail">{jobError ?? '不明なエラー'}</p>
		</div>
	{:else if status === 'applying'}
		<div class="loading">
			<div class="spinner"></div>
			<p>アプリを作成中…</p>
			<p class="sub">このまま閉じても、完了したら通知でお知らせします。</p>
		</div>
	{:else if plan}
		<p class="intro">以下の内容でアプリを作成します。問題なければ「アプリを作成」を押してください。</p>

		<div class="app-summary">
			<span class="app-icon">{plan.app.icon ?? '📦'}</span>
			<div>
				<div class="app-label">{plan.app.label}</div>
				<div class="app-name">{plan.app.name}</div>
			</div>
		</div>

		<section>
			<h2>テーブル（{plan.tables.length}）</h2>
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
				<h2>ページ（{plan.pages.length}）</h2>
				{#each plan.pages as p (p.label)}
					<div class="row">
						<span class="row-label">{p.label}</span>
						<span class="muted">
							{p.components.map((c) => `${c.type === 'list' ? '一覧' : 'フォーム'}: ${tableLabel(c.table_name)}`).join(' / ')}
						</span>
					</div>
				{/each}
			</section>
		{/if}

		{#if plan.workflows.length > 0}
			<section>
				<h2>ワークフロー（{plan.workflows.length}）</h2>
				<p class="wf-note">※ ワークフローは自動作成されません。アプリ作成後に手動で追加してください。</p>
				{#each plan.workflows as w (w.name)}
					<div class="row">
						<span class="row-label">{w.name}</span>
						{#if w.description}<span class="muted">{w.description}</span>{/if}
					</div>
				{/each}
			</section>
		{/if}

		{#if applyError}<p class="apply-error">{applyError}</p>{/if}

		<div class="actions">
			<a class="btn-ghost" href="/">キャンセル</a>
			<button class="btn-primary" onclick={applyPlan}>この内容でアプリを作成</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 32px 40px 64px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.header {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.filename {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.intro {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 64px 0;
		color: var(--color-text-muted);
		font-size: 0.9375rem;

		.sub { font-size: 0.75rem; }
	}

	.spinner {
		width: 30px;
		height: 30px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.error-box {
		border: 1px solid var(--color-danger);
		border-radius: 8px;
		padding: 16px;
	}
	.error-title { font-weight: 600; color: var(--color-danger); margin: 0 0 4px; }
	.error-detail { font-size: 0.875rem; color: var(--color-text-muted); margin: 0; }

	.app-summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: var(--color-surface);
		border-radius: 8px;
	}
	.app-icon { font-size: 1.875rem; }
	.app-label { font-size: 1rem; font-weight: 600; color: var(--color-text); }
	.app-name { font-size: 0.75rem; color: var(--color-text-muted); }

	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	h2 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 8px 0 0;
	}

	.table-card {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.table-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.muted { font-size: 0.75rem; font-weight: 400; color: var(--color-text-muted); }

	.field-chips { display: flex; flex-wrap: wrap; gap: 6px; }

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
	.chip-req { color: var(--color-danger); font-size: 0.6875rem; }

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}
	.row-label { font-size: 0.875rem; color: var(--color-text); }

	.wf-note { font-size: 0.75rem; color: var(--color-text-muted); margin: 0; }

	.apply-error { font-size: 0.875rem; color: var(--color-danger); margin: 0; }

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
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
		text-decoration: none;
		transition: background 0.15s, color 0.15s;
		&:hover { background: color-mix(in srgb, var(--color-text) 6%, transparent); color: var(--color-text); }
	}

	@keyframes spin { to { transform: rotate(360deg); } }
</style>
