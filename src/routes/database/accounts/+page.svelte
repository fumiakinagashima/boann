<script lang="ts">
	import { untrack } from 'svelte';
	import type { AccountRow } from '$lib/server/db/account-service';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rows = $state<AccountRow[]>(untrack(() => data.rows));
	$effect(() => {
		rows = data.rows;
	});

	// Add form
	let addName = $state('');
	let addEmail = $state('');
	let addRole = $state('');
	let addPermission = $state<'general' | 'admin'>('general');
	let adding = $state(false);
	let showAdd = $state(false);

	// Edit state
	let editId = $state<string | null>(null);
	let editName = $state('');
	let editEmail = $state('');
	let editRole = $state('');
	let editPermission = $state<'general' | 'admin'>('general');
	let saving = $state(false);

	async function addAccount() {
		if (!addName.trim()) return;
		adding = true;
		const res = await fetch('/api/accounts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: addName.trim(), email: addEmail.trim() || undefined, role: addRole.trim() || undefined, permission: addPermission })
		});
		if (res.ok) {
			const row = await res.json() as AccountRow;
			rows = [...rows, row].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			addName = ''; addEmail = ''; addRole = ''; addPermission = 'general';
			showAdd = false;
		}
		adding = false;
	}

	function startEdit(row: AccountRow) {
		editId = row.id;
		editName = row.name;
		editEmail = row.email ?? '';
		editRole = row.role ?? '';
		editPermission = row.permission;
	}

	async function saveEdit() {
		if (!editId || !editName.trim()) return;
		saving = true;
		const res = await fetch(`/api/accounts/${editId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() || undefined, role: editRole.trim() || undefined, permission: editPermission })
		});
		if (res.ok) {
			const updated = await res.json() as AccountRow;
			rows = rows.map(r => r.id === editId ? updated : r);
			editId = null;
		}
		saving = false;
	}

	async function deleteRow(id: string) {
		if (!confirm('このアカウントを削除しますか？')) return;
		await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
		rows = rows.filter(r => r.id !== id);
	}
</script>

<div class="page">
	<header class="page-header">
		<div class="breadcrumb">
			<a href="/database">データ管理</a>
			<span class="sep">/</span>
			<span>アカウント</span>
		</div>
		<button class="btn-primary" onclick={() => { showAdd = !showAdd; }}>+ 追加</button>
	</header>

	{#if showAdd}
		<div class="add-form">
			<input type="text" bind:value={addName} placeholder="名前 *" class="add-input" />
			<input type="text" bind:value={addRole} placeholder="役職" class="add-input" />
			<input type="email" bind:value={addEmail} placeholder="メール" class="add-input" />
			<select bind:value={addPermission} class="add-select">
				<option value="general">一般</option>
				<option value="admin">管理者</option>
			</select>
			<button class="btn-primary" onclick={addAccount} disabled={adding || !addName.trim()}>
				{adding ? '...' : '登録'}
			</button>
			<button class="btn-ghost" onclick={() => showAdd = false}>キャンセル</button>
		</div>
	{/if}

	{#if rows.length === 0}
		<p class="status">アカウントが登録されていません。</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>名前</th>
						<th>役職</th>
						<th>メール</th>
						<th>権限</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row}
						{#if editId === row.id}
							<tr class="edit-row">
								<td><input type="text" bind:value={editName} class="edit-input" /></td>
								<td><input type="text" bind:value={editRole} placeholder="役職" class="edit-input" /></td>
								<td><input type="email" bind:value={editEmail} placeholder="メール" class="edit-input" /></td>
								<td class="perm-cell">
									<select bind:value={editPermission} class="edit-input edit-select">
										<option value="general">一般</option>
										<option value="admin">管理者</option>
									</select>
								</td>
								<td class="actions">
									<button class="action-save" onclick={saveEdit} disabled={saving}>保存</button>
									<button class="action-link" onclick={() => editId = null}>キャンセル</button>
								</td>
							</tr>
						{:else}
							<tr>
								<td class="name-cell">{row.name}</td>
								<td class="muted">{row.role ?? '—'}</td>
								<td class="muted">{row.email ?? '—'}</td>
								<td class="perm-cell">
									<span class="perm-badge" class:perm-admin={row.permission === 'admin'}>
										{row.permission === 'admin' ? '管理者' : '一般'}
									</span>
								</td>
								<td class="actions">
									<button class="action-link" onclick={() => startEdit(row)}>編集</button>
									<button class="action-del" onclick={() => deleteRow(row.id)}>削除</button>
								</td>
							</tr>
						{/if}
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
		gap: 16px;
		max-width: 700px;
	}

	.page-header { display: flex; align-items: center; justify-content: space-between; }

	.breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 0.9375rem; }
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

	.btn-ghost {
		padding: 7px 14px;
		background: none;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.add-form {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		flex-wrap: wrap;
	}

	.add-input {
		flex: 1;
		min-width: 120px;
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
	}
	.add-input:focus { outline: none; border-color: var(--color-primary); }

	.add-select {
		padding: 7px 10px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
	}

	.perm-badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		background: var(--color-surface);
		white-space: nowrap;
	}
	.perm-badge.perm-admin {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
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
	}
	td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--color-border);
	}
	tbody tr:last-child td { border-bottom: none; }

	.name-cell { font-weight: 500; }
	.muted { color: var(--color-text-muted); font-size: 0.875rem; }

	.perm-cell { white-space: nowrap; width: 1%; }

	.edit-row td { padding: 6px 8px; }
	.edit-input {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--color-primary);
		border-radius: 5px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		box-sizing: border-box;
		&:focus { outline: none; }
	}
	.edit-select { width: auto; }

	.actions { text-align: right; white-space: nowrap; width: 1%; }
	.action-link, .action-save {
		background: none;
		border: none;
		color: var(--color-primary);
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
		margin-right: 10px;
	}
	.action-link:hover, .action-save:hover { text-decoration: underline; }
	.action-save:disabled { opacity: 0.4; cursor: not-allowed; }
	.action-del {
		background: none;
		border: none;
		color: var(--color-danger, var(--color-error));
		font-size: 0.8125rem;
		cursor: pointer;
		padding: 0;
	}
	.action-del:hover { text-decoration: underline; }

	.status { color: var(--color-text-muted); font-size: 0.875rem; }
</style>
