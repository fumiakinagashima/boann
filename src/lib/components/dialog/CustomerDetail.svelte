<script lang="ts">
	import type {
		CustomerDetailCustomer,
		CustomerDetailContact,
		CustomerDetailDeal,
		CustomerDetailActivity
	} from '$lib/types/chat';
	import type { RecordFormSpec } from './field-adapter';
	import type { CustomerHealthScoreResult } from '../../../routes/api/customers/[id]/health-score/+server';

	type Props = {
		customer: CustomerDetailCustomer;
		contacts: CustomerDetailContact[];
		deals: CustomerDetailDeal[];
		activities: CustomerDetailActivity[];
		onOpenForm: (spec: RecordFormSpec) => void;
		onDelete?: () => void;
	};

	let { customer, contacts, deals, activities, onOpenForm, onDelete }: Props = $props();

	// ---- AIヘルススコア ----
	const HEALTH_LEVEL_LABELS: Record<string, string> = { good: '良好', warning: '注意', risk: '要注意' };

	type HealthScore = { score: number; level: string; summary: string; positives: string[]; concerns: string[]; updatedAt?: string | number | null };

	// detail 取得時にキャッシュ済みスコアがあれば初期表示する
	function cachedHealthScore(): HealthScore | null {
		if (customer.healthScore == null || !customer.healthScoreLevel) return null;
		return {
			score: customer.healthScore,
			level: customer.healthScoreLevel,
			summary: customer.healthScoreSummary ?? '',
			positives: JSON.parse(customer.healthScorePositives ?? '[]'),
			concerns: JSON.parse(customer.healthScoreConcerns ?? '[]'),
			updatedAt: customer.healthScoreUpdatedAt
		};
	}

	let healthScore = $state<HealthScore | null>(cachedHealthScore());
	let healthLoading = $state(false);
	let healthError = $state('');

	async function runHealthScore() {
		if (healthLoading) return;
		healthLoading = true;
		healthError = '';
		try {
			const res = await fetch(`/api/customers/${customer.id}/health-score`, { method: 'POST' });
			const result = (await res.json()) as CustomerHealthScoreResult & { error?: string };
			if (!res.ok) {
				healthError = result.error ?? 'ヘルススコアの取得に失敗しました。';
				return;
			}
			healthScore = result;
		} catch (e) {
			healthError = e instanceof Error ? e.message : String(e);
		} finally {
			healthLoading = false;
		}
	}

	const CUSTOMER_STATUS_LABELS: Record<string, string> = {
		active: '有効',
		inactive: '無効'
	};

	const DEAL_STATUS_LABELS: Record<string, string> = {
		open: '商談中',
		won: '受注',
		lost: '失注'
	};

	const ACTIVITY_TYPE_LABELS: Record<string, string> = {
		note: 'メモ',
		call: '電話',
		email: 'メール',
		meeting: '面談',
		deal_created: '案件登録'
	};

	function fmtDate(val: string | number | null | undefined): string {
		if (val == null || val === '') return '—';
		const d = typeof val === 'number' ? new Date(val * 1000) : new Date(val);
		if (isNaN(d.getTime())) return String(val);
		return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
	}

	function fmtAmount(amount: number | null | undefined): string {
		if (amount == null) return '—';
		return `¥${amount.toLocaleString()}`;
	}

	function openEditCustomer() {
		onOpenForm({ type: 'customers', recordId: customer.id });
	}

	function openNewContact() {
		onOpenForm({ type: 'contacts', prefill: { customerId: customer.id } });
	}

	function openNewDeal() {
		onOpenForm({ type: 'deals', prefill: { customerId: customer.id } });
	}

	function openNewActivity() {
		onOpenForm({ type: 'activities', prefill: { customerId: customer.id } });
	}
</script>

