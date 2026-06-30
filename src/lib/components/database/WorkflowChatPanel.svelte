<script lang="ts">
	import { tick } from 'svelte';
	import ArrowUp from '$lib/components/icon/ArrowUp.svelte';
	import type { WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import type { WorkflowContent } from '$lib/types/chat';
	import { marked } from 'marked';
	import { filterXSS } from 'xss';

	type DialogMessage = { role: 'user' | 'assistant'; text: string };

	type Props = {
		getCurrent: () => WorkflowState;
		onApply: (state: WorkflowState) => void;
	};

	let { getCurrent, onApply }: Props = $props();

	let chatMessages = $state<DialogMessage[]>([]);
	let chatInput = $state('');
	let chatLoading = $state(false);
	let chatListEl = $state<HTMLElement | null>(null);

	$effect(() => {
		void chatMessages.length;
		tick().then(() => {
			if (chatListEl) chatListEl.scrollTop = chatListEl.scrollHeight;
		});
	});

	function renderMarkdown(text: string): string {
		return filterXSS(marked.parse(text, { async: false }) as string);
	}

	async function sendChat() {
		const text = chatInput.trim();
		if (!text || chatLoading) return;
		chatInput = '';
		chatMessages = [...chatMessages, { role: 'user', text }];
		chatLoading = true;

		let assistantText = '';
		chatMessages = [...chatMessages, { role: 'assistant', text: '' }];

		try {
			const res = await fetch('/api/workflow-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: text,
					current: getCurrent(),
					history: chatMessages.slice(0, -2)
				})
			});

			if (!res.ok || !res.body) {
				chatMessages = [
					...chatMessages.slice(0, -1),
					{ role: 'assistant', text: 'エラーが発生しました。' }
				];
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';
				for (const part of parts) {
					if (!part.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(part.slice(6)) as {
							type: string;
							text?: string;
							content?: WorkflowContent;
						};
						if (event.type === 'delta' && event.text) {
							assistantText += event.text;
							chatMessages = [
								...chatMessages.slice(0, -1),
								{ role: 'assistant', text: assistantText }
							];
						} else if (event.type === 'ui' && event.content?.type === 'workflow') {
							const c = event.content;
							onApply({
								name: c.name,
								triggerType: c.triggerType,
								triggerHour: c.triggerHour,
								triggerMinute: c.triggerMinute,
								triggerEvent: c.triggerEvent,
								triggerEntityTypeId: c.triggerEntityTypeId,
								steps: c.steps
							});
						}
					} catch {
						// ignore parse error
					}
				}
			}
		} finally {
			chatLoading = false;
		}
	}

	function handleChatKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			sendChat();
		}
	}
</script>

<div class="chat-panel">
	<div class="chat-messages" bind:this={chatListEl}>
		{#if chatMessages.length === 0}
			<p class="chat-empty">どんな自動化フローにしたいか、話しかけてみてください。提案内容は右側に反映されます。</p>
		{/if}
		{#each chatMessages as msg}
			<div class="chat-msg {msg.role}">
				{#if msg.role === 'assistant'}
					{#if msg.text}
						<div class="msg-text">{@html renderMarkdown(msg.text)}</div>
					{:else}
						<div class="typing-dots"><span></span><span></span><span></span></div>
					{/if}
				{:else}
					<div class="msg-text">{msg.text}</div>
				{/if}
			</div>
		{/each}
	</div>
	<div class="chat-input-row">
		<textarea
			bind:value={chatInput}
			onkeydown={handleChatKey}
			placeholder="例: 顧客数が10件を超えたら通知して"
			rows="2"
			disabled={chatLoading}
		></textarea>
		<button class="chat-send" onclick={sendChat} disabled={chatLoading || !chatInput.trim()} aria-label="送信">
			<ArrowUp size={14} />
		</button>
	</div>
</div>

<style lang="scss">
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background: var(--color-surface);
	}

	.chat-messages {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.chat-empty {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.6;
	}

	.chat-msg {
		display: flex;
		flex-direction: column;

		&.user {
			align-items: flex-end;

			.msg-text {
				background: var(--color-surface);
				border: 1px solid var(--color-border);
				border-radius: 12px;
				border-bottom-right-radius: 3px;
				padding: 7px 12px;
				font-size: 0.8125rem;
				max-width: 90%;
				word-break: break-word;
				white-space: pre-wrap;
			}
		}

		&.assistant {
			align-items: flex-start;

			.msg-text {
				font-size: 0.8125rem;
				line-height: 1.65;
				color: var(--color-text);

				:global(p) {
					margin: 0 0 0.4em;
					&:last-child { margin-bottom: 0; }
				}
				:global(ul), :global(ol) {
					padding-left: 1.2em;
					margin: 0.2em 0;
				}
				:global(code) {
					font-size: 0.85em;
					background: var(--color-border);
					padding: 0.1em 0.3em;
					border-radius: 3px;
				}
			}
		}
	}

	.typing-dots {
		display: flex;
		gap: 4px;
		padding: 6px 0;

		span {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--color-text-muted);
			animation: bounce 1.2s infinite;

			&:nth-child(2) { animation-delay: 0.2s; }
			&:nth-child(3) { animation-delay: 0.4s; }
		}
	}

	.chat-input-row {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding: 10px 14px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;

		textarea {
			flex: 1;
			resize: none;
			border: 1px solid var(--color-border);
			border-radius: 10px;
			padding: 7px 10px;
			font-size: 0.8125rem;
			font-family: inherit;
			line-height: 1.5;
			background: var(--color-surface);
			color: var(--color-text);
			outline: none;
			transition: border-color 0.15s;
			max-height: 100px;
			overflow-y: auto;
			background-color: #fff;

			&:focus { border-color: var(--color-primary); }
			&::placeholder { color: var(--color-text-muted); }
			&:disabled { opacity: 0.5; }
		}
	}

	.chat-send {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: var(--color-primary);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: opacity 0.15s;
		margin-bottom: 1px;

		&:disabled { opacity: 0.35; cursor: not-allowed; }
		&:not(:disabled):hover { opacity: 0.85; }
	}

	@keyframes bounce {
		0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}
</style>
