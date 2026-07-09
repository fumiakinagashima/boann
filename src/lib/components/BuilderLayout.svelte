<script lang="ts">
	import type { Snippet } from 'svelte';

	// テーブル／ページ／ワークフロー／アプリ設定で共通のビルダーレイアウト。
	// 左に編集領域（main）、右にリサイズ可能なAIアシスタント列（chat）を配置する。
	let {
		main,
		chat,
		chatTitle = 'AIアシスタント'
	}: {
		main: Snippet;
		chat: Snippet;
		chatTitle?: string;
	} = $props();

	const CHAT_MIN = 220;
	const CHAT_MAX = 640;
	let chatWidth = $state(340);
	let resizing = $state(false);

	function onResizerMouseDown(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		const startX = e.clientX;
		const startWidth = chatWidth;
		function onMove(ev: MouseEvent) {
			chatWidth = Math.min(CHAT_MAX, Math.max(CHAT_MIN, startWidth + (startX - ev.clientX)));
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

<div class="builder-layout" style="grid-template-columns: 1fr 3px {chatWidth}px" class:resizing>
	<div class="main-col">
		{@render main()}
	</div>

	<div
		class="resizer"
		onmousedown={onResizerMouseDown}
		role="separator"
		aria-label="パネル幅を調整"
		aria-orientation="vertical"
	></div>

	<div class="chat-col">
		<div class="chat-col-header"><span>✨</span>{chatTitle}</div>
		{@render chat()}
	</div>
</div>

<style lang="scss">
	.builder-layout {
		display: grid;
		height: 100%;
		overflow: hidden;

		&.resizing {
			cursor: col-resize;
			user-select: none;
		}
	}

	.main-col {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	.resizer {
		width: 3px;
		cursor: col-resize;
		background: var(--color-border);
		transition: background 0.15s;
		position: relative;

		&::after { content: ''; position: absolute; inset: 0 -3px; }
		&:hover { background: var(--color-primary); }
	}

	.chat-col {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}

	.chat-col-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 16px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}
</style>
