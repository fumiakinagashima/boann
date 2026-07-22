<script lang="ts">
	import { untrack } from 'svelte';
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import type { PageData } from './$types';

	// TODO: 接続確認用のテスト送信機能(2026-07-22、ユーザー要望)。UIをどうするか未検討のため保留。
	// 実装時はここ(一覧の各行、または編集フォーム内)にボタンを追加し、サーバー側でheadersを付けて
	// 実際にurlへ疎通確認リクエストを送る新規APIエンドポイントが必要になる想定。

	let { data }: { data: PageData } = $props();

	type Connection = {
		id: string;
		name: string;
		url: string;
		headers: Record<string, string>;
		createdAt: Date;
	};

	type HeaderRow = { key: string; value: string };

	type FormState = {
		name: string;
		url: string;
		headers: HeaderRow[];
	};

	let items = $state<Connection[]>(untrack(() => data.items));
	$effect(() => {
		items = data.items;
	});

	let editingId = $state<string | null>(null);
	let showForm = $state(false);
	let saving = $state(false);

	let form = $state<FormState>({ name: '', url: '', headers: [] });

	function headersToRows(headers: Record<string, string>): HeaderRow[] {
		return Object.entries(headers).map(([key, value]) => ({ key, value }));
	}

	function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
		const headers: Record<string, string> = {};
		for (const row of rows) {
			if (row.key.trim()) headers[row.key.trim()] = row.value;
		}
		return headers;
	}

	function openAdd() {
		editingId = null;
		form = { name: '', url: '', headers: [] };
		showForm = true;
	}

	function openEdit(item: Connection) {
		editingId = item.id;
		form = { name: item.name, url: item.url, headers: headersToRows(item.headers) };
		showForm = true;
	}

	function cancel() {
		showForm = false;
		editingId = null;
	}

	function addHeaderRow() {
		form.headers = [...form.headers, { key: '', value: '' }];
	}

	function removeHeaderRow(index: number) {
		form.headers = form.headers.filter((_, i) => i !== index);
	}

	async function save() {
		saving = true;
		try {
			const payload = { name: form.name, url: form.url, headers: rowsToHeaders(form.headers) };
			if (editingId) {
				const res = await fetch(`/api/api-connections/${editingId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const updated = (await res.json()) as Connection;
				items = items.map((i) => (i.id === editingId ? updated : i));
			} else {
				const res = await fetch('/api/api-connections', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const created = (await res.json()) as Connection;
				items = [...items, created].sort((a, b) => a.name.localeCompare(b.name));
			}
			cancel();
		} finally {
			saving = false;
		}
	}

	async function remove(id: string) {
		if (!confirm('この連携設定を削除しますか？')) return;
		await fetch(`/api/api-connections/${id}`, { method: 'DELETE' });
		items = items.filter((i) => i.id !== id);
	}
</script>

<svelte:head><title>連携設定 — BOANN</title></svelte:head>

<div class="page">
	<div class="header">
		<h1>連携設定</h1>
		<button class="add-btn" onclick={openAdd}>+ 追加</button>
	</div>
	<p class="intro">
		ワークフローの「外部APIを呼び出す」アクションから使う、外部APIへの接続設定です（システム全体で共有されます）。
	</p>

	{#if items.length === 0 && !showForm}
		<p class="empty">まだ連携設定がありません</p>
	{/if}

	<ul class="list">
		{#each items as item (item.id)}
			<li class="item">
				<div class="item-info">
					<span class="item-name">{item.name}</span>
					<span class="item-url">{item.url}</span>
				</div>
				<div class="item-meta">
					<span class="badge">ヘッダー{Object.keys(item.headers).length}件</span>
					<button class="link-btn" onclick={() => openEdit(item)}>編集</button>
					<button class="link-btn danger" onclick={() => remove(item.id)}>削除</button>
				</div>
			</li>
		{/each}
	</ul>

	{#if showForm}
		<div class="form-card">
			<h2>{editingId ? '連携設定を編集' : '連携設定を追加'}</h2>
			<div class="fields">
				<Textbox label="APIの名前" bind:value={form.name} required />
				<Textbox label="URL" bind:value={form.url} placeholder="https://api.example.com" required />

				<div class="headers-field">
					<span class="headers-label">ヘッダー情報</span>
					{#each form.headers as row, i (i)}
						<div class="header-row">
							<input class="header-key" type="text" placeholder="キー（例: Authorization）" bind:value={row.key} />
							<input class="header-value" type="text" placeholder="値" bind:value={row.value} />
							<button class="header-del" onclick={() => removeHeaderRow(i)} title="削除">×</button>
						</div>
					{/each}
					<button class="add-header-btn" onclick={addHeaderRow}>＋ ヘッダーを追加</button>
				</div>
			</div>
			<div class="form-actions">
				<button class="cancel-btn" onclick={cancel}>キャンセル</button>
				<button class="save-btn" onclick={save} disabled={saving || !form.name || !form.url}>保存</button>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.page {
		padding: 40px 48px;
		max-width: 720px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.intro {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 28px;
	}

	.add-btn {
		padding: 8px 16px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.add-btn:hover { opacity: 0.85; }

	.empty {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		margin-top: 40px;
		text-align: center;
	}

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 24px;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-name {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.item-url {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.badge {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.link-btn {
		background: none;
		border: none;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0;
	}

	.link-btn:hover { color: var(--color-text); }
	.link-btn.danger:hover { color: var(--color-danger); }

	.form-card {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 24px;
		background: var(--color-surface);
	}

	h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 20px;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 24px;
	}

	.headers-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.headers-label {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;

		input {
			padding: 8px 10px;
			border: 1px solid var(--color-border);
			border-radius: 6px;
			background: var(--color-background);
			color: var(--color-text);
			font-size: 0.9375rem;
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}

		.header-key {
			flex: 3 1 0;
		}

		.header-value {
			flex: 7 1 0;
		}
	}

	.header-del {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 15px;
		padding: 0 4px;
		flex-shrink: 0;
		&:hover { color: var(--color-danger); }
	}

	.add-header-btn {
		align-self: flex-start;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		background: none;
		border: 1px dashed var(--color-border);
		padding: 4px 10px;
		border-radius: 5px;
		cursor: pointer;
		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	.cancel-btn {
		padding: 8px 16px;
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.cancel-btn:hover { border-color: var(--color-text-muted); }

	.save-btn {
		padding: 8px 20px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.save-btn:not(:disabled):hover { opacity: 0.85; }
</style>
