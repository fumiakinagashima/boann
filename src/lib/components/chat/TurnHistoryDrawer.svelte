<script lang="ts">
	import X from '$lib/components/icon/X.svelte';
	import Copy from '$lib/components/icon/Copy.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { Message, MessageContent } from '$lib/types/chat';

	type Turn = { id: string; userMsg: Message | null; assistantMsgs: Message[] };

	type Props = {
		turns: Turn[];
		open: boolean;
		onclose: () => void;
	};

	let { turns, open, onclose }: Props = $props();

	function userText(msg: Message): string {
		return msg.contents
			.filter((c) => c.type === 'text')
			.map((c) => (c.type === 'text' ? c.text : ''))
			.join('\n');
	}

	function isTextOnly(msg: Message): boolean {
		return msg.contents.every((c) => c.type === 'text');
	}

	const SUMMARY_LABEL: Partial<Record<MessageContent['type'], string>> = {
		table: '一覧',
		actions: '選択肢',
		values: '詳細',
		gantt: 'ガントチャート',
		timeline: 'タイムライン',
		chart: 'グラフ',
		kanban: 'カンバン',
		link: 'リンク',
		document_job: '資料生成',
		reply: '質問',
		form: 'フォーム',
		workflow: 'ワークフロー'
	};

	function summarize(content: MessageContent): string {
		const withTitle = content as { title?: string; label?: string };
		const label = withTitle.title ?? withTitle.label ?? SUMMARY_LABEL[content.type] ?? 'UI';
		return `[${label}を表示]`;
	}

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('コピーしました');
		} catch {
			toast.error('コピーに失敗しました');
		}
	}
</script>

<div class="overlay" class:open role="presentation" onclick={onclose}></div>
<aside class="drawer" class:open aria-hidden={!open}>
	<div class="drawer-header">
		<h2>会話履歴</h2>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="drawer-body">
		{#if turns.length === 0}
			<p class="empty">履歴はありません</p>
		{:else}
			{#each [...turns].reverse() as turn (turn.id)}
				<div class="turn">
					{#if turn.userMsg}
						<p class="turn-user">{userText(turn.userMsg)}</p>
					{/if}
					{#each turn.assistantMsgs as msg}
						{#if isTextOnly(msg)}
							{@const text = userText(msg)}
							{#if text}
								<div class="turn-assistant-text">
									<p>{text}</p>
									<button class="copy-btn" onclick={() => copyText(text)} aria-label="コピー">
										<Copy size={13} />
									</button>
								</div>
							{/if}
						{:else}
							{#each msg.contents as content}
								<p class="turn-log">{summarize(content)}</p>
							{/each}
						{/if}
					{/each}
				</div>
			{/each}
		{/if}
	</div>
</aside>

<style lang="scss">
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 99;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.25s ease;

		&.open {
			opacity: 1;
			pointer-events: auto;
		}
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 360px;
		max-width: 85vw;
		background: var(--color-surface);
		border-left: 1px solid var(--color-border);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
		z-index: 100;
		display: flex;
		flex-direction: column;
		transform: translateX(100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

		&.open { transform: translateX(0); }
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 12px;
		border-bottom: 1px solid var(--color-border);

		h2 {
			margin: 0;
			font-size: 1rem;
			font-weight: 600;
			color: var(--color-text);
		}
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
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--color-background);
			color: var(--color-text);
		}
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.empty {
		padding: 24px 12px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.turn {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-border);

		&:last-child {
			border-bottom: none;
		}
	}

	.turn-user {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
		white-space: pre-wrap;
		word-break: break-word;
	}

	.turn-assistant-text {
		display: flex;
		align-items: flex-start;
		gap: 6px;

		p {
			flex: 1;
			min-width: 0;
			margin: 0;
			font-size: 0.8125rem;
			color: var(--color-text-muted);
			white-space: pre-wrap;
			word-break: break-word;
			line-height: 1.5;
		}
	}

	.copy-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;

		&:hover {
			background: var(--color-background);
			color: var(--color-text);
		}
	}

	.turn-log {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>
