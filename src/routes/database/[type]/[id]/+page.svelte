<script lang="ts">
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { CustomerHealthScoreResult } from '../../../api/customers/[id]/health-score/+server';
	import type { CustomerHandoverSummaryResult } from '../../../api/customers/[id]/handover-summary/+server';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const id = $derived($page.params.id);
	const info = $derived(data.info);
	const record = $derived(data.record);
	const refLabels = $derived(data.refLabels);

	let deleting = $state(false);

	const HEALTH_LEVEL_LABELS: Record<string, string> = { good: '良好', warning: '注意', risk: '要注意' };
	const HEALTH_LEVEL_COLORS: Record<string, string> = { good: 'var(--color-success)', warning: 'var(--color-warning)', risk: 'var(--color-error)' };

	let healthScore = $state<CustomerHealthScoreResult | null>(untrack(() => data.healthScore));
	let healthScoreLoading = $state(false);
	let healthScoreError = $state('');

	$effect(() => {
		healthScore = data.healthScore;
	});

	function fmtDateTime(iso: string): string {
		return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
	}

	async function runHealthScore() {
		if (healthScoreLoading) return;
		healthScoreLoading = true;
		healthScoreError = '';
		healthScore = null;
		try {
			const res = await fetch(`/api/customers/${id}/health-score`, { method: 'POST' });
			const result = await res.json() as CustomerHealthScoreResult & { error?: string };
			if (!res.ok) {
				healthScoreError = result.error ?? 'ヘルススコアの取得に失敗しました。';
				return;
			}
			healthScore = result;
		} catch (e) {
			healthScoreError = e instanceof Error ? e.message : String(e);
		} finally {
			healthScoreLoading = false;
		}
	}

	const SOURCE_TYPE_LABELS: Record<string, string> = { activity: '活動履歴', deal: '案件' };

	let handoverSummary = $state<CustomerHandoverSummaryResult | null>(null);
	let handoverLoading = $state(false);
	let handoverError = $state('');

	async function runHandoverSummary() {
		if (handoverLoading) return;
		handoverLoading = true;
		handoverError = '';
		handoverSummary = null;
		try {
			const res = await fetch(`/api/customers/${id}/handover-summary`, { method: 'POST' });
			const result = await res.json() as CustomerHandoverSummaryResult & { error?: string };
			if (!res.ok) {
				handoverError = result.error ?? '引き継ぎサマリーの生成に失敗しました。';
				return;
			}
			handoverSummary = result;
		} catch (e) {
			handoverError = e instanceof Error ? e.message : String(e);
		} finally {
			handoverLoading = false;
		}
	}

	function formatValue(val: string | number | null, fieldType: string): string {
		if (val == null || val === '') return '—';
		if (fieldType === 'number') return new Intl.NumberFormat('ja-JP').format(Number(val));
		if (fieldType === 'date' || fieldType === 'datetime') {
			const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
			if (isNaN(d.getTime())) return String(val);
			return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
		}
		return String(val);
	}

	function displayLabel(key: string, val: string | number | null): string {
		const field = info?.fields.find(f => f.key === key);
		if (!field) return String(val ?? '—');
		if (field.type === 'select' && val != null) {
			return field.options?.find(o => o.value === String(val))?.label ?? String(val);
		}
		return formatValue(val, field.type);
	}

	async function deleteRecord() {
		if (!confirm('このレコードを削除しますか？')) return;
		deleting = true;
		await fetch(`/api/database/${type}/records/${id}`, { method: 'DELETE' });
		location.href = `/database/${type}`;
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<a href="/database/{type}">{info?.label ?? type}</a>
			<span class="sep">/</span>
			<span>詳細</span>
		</div>
		<div class="header-actions">
			<a href="/database/{type}/{id}/edit" class="btn-edit">編集</a>
			<button class="btn-delete" onclick={deleteRecord} disabled={deleting}>削除</button>
		</div>
	</header>

	{#if record && info}
		<div class="detail-card">
			<dl>
				<div class="row meta">
					<dt>ID</dt>
					<dd class="mono">{record.id}</dd>
				</div>
				{#each info.fields as field}
					<div class="row">
						<dt>{field.label}</dt>
						{#if field.type === 'recordSelect'}
							<dd>
								{refLabels[field.key] ?? '—'}
								<br />
								<span class="mono sub">{record[field.key] ?? '—'}</span>
							</dd>
						{:else}
							<dd>{displayLabel(field.key, record[field.key] as string | number | null)}</dd>
						{/if}
					</div>
				{/each}
				{#if record.createdAt}
					<div class="row meta">
						<dt>作成日時</dt>
						<dd>{new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(Number(record.createdAt) * 1000))}</dd>
					</div>
				{/if}
				{#if record.updatedAt}
					<div class="row meta">
						<dt>更新日時</dt>
						<dd>{new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(Number(record.updatedAt) * 1000))}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if type === 'customers' && record}
		<section class="health-section">
			<div class="section-head">
				<h2 class="section-title">ヘルススコア</h2>
				<button class="btn-ai-review" onclick={runHealthScore} disabled={healthScoreLoading}>
					{#if healthScoreLoading}
						分析中...
					{:else if healthScore}
						✨ 再分析
					{:else}
						✨ AIでスコアリング
					{/if}
				</button>
			</div>
			{#if healthScoreError}
				<p class="ai-review-error">{healthScoreError}</p>
			{/if}
			{#if healthScore}
				<div class="ai-review-box">
					<div class="health-score-row">
						<span class="health-score-value health-level-{healthScore.level}">
							{healthScore.score}<span class="health-score-max">/100</span>
						</span>
						<span class="risk-badge health-level-{healthScore.level}">
							{HEALTH_LEVEL_LABELS[healthScore.level] ?? healthScore.level}
						</span>
					</div>
					<p class="ai-review-summary">{healthScore.summary}</p>
					<p class="health-score-updated">最終更新: {fmtDateTime(healthScore.updatedAt)}</p>
					{#if healthScore.positives.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">良い兆候</h3>
							<ul class="ai-review-list ai-review-positives">
								{#each healthScore.positives as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if healthScore.concerns.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">懸念点</h3>
							<ul class="ai-review-list ai-review-concerns">
								{#each healthScore.concerns as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</section>

		<section class="health-section">
			<div class="section-head">
				<h2 class="section-title">引き継ぎサマリー</h2>
				<button class="btn-ai-review" onclick={runHandoverSummary} disabled={handoverLoading}>
					{#if handoverLoading}
						生成中...
					{:else if handoverSummary}
						✨ 再生成
					{:else}
						✨ AIで要約
					{/if}
				</button>
			</div>
			{#if handoverError}
				<p class="ai-review-error">{handoverError}</p>
			{/if}
			{#if handoverSummary}
				<div class="ai-review-box">
					<p class="ai-review-summary">{handoverSummary.summary}</p>
					{#if handoverSummary.attentionItems.length > 0}
						<div class="ai-review-group">
							<h3 class="ai-review-group-title">注意点</h3>
							<ul class="ai-review-list ai-review-attention">
								{#each handoverSummary.attentionItems as item}
									<li>
										{item.content}
										<a
											class="source-link"
											href="/database/{item.sourceType === 'deal' ? 'deals' : 'activities'}/{item.sourceId}"
											target="_blank"
											rel="noopener noreferrer"
										>
											{SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}を見る
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style lang="scss">
	.page {
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.9375rem;
	}

	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.btn-edit {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
	}

	.btn-delete {
		padding: 7px 14px;
		background: none;
		color: var(--color-danger, var(--color-error));
		border: 1px solid var(--color-danger, var(--color-error));
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.btn-delete:hover { background: color-mix(in srgb, var(--color-danger, var(--color-error)) 10%, transparent); }
	.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

	.detail-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 20px 24px;
		max-width: 600px;
	}

	dl { margin: 0; display: flex; flex-direction: column; gap: 0; }

	.row {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: 16px;
		padding: 11px 0;
		border-bottom: 1px solid var(--color-border);
		align-items: baseline;
	}

	.row:last-child { border-bottom: none; }

	dt {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	dd {
		margin: 0;
		font-size: 0.9375rem;
		word-break: break-all;
	}

	.row.meta dt, .row.meta dd { font-size: 0.8125rem; color: var(--color-text-muted); }
	.mono { font-family: ui-monospace, monospace; font-size: 0.75rem !important; }
	.sub { color: var(--color-text-muted); }

	/* Health score */
	.health-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 600px;
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.section-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

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

	.health-score-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.health-score-value {
		font-size: 2rem;
		font-weight: 700;
		line-height: 1;
	}

	.health-score-max {
		font-size: 1rem;
		font-weight: 500;
		opacity: 0.6;
	}

	.risk-badge {
		display: inline-flex;
		align-self: flex-start;
		font-size: 0.75rem;
		padding: 2px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 600;
		white-space: nowrap;
	}

	.health-level-excellent { color: var(--color-success); border-color: var(--color-success); }
	.health-level-good { color: var(--color-info); border-color: var(--color-info); }
	.health-level-fair { color: #d97706; border-color: #d97706; }
	.health-level-poor { color: var(--color-error); border-color: var(--color-error); }

	.ai-review-summary { margin: 0; font-size: 0.9375rem; line-height: 1.7; }
	.health-score-updated { margin: 0; font-size: 0.75rem; color: var(--color-text-muted); }
	.ai-review-group { display: flex; flex-direction: column; gap: 6px; }
	.ai-review-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}
	.ai-review-list { margin: 0; padding-left: 1.4em; font-size: 0.875rem; line-height: 1.7; display: flex; flex-direction: column; gap: 4px; }
	.ai-review-positives li::marker { color: var(--color-success); }
	.ai-review-concerns li::marker { color: var(--color-error); }
	.ai-review-attention li::marker { color: var(--color-warning); }

	.source-link {
		margin-left: 8px;
		font-size: 0.8125rem;
		color: var(--color-primary);
		text-decoration: none;
		white-space: nowrap;
	}
	.source-link:hover { text-decoration: underline; }
</style>
