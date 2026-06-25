<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const type = $derived($page.params.type);
	const id = $derived($page.params.id);
	const info = $derived(data.info);
	const record = $derived(data.record);
	const refLabels = $derived(data.refLabels);

	let deleting = $state(false);

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
</style>
