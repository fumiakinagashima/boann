<script lang="ts">
	import { untrack } from 'svelte';
	import Form from '$lib/components/chat/Form.svelte';
	import type { ReminderListRow } from '$lib/server/db/reminder-service';
	import type { ReminderDeliveryResult } from '$lib/server/reminders/delivery';
	import type { FormField } from '$lib/types/chat';
	import type { PageData } from './$types';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatJstDateTime, nowJstDatetimeLocal, toJstDatetimeLocal } from '$lib/datetime';
	import * as m from '$lib/paraglide/messages.js';

	let { data }: { data: PageData } = $props();

	let rows = $state<ReminderListRow[]>(untrack(() => data.rows));
	$effect(() => {
		rows = data.rows;
	});

	const STATUS_LABELS: Record<string, string> = {
		pending: m.reminder_status_pending(), sent: m.reminder_status_sent(), failed: m.reminder_status_failed()
	};
	const STATUS_COLORS: Record<string, string> = {
		pending: 'var(--color-warning)', sent: 'var(--color-success)', failed: 'var(--color-error)'
	};

	let formKey = $state(0);
	let editingRow = $state<ReminderListRow | null>(null);

	function buildFormFields(): FormField[] {
		const row = editingRow;
		return [
			{ key: 'remind_at', label: '日時', type: 'datetime-local', required: true,
				value: row ? toJstDatetimeLocal(new Date(row.remindAt)) : nowJstDatetimeLocal() },
			{ key: 'channels', label: '通知先', type: 'multiselect', required: true,
				value: row ? row.channels.join(',') : 'notification', options: data.channelOptions },
			{ key: 'content', label: '内容', type: 'textarea', required: true,
				value: row ? row.content : '' }
		];
	}

	function startEdit(row: ReminderListRow) {
		editingRow = row;
		formKey += 1;
	}

	function cancelEdit() {
		editingRow = null;
		formKey += 1;
	}

	let submitting = $state(false);
	let formError = $state('');

	async function handleSubmit(values: Record<string, string>) {
		if (submitting) return;
		submitting = true;
		formError = '';
		try {
			if (editingRow) {
				const res = await fetch(`/api/reminders/${editingRow.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(values)
				});
				if (!res.ok) {
					const err = (await res.json()) as { error?: string };
					formError = err.error ?? '更新に失敗しました。';
					return;
				}
				const updated = (await res.json()) as ReminderListRow;
				rows = rows.map(r => r.id === updated.id ? updated : r)
					.sort((a, b) => new Date(b.remindAt).getTime() - new Date(a.remindAt).getTime());
				editingRow = null;
				formKey += 1;
			} else {
				const res = await fetch('/api/reminders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(values)
				});
				if (!res.ok) {
					const err = (await res.json()) as { error?: string };
					formError = err.error ?? '登録に失敗しました。';
					return;
				}
				const row = (await res.json()) as ReminderListRow;
				rows = [row, ...rows].sort((a, b) => new Date(b.remindAt).getTime() - new Date(a.remindAt).getTime());
				formKey += 1;
			}
		} finally {
			submitting = false;
		}
	}

	async function deleteRow(id: string) {
		if (!confirm('このリマインダーを削除しますか？')) return;
		await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
		rows = rows.filter(r => r.id !== id);
	}

	let running = $state(false);
	async function runDelivery() {
		if (running) return;
		running = true;
		try {
			const res = await fetch('/api/reminders/run', { method: 'POST' });
			if (!res.ok) {
				toast.error('配信の実行に失敗しました。');
				return;
			}
			const { results } = (await res.json()) as { results: ReminderDeliveryResult[] };
			if (results.length === 0) {
				toast.info(m.reminder_run_result_none());
			} else {
				const sent = results.filter((r) => r.status === 'sent').length;
				const failed = results.filter((r) => r.status === 'failed').length;
				if (sent > 0) toast.success(m.reminder_run_result_sent({ count: sent }));
				if (failed > 0) toast.error(m.reminder_run_result_failed({ count: failed }));

				const statusById = new Map(results.map((r) => [r.id, r.status]));
				rows = rows.map((row) => (statusById.has(row.id) ? { ...row, status: statusById.get(row.id)! } : row));
			}
		} finally {
			running = false;
		}
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>リマインダー</span>
		</div>
		<button class="btn-primary" onclick={runDelivery} disabled={running}>
			{running ? m.reminder_run_running() : m.reminder_run_button()}
		</button>
	</header>

	<section class="form-section">
		{#key formKey}
			<Form
				title={editingRow ? 'リマインダーを編集' : 'リマインダーを登録'}
				fields={buildFormFields()}
				submitLabel={editingRow ? '更新' : '登録'}
				onsubmit={handleSubmit}
				oncancel={editingRow ? cancelEdit : undefined}
			/>
		{/key}
		{#if formError}
			<p class="form-error">{formError}</p>
		{/if}
	</section>

	{#if rows.length === 0}
		<div class="empty">
			<p>リマインダーが登録されていません。</p>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>日時</th>
						<th>内容</th>
						<th>通知先</th>
						<th>ステータス</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						<tr>
							<td class="datetime-cell">{formatJstDateTime(row.remindAt)}</td>
							<td class="content-cell">{row.content}</td>
							<td class="muted">{row.channelLabels.join(' / ')}</td>
							<td>
								<span class="status-badge status-{row.status}">
									{STATUS_LABELS[row.status] ?? row.status}
								</span>
							</td>
							<td class="actions">
								{#if row.status === 'pending'}
									<button class="action-edit" onclick={() => startEdit(row)}>編集</button>
								{/if}
								<button class="action-del" onclick={() => deleteRow(row.id)}>削除</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

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
	}
	.breadcrumb a { color: var(--color-primary); text-decoration: none; }
	.breadcrumb a:hover { text-decoration: underline; }
	.sep { color: var(--color-text-muted); }
	.breadcrumb span:last-child { font-weight: 600; }

	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-error {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-danger, var(--color-error));
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
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	tbody tr:last-child td { border-bottom: none; }

	.datetime-cell { font-weight: 500; white-space: nowrap; }
	.content-cell { max-width: 400px; }
	.muted { color: var(--color-text-muted); }

	.status-badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;

		&.status-pending { color: var(--color-warning); border-color: var(--color-warning); }
		&.status-sent { color: var(--color-success); border-color: var(--color-success); }
		&.status-failed { color: var(--color-error); border-color: var(--color-error); }
	}

	.actions { text-align: right; white-space: nowrap; width: 1%; }
	.action-edit {
		background: none;
		border: none;
		color: var(--color-primary);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		margin-right: 12px;
	}
	.action-edit:hover { text-decoration: underline; }
	.action-del {
		background: none;
		border: none;
		color: var(--color-danger, var(--color-error));
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
	}
	.action-del:hover { text-decoration: underline; }

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		margin-top: 32px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
</style>
