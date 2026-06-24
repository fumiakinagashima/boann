<script lang="ts">
	import { onMount } from 'svelte';
	import { formatJstDateTime } from '$lib/datetime';
	import type { RecordRow } from '$lib/server/db/table-service';

	type Filter = { customerId?: string; type?: string[] };

	type Props = {
		title?: string;
		filter?: Filter;
	};

	let { title, filter }: Props = $props();

	type Activity = {
		id: string;
		customerId: string;
		type: string;
		content: string;
		createdAt: number | null;
		activityDate: number | null;
	};

	const TYPE_LABELS: Record<string, string> = {
		note: 'メモ',
		call: '電話',
		email: 'メール',
		meeting: '面談',
		deal_created: '案件登録'
	};

	let activities = $state<Activity[]>([]);
	let customerMap = $state<Record<string, string>>({});
	let loading = $state(true);

	function displayTs(a: Activity): number {
		return a.activityDate ?? a.createdAt ?? 0;
	}

	const displayActivities = $derived(
		activities
			.filter((a) => {
				if (filter?.customerId && a.customerId !== filter.customerId) return false;
				if (filter?.type && filter.type.length > 0 && !filter.type.includes(a.type)) return false;
				return true;
			})
			.sort((a, b) => displayTs(b) - displayTs(a))
	);

	function fmtDate(ts: number | null): string {
		if (ts == null) return '—';
		return formatJstDateTime(new Date(ts * 1000));
	}

	function typeLabel(t: string): string {
		return TYPE_LABELS[t] ?? t;
	}

	onMount(async () => {
		const [actRes, custRes] = await Promise.all([
			fetch('/api/database/activities/records'),
			fetch('/api/database/customers/records')
		]);
		if (actRes.ok) {
			const data = (await actRes.json()) as { rows: RecordRow[] };
			activities = data.rows.map((r) => ({
				id: String(r.id),
				customerId: String(r.customerId ?? ''),
				type: String(r.type ?? 'note'),
				content: String(r.content ?? ''),
				createdAt: r.createdAt != null ? Number(r.createdAt) : null,
				activityDate: r.activityDate != null ? Number(r.activityDate) : null
			}));
		}
		if (custRes.ok) {
			const data = (await custRes.json()) as { rows: RecordRow[] };
			customerMap = Object.fromEntries(
				data.rows.map((r) => [String(r.id), String(r.name ?? '')])
			);
		}
		loading = false;
	});
</script>

<div class="timeline-card">
	{#if title}
		<div class="card-title">{title}</div>
	{/if}
	{#if loading}
		<p class="state">読み込み中...</p>
	{:else if displayActivities.length === 0}
		<p class="state">表示できる活動履歴がありません。</p>
	{:else}
		<ol class="timeline">
			{#each displayActivities as a (a.id)}
				<li class="item">
					<span class="marker" aria-hidden="true">
						<span class="dot type-{a.type}"></span>
					</span>
					<div class="body">
						<div class="meta">
							<span class="time">{fmtDate(a.activityDate ?? a.createdAt)}</span>
							<span class="badge type-{a.type}">{typeLabel(a.type)}</span>
							{#if customerMap[a.customerId]}
								<span class="customer">{customerMap[a.customerId]}</span>
							{/if}
						</div>
						<p class="content">{a.content}</p>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style lang="scss">
	.timeline-card {
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	.card-title {
		padding: 10px 14px;
		font-size: 0.875rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.state {
		padding: 20px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.timeline {
		list-style: none;
		margin: 0;
		padding: 18px 18px 18px 8px;
		display: flex;
		flex-direction: column;
	}

	.item {
		display: grid;
		grid-template-columns: 28px 1fr;
		column-gap: 12px;
		padding-bottom: 22px;

		&:last-child {
			padding-bottom: 0;
		}
	}

	/* vertical connector line drawn through the marker column */
	.marker {
		position: relative;
		display: flex;
		justify-content: center;
		padding-top: 3px;
	}

	.marker::before {
		content: '';
		position: absolute;
		top: 4px;
		bottom: -22px;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		background: var(--color-border);
	}

	.item:last-child .marker::before {
		display: none;
	}

	.dot {
		position: relative;
		z-index: 1;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-neutral);
		box-shadow: 0 0 0 3px var(--color-background);
	}

	.body {
		min-width: 0;
	}

	.meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 4px;
	}

	.time {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.badge {
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1;
		padding: 3px 8px;
		border-radius: 20px;
		color: #fff;
		background: var(--color-neutral);
	}

	.customer {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.content {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text);
		white-space: pre-wrap;
		word-break: break-word;
	}

	/* type colors (shared by dot and badge) */
	.type-note {
		background: var(--chart-1);
	}
	.type-call {
		background: var(--chart-2);
	}
	.type-email {
		background: var(--chart-6);
	}
	.type-meeting {
		background: var(--chart-5);
	}
	.type-deal_created {
		background: var(--chart-3);
	}
</style>