<div class="customer-detail">

	<!-- 顧客情報 -->
	<section class="section">
		<div class="section-header">
			<h3 class="section-title">{customer.name}</h3>
			<div class="header-actions">
				<button class="action-btn" onclick={openEditCustomer}>情報を修正</button>
				{#if onDelete}
					<button class="action-btn danger" onclick={onDelete}>削除</button>
				{/if}
			</div>
		</div>
		<dl class="info-grid">
			{#if customer.status}
				<dt>ステータス</dt>
				<dd class="status-badge status-{customer.status}">
					{CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
				</dd>
			{/if}
			{#if customer.email}
				<dt>メール</dt><dd>{customer.email}</dd>
			{/if}
			{#if customer.phone}
				<dt>電話</dt><dd>{customer.phone}</dd>
			{/if}
			{#if customer.postal_code || customer.address}
				<dt>住所</dt>
				<dd>{[customer.postal_code, customer.address].filter(Boolean).join(' ')}</dd>
			{/if}
			{#if customer.website}
				<dt>ウェブ</dt>
				<dd><a href={customer.website} target="_blank" rel="noopener noreferrer">{customer.website}</a></dd>
			{/if}
			{#if customer.notes}
				<dt>備考</dt><dd class="notes">{customer.notes}</dd>
			{/if}
		</dl>
	</section>

	<!-- 担当者 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">担当者</h4>
			<button class="action-btn" onclick={openNewContact}>+ 新規登録</button>
		</div>
		{#if contacts.length === 0}
			<p class="empty">担当者は登録されていません</p>
		{:else}
			<ul class="item-list">
				{#each contacts as c}
					<li class="item-row">
						<span class="item-name">{c.name}</span>
						{#if c.role || c.department}
							<span class="item-sub">{[c.role, c.department].filter(Boolean).join(' / ')}</span>
						{/if}
						{#if c.email}
							<span class="item-meta">{c.email}</span>
						{/if}
						{#if c.phone}
							<span class="item-meta">{c.phone}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- 案件 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">案件</h4>
			<button class="action-btn" onclick={openNewDeal}>+ 新規登録</button>
		</div>
		{#if deals.length === 0}
			<p class="empty">案件は登録されていません</p>
		{:else}
			<ul class="item-list">
				{#each deals as d}
					<li class="item-row">
						<span class="item-name">{d.title}</span>
						<span class="deal-status status-{d.status}">
							{DEAL_STATUS_LABELS[d.status] ?? d.status}
						</span>
						{#if d.amount != null}
							<span class="item-meta">{fmtAmount(d.amount)}</span>
						{/if}
						{#if d.plannedEnd}
							<span class="item-meta">終了予定: {fmtDate(d.plannedEnd)}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- 活動履歴 -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">活動履歴</h4>
			<button class="action-btn" onclick={openNewActivity}>+ 新規登録</button>
		</div>
		{#if activities.length === 0}
			<p class="empty">活動履歴は登録されていません</p>
		{:else}
			<ul class="item-list">
				{#each activities as a}
					<li class="item-row">
						<span class="activity-type">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
						<span class="item-meta">{fmtDate(a.activityDate ?? a.createdAt)}</span>
						<span class="activity-content">{a.content}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- AIヘルススコア -->
	<section class="section">
		<div class="section-header">
			<h4 class="section-subtitle">AIヘルススコア</h4>
			<button class="action-btn" onclick={runHealthScore} disabled={healthLoading}>
				{healthLoading ? '評価中…' : healthScore ? '再評価' : 'AIで評価'}
			</button>
		</div>
		<div class="health-body">
			{#if healthError}
				<p class="health-error">{healthError}</p>
			{:else if !healthScore}
				<p class="empty">「AIで評価」を押すと、活動履歴・案件状況からヘルススコアを算出します。</p>
			{:else}
				<div class="health-head">
					<span class="health-score health-{healthScore.level}">{healthScore.score}</span>
					<span class="health-level-badge health-{healthScore.level}">
						{HEALTH_LEVEL_LABELS[healthScore.level] ?? healthScore.level}
					</span>
					{#if healthScore.updatedAt}
						<span class="health-date">{fmtDate(healthScore.updatedAt)} 評価</span>
					{/if}
				</div>
				{#if healthScore.summary}
					<p class="health-summary">{healthScore.summary}</p>
				{/if}
				{#if healthScore.positives.length > 0}
					<div class="health-group">
						<span class="health-group-title">良い点</span>
						<ul class="health-list good">
							{#each healthScore.positives as item}<li>{item}</li>{/each}
						</ul>
					</div>
				{/if}
				{#if healthScore.concerns.length > 0}
					<div class="health-group">
						<span class="health-group-title">懸念点</span>
						<ul class="health-list risk">
							{#each healthScore.concerns as item}<li>{item}</li>{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</div>
	</section>

</div>

<style lang="scss">
	.customer-detail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 100%;
		
	}

	/* ---- セクション ---- */
	.section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.section-title {
		font-size: 0.9375rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-text);
	}

	.section-subtitle {
		font-size: 0.8125rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* ---- アクションボタン ---- */
	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.action-btn {
		padding: 4px 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, transparent);
		}

		&.danger:hover {
			border-color: var(--color-error);
			color: var(--color-error);
			background: color-mix(in srgb, var(--color-error) 6%, transparent);
		}
	}

	/* ---- 顧客情報グリッド ---- */
	.info-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 8px 16px;
		padding: 14px 16px;
		margin: 0;
		font-size: 0.875rem;

		dt {
			color: var(--color-text-muted);
			white-space: nowrap;
			display: flex;
			align-items: center;
		}

		dd {
			margin: 0;
			color: var(--color-text);
			word-break: break-all;
			display: flex;
			align-items: center;
		}

		dd.notes {
			white-space: pre-wrap;
			align-items: flex-start;
		}

		a {
			color: var(--color-primary);
			text-decoration: none;
			&:hover { text-decoration: underline; }
		}
	}

	/* ---- ステータスバッジ ---- */
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;

		&.status-active  { background: var(--color-success-bg); color: var(--color-success); }
		&.status-inactive { background: var(--color-neutral-bg); color: var(--color-neutral); }
	}

	.deal-status {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		flex-shrink: 0;

		&.status-open { background: var(--color-info-bg); color: var(--color-info); }
		&.status-won  { background: var(--color-success-bg); color: var(--color-success); }
		&.status-lost { background: var(--color-error-bg); color: var(--color-error); }
	}

	.activity-type {
		display: inline-flex;
		align-items: center;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		background: var(--color-border);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	/* ---- リスト ---- */
	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;

		li + li {
			border-top: 1px solid var(--color-border);
		}
	}

	.item-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 16px;
		font-size: 0.875rem;
	}

	.item-name {
		font-weight: 500;
		color: var(--color-text);
	}

	.item-sub {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.item-meta {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		margin-left: auto;
	}

	.activity-content {
		width: 100%;
		color: var(--color-text);
		line-height: 1.5;
		white-space: pre-wrap;
		font-size: 0.8125rem;
		margin-top: 2px;
	}

	.empty {
		padding: 12px 16px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ---- AIヘルススコア ---- */
	.health-body {
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.health-error {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-error);
	}

	.health-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.health-score {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1;

		&.health-good { color: var(--color-success); }
		&.health-warning { color: var(--color-warning); }
		&.health-risk { color: var(--color-error); }
	}

	.health-level-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		border-radius: 20px;
		border: 1px solid;
		font-size: 0.75rem;
		font-weight: 600;

		&.health-good { color: var(--color-success); border-color: var(--color-success); }
		&.health-warning { color: var(--color-warning); border-color: var(--color-warning); }
		&.health-risk { color: var(--color-error); border-color: var(--color-error); }
	}

	.health-date {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.health-summary {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--color-text);
	}

	.health-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.health-group-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.health-list {
		margin: 0;
		padding-left: 1.4em;
		font-size: 0.875rem;
		line-height: 1.7;
		display: flex;
		flex-direction: column;
		gap: 2px;

		&.good li::marker { color: var(--color-success); }
		&.risk li::marker { color: var(--color-error); }
	}
</style>
