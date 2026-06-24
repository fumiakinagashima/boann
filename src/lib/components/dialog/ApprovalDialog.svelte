<script lang="ts">
	import { onMount } from 'svelte';
	import X from '$lib/components/icon/X.svelte';
	import ApprovalDetail from './ApprovalDetail.svelte';
	import ApprovalForm from './ApprovalForm.svelte';
	import DialogChatSide from './DialogChatSide.svelte';
	import type { ApprovalRow } from '$lib/server/db/approval-service';
	import type { AccountRow } from '$lib/server/db/account-service';

	type Props = {
		mode: 'detail' | 'create';
		id?: string;
		accountOptions?: AccountRow[];
		accountId?: string;
		onclose: () => void;
		onChanged?: (row: ApprovalRow) => void;
		onCreated?: (id: string) => void;
	};

	let { mode, id, accountOptions = [], accountId, onclose, onChanged, onCreated }: Props = $props();

	let row = $state<ApprovalRow | null>(null);
	let loading = $state(mode === 'detail');

	onMount(async () => {
		if (mode !== 'detail' || !id) return;
		try {
			const res = await fetch(`/api/approvals/${id}`);
			row = res.ok ? ((await res.json()) as ApprovalRow) : null;
		} catch {
			row = null;
		} finally {
			loading = false;
		}
	});

	const title = $derived(mode === 'create' ? '新規申請' : (row?.title ?? '申請詳細'));
	const chatContextFields = $derived(
		mode === 'create'
			? [
					{ key: 'title', label: 'タイトル' },
					{ key: 'content', label: '申請内容' },
					{ key: 'route', label: '承認ルート' }
				]
			: []
	);

	const APPROVAL_STATUS_LABELS: Record<string, string> = {
		pending: '審査中',
		approved: '承認',
		rejected: '否決',
		cancelled: '取り消し'
	};

	// 詳細表示中の申請を AI アシスタントに渡し、「この申請」等の指示語を解決できるようにする
	const chatRecordContext = $derived.by(() => {
		if (mode !== 'detail' || !row) return null;
		return {
			type: 'approvals',
			typeLabel: '申請',
			id: row.id,
			label: row.title,
			data: {
				申請者: row.submittedBy,
				ステータス: APPROVAL_STATUS_LABELS[row.status] ?? row.status,
				内容: row.content
			} as Record<string, unknown>
		};
	});
</script>

<div class="overlay" role="presentation"></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label={title}>
	<div class="dialog-header">
		<span class="dialog-title">{title}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>
	<div class="dialog-body">
		<DialogChatSide contextTitle={title} contextFields={chatContextFields} recordContext={chatRecordContext} />

		<div class="content-side">
			{#if mode === 'create'}
				<ApprovalForm {accountOptions} {onCreated} oncancel={onclose} />
			{:else if loading}
				<div class="loading-wrap"><span class="spinner"></span></div>
			{:else if !row}
				<p class="error-text">申請が見つかりません。</p>
			{:else}
				<ApprovalDetail initialRow={row} {accountId} {onChanged} />
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
		animation: fade-in 0.2s ease;
	}

	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 201;
		width: min(1280px, 97vw);
		height: min(840px, 97vh);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: dialog-in 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.dialog-title {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: color-mix(in srgb, var(--color-text) 8%, transparent);
			color: var(--color-text);
		}
	}

	.dialog-body {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}

	.content-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px 28px;
		border-left: 1px solid var(--color-border);
	}

	.loading-wrap {
		display: flex;
		justify-content: center;
		padding: 48px 0;
	}

	.spinner {
		width: 22px;
		height: 22px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.error-text {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-align: center;
		padding: 32px 0;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
