<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatJstDateTime } from '$lib/datetime';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import type { WorkflowRow } from '$lib/server/db/workflow-service';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rows = $state<WorkflowRow[]>(untrack(() => data.rows));
	$effect(() => { rows = data.rows; });

	let deletingId = $state<string | null>(null);

	function triggerLabel(row: WorkflowRow): string {
		return `毎日 ${String(row.triggerHour).padStart(2, '0')}:${String(row.triggerMinute).padStart(2, '0')}`;
	}

	async function deleteWorkflow(e: MouseEvent, id: string, name: string) {
		e.stopPropagation();
		if (!confirm(`ワークフロー「${name}」を削除しますか？`)) return;
		deletingId = id;
		try {
			const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				toast.error(((await res.json()) as { error?: string }).error ?? '削除に失敗しました');
				return;
			}
			rows = rows.filter((r) => r.id !== id);
			toast.success(`「${name}」を削除しました`);
		} finally {
			deletingId = null;
		}
	}

	// ── Resizable split ────────────────────────────────────────
	const CHAT_MIN = 220, CHAT_MAX = 640;
	let chatWidth = $state(340);
	let resizing = $state(false);

	function onResizerMouseDown(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startWidth = chatWidth;
		function onMove(e: MouseEvent) {
			chatWidth = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth + (startX - e.clientX)));
		}
		function onUp() {
			resizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

<svelte:head><title>ワークフロー</title></svelte:head>

<div class="wf-layout" style="grid-template-columns: 1fr 5px {chatWidth}px" class:resizing>
	<div class="list-panel">
		<div class="page-header">
			<h1>ワークフロー</h1>
			<button class="btn-primary" onclick={() => goto('/workflows/new')}>+ 新規作成</button>
		</div>

		{#if rows.length === 0}
			<div class="empty">
				<p>ワークフローはまだありません。</p>
				<p class="empty-hint">右のAIに「毎日〇時に〇〇を通知して」と話しかけてみてください。</p>
				<button class="btn-primary" onclick={() => goto('/workflows/new')}>新規作成する</button>
			</div>
		{:else}
			<div class="wf-list">
				{#each rows as row (row.id)}
					<div
						class="wf-card"
						role="link"
						tabindex="0"
						onclick={() => goto(`/workflows/${row.id}`)}
						onkeydown={(e) => { if (e.key === 'Enter') goto(`/workflows/${row.id}`); }}
					>
						<span class="status-badge status-{row.enabled ? 'enabled' : 'disabled'}">
							{row.enabled ? '有効' : '無効'}
						</span>
						<div class="wf-card-info">
							<span class="wf-name">{row.name}</span>
							<span class="wf-meta">
								{triggerLabel(row)} · ステップ{row.steps.length}件 · {formatJstDateTime(row.updatedAt)} 更新
							</span>
						</div>
						<div class="wf-card-actions">
							<button class="btn-secondary" onclick={() => goto(`/workflows/${row.id}`)}>開く</button>
							<button
								class="btn-danger"
								disabled={deletingId === row.id}
								onclick={(e) => deleteWorkflow(e, row.id, row.name)}
							>
								{deletingId === row.id ? '削除中…' : '削除'}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div
		class="resizer"
		onmousedown={onResizerMouseDown}
		role="separator"
		aria-label="パネル幅を調整"
		aria-orientation="vertical"
	></div>

	<div class="chat-col">
		<div class="chat-col-header">AIアシスタント</div>
		<ChatPanel
			placeholder="ワークフローを作成・編集する指示を入力…"
			onAction={() => invalidateAll()}
		/>
	</div>
</div>

<style lang="scss">
	.wf-layout {
		display: grid;
		height: 100%;
		overflow: hidden;

		&.resizing {
			cursor: col-resize;
			user-select: none;
		}
	}

	.list-panel {
		padding: 28px 32px;
		overflow-y: auto;
	}

	.resizer {
		width: 5px;
		cursor: col-resize;
		background: var(--color-border);
		transition: background 0.15s;
		position: relative;

		&::after {
			content: '';
			position: absolute;
			inset: 0 -4px;
		}

		&:hover, .resizing & {
			background: var(--color-primary);
		}
	}

	.chat-col {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		border-left: 1px solid var(--color-border);
	}

	.chat-col-header {
		padding: 12px 16px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		background: var(--color-surface);
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;

		h1 {
			font-size: 1.375rem;
			font-weight: 700;
			color: var(--color-text);
		}
	}

	.btn-primary {
		padding: 7px 16px;
		border-radius: 6px;
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

	.empty {
		text-align: center;
		padding: 60px 0;
		color: var(--color-text-muted);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.empty-hint {
		font-size: 0.875rem;
		margin: 0;
	}

	.wf-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
	}

	.wf-card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 16px;
		background: var(--color-surface);
		cursor: pointer;
		transition: background 0.12s;

		&:not(:last-child) { border-bottom: 1px solid var(--color-border); }
		&:hover { background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)); }
	}

	.status-badge {
		flex-shrink: 0;
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 20px;
		border: 1px solid;
		font-weight: 500;
		white-space: nowrap;

		&.status-enabled { color: var(--color-success); border-color: var(--color-success); }
		&.status-disabled { color: var(--color-text-muted); border-color: var(--color-border); }
	}

	.wf-card-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.wf-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.wf-meta {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.wf-card-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.btn-secondary {
		padding: 5px 12px;
		border-radius: 5px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text);
		cursor: pointer;
		&:hover { background: var(--color-border); }
	}

	.btn-danger {
		padding: 5px 12px;
		border-radius: 5px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		&:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; }
		&:disabled { opacity: 0.5; cursor: not-allowed; }
	}
</style>
