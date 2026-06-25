<script lang="ts">
	import { tick } from 'svelte';
	import { marked } from 'marked';
	import { filterXSS } from 'xss';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import ArrowUp from '$lib/components/icon/ArrowUp.svelte';
	import type { Message, MessageContent } from '$lib/types/chat';
	import type { StreamEvent } from '$lib/server/ai/stream';
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		placeholder?: string;
		onAction?: () => void;
	};
	let { placeholder = 'AIに相談する…', onAction }: Props = $props();

	let messages = $state<Message[]>([]);
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);

	function renderMarkdown(text: string): string {
		return filterXSS(marked.parse(text, { async: false }) as string);
	}

	async function scrollToBottom() {
		await tick();
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	}

	let streamingText = $state('');

	function finalizeStreaming() {
		const contents: MessageContent[] = [];
		if (streamingText.trim()) contents.push({ type: 'text', text: streamingText });
		if (contents.length === 0) contents.push({ type: 'text', text: m.chat_error() });
		messages = [...messages, { id: crypto.randomUUID(), role: 'assistant', contents, createdAt: new Date() }];
		streamingText = '';
		onAction?.();
	}

	async function sendMessage() {
		const text = input.trim();
		if (!text || loading) return;
		input = '';
		messages = [...messages, { id: crypto.randomUUID(), role: 'user', contents: [{ type: 'text', text }], createdAt: new Date() }];
		loading = true;
		streamingText = '';
		await scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});

			if (!res.ok || !res.body) {
				finalizeStreaming();
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';
			let finalized = false;

			const finalize = () => {
				if (finalized) return;
				finalized = true;
				finalizeStreaming();
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';
				for (const part of parts) {
					const line = part.trim();
					if (!line.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(line.slice(6)) as StreamEvent;
						if (event.type === 'delta') {
							streamingText += event.text;
							await scrollToBottom();
						} else if (event.type === 'done') {
							finalize();
						} else if (event.type === 'error') {
							streamingText = m.chat_error();
							finalize();
						}
					} catch { /* skip */ }
				}
			}
			finalize();
		} catch {
			streamingText = m.chat_error();
			finalizeStreaming();
		} finally {
			loading = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="chat-panel">
	<div class="chat-messages" bind:this={listEl}>
		{#if messages.length === 0}
			<div class="chat-empty">
				<p>AIに質問・指示できます</p>
				<p class="hint">例: 「フィールドを追加して」「名前と日付のフィールドが必要」</p>
			</div>
		{/if}
		{#each messages as msg (msg.id)}
			<div class="msg {msg.role}">
				{#if msg.role === 'user'}
					<div class="user-bubble">
						{#each msg.contents as c}{#if c.type === 'text'}{c.text}{/if}{/each}
					</div>
				{:else}
					<div class="assistant-text">
						{#each msg.contents as c}
							{#if c.type === 'text'}
								{@html renderMarkdown(c.text)}
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
		{#if loading && streamingText}
			<div class="msg assistant">
				<div class="assistant-text">{@html renderMarkdown(streamingText)}</div>
			</div>
		{/if}
		{#if loading && !streamingText}
			<div class="msg assistant">
				<TypingIndicator />
			</div>
		{/if}
	</div>

	<div class="chat-input">
		<textarea
			bind:value={input}
			onkeydown={handleKey}
			{placeholder}
			rows="2"
			disabled={loading}
		></textarea>
		<button class="send-btn" onclick={sendMessage} disabled={loading || !input.trim()} aria-label="送信">
			<ArrowUp size={15} />
		</button>
	</div>
</div>

<style lang="scss">
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface);
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.chat-empty {
		text-align: center;
		padding: 24px 8px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.6;

		p { margin: 0; }
		.hint {
			margin-top: 6px;
			font-size: 0.75rem;
			opacity: 0.75;
		}
	}

	.msg {
		display: flex;
		flex-direction: column;
	}

	.msg.user {
		align-items: flex-end;
	}

	.msg.assistant {
		align-items: flex-start;
	}

	.user-bubble {
		background: var(--color-primary);
		color: #fff;
		border-radius: 12px;
		border-bottom-right-radius: 3px;
		padding: 8px 12px;
		max-width: 85%;
		font-size: 0.875rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.assistant-text {
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--color-text);

		:global(p) { margin: 0 0 0.5em; }
		:global(p:last-child) { margin-bottom: 0; }
		:global(strong) { font-weight: 600; }
		:global(code) {
			font-family: ui-monospace, monospace;
			font-size: 0.8125em;
			background: var(--color-border);
			padding: 0.1em 0.3em;
			border-radius: 3px;
		}
		:global(ul), :global(ol) {
			padding-left: 1.4em;
			margin: 0.2em 0;
		}
		:global(li) { margin: 0.1em 0; }
	}

	.chat-input {
		border-top: 1px solid var(--color-border);
		padding: 10px 12px;
		display: flex;
		gap: 8px;
		align-items: flex-end;
	}

	textarea {
		flex: 1;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 7px 10px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-family: inherit;
		resize: none;
		outline: none;
		line-height: 1.5;
		max-height: 120px;
		overflow-y: auto;
		transition: border-color 0.15s;

		&:focus { border-color: var(--color-primary); }
		&::placeholder { color: var(--color-text-muted); }
	}

	.send-btn {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 50%;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 0.15s;

		&:disabled { opacity: 0.3; cursor: not-allowed; }
		&:not(:disabled):hover { opacity: 0.85; }
	}
</style>
