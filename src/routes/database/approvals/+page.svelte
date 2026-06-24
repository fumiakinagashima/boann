<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import ApprovalDialog from '$lib/components/dialog/ApprovalDialog.svelte';
	import type { ApprovalListRow } from '$lib/server/db/approval-service';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	let rows = $state<ApprovalListRow[]>(untrack(() => data.rows));
	$effect(() => {
		rows = data.rows;
	});

	// 詳細・新規申請をダイアログで開く
	let dialog = $state<{ mode: 'detail' | 'create'; id?: string } | null>(null);

	async function afterChange() {
		await invalidateAll();
	}

	const STATUS_LABELS: Record<string, string> = {
		pending: m.approval_status_pending(), approved: m.approval_status_approved(),
		rejected: m.approval_status_rejected(), cancelled: m.approval_status_cancelled()
	};
	const STATUS_COLORS: Record<string, string> = {
		pending: 'var(--color-warning)', approved: 'var(--color-success)', rejected: 'var(--color-error)', cancelled: 'var(--color-neutral)'
	};

	function fmtDate(d: string | Date): string {
		const dt = new Date(d);
		return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
	}

	function currentApprover(row: ApprovalListRow): string {
		const pending = row.route.find(s => s.status === 'pending');
		return pending?.approver ?? '—';
	}

	async function deleteRow(id: string) {
		if (!confirm('この申請を削除しますか？')) return;
		await fetch(`/api/approvals/${id}`, { method: 'DELETE' });
		rows = rows.filter(r => r.id !== id);
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>申請管理</span>
		</div>
		<button class="btn-primary" onclick={() => (dialog = { mode: 'create' })}>+ 新規申請</button>
	</header>

	{#if rows.length === 0}
		<div class="empty">
			<p>申請がありません。</p>
			<button class="btn-primary" onclick={() => (dialog = { mode: 'create' })}>最初の申請を作成</button>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>タイトル</th>
						<th>ステータス</th>
						<th>現在の承認者</th>
						<th>申請者</th>
						<th>申請日</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr onclick={() => (dialog = { mode: 'detail', id: row.id })} class="clickable-row">
							<td class="title-cell">{row.title}</td>
							<td>
								<span class="status-badge status-{row.status}">
									{STATUS_LABELS[row.status] ?? row.status}
								</span>
							</td>
							<td>{currentApprover(row)}</td>
							<td>{row.submittedBy}</td>
							<td>{fmtDate(row.createdAt)}</td>
							<td class="actions" onclick={(e) => e.stopPropagation()}>
								<button class="action-del" onclick={() => deleteRow(row.id)}>削除</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if dialog}
	<ApprovalDialog
		mode={dialog.mode}
		id={dialog.id}
		accountOptions={data.accountOptions}
		accountId={data.accountId}
		onclose={() => (dialog = null)}
		onChanged={afterChange}
		onCreated={() => { dialog = null; afterChange(); }}
	/>
{/if}

<style lang="scss">
	.page {
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 20px;
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

		a { color: var(--color-primary); text-decoration: none; &:hover { text-decoration: underline; } }
		span:last-child { font-weight: 600; }
	}

	.sep { color: var(--color-text-muted); }

	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.table-wrap {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		flex-shrink: 0;
	}

	table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
	thead { background: var(--color-surface); }

	th {
		padding: 9px 14px;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-border);
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	tbody tr:last-child td { border-bottom: none; }

	.clickable-row {
		cursor: pointer;
		transition: background 0.1s;
		&:hover { background: var(--color-surface); }
	}

	.title-cell { font-weight: 500; }

	.status-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;

		&.status-pending { color: var(--color-warning); border-color: var(--color-warning); }
		&.status-approved { color: var(--color-success); border-color: var(--color-success); }
		&.status-rejected { color: var(--color-error); border-color: var(--color-error); }
		&.status-cancelled { color: var(--color-neutral); border-color: var(--color-neutral); }
	}

	.actions { text-align: right; white-space: nowrap; width: 1%; }

	.action-link {
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.8125rem;
		margin-right: 10px;
		&:hover { text-decoration: underline; }
	}

	.action-del {
		background: none;
		border: none;
		color: var(--color-danger, var(--color-error));
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		&:hover { text-decoration: underline; }
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		margin-top: 32px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
