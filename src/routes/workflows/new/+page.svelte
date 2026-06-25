<script lang="ts">
	import WorkflowEditor from '$lib/components/database/WorkflowEditor.svelte';
	import WorkflowChatPanel from '$lib/components/database/WorkflowChatPanel.svelte';
	import type { WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type EditorRef = { getState: () => WorkflowState; setState: (s: WorkflowState) => void };
	let editorRef = $state<EditorRef | null>(null);

	const defaultState: WorkflowState = { name: '新規ワークフロー', triggerHour: 9, triggerMinute: 0, steps: [] };

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

<svelte:head><title>新規ワークフロー</title></svelte:head>

<div class="wf-page" style="grid-template-columns: 1fr 5px {chatWidth}px" class:resizing>
	<div class="editor-col">
		<WorkflowEditor
			bind:this={editorRef}
			entityTypes={data.entityTypes}
			slackIntegrations={data.slackIntegrations}
			noChatPanel
		/>
	</div>

	<div
		class="resizer"
		onmousedown={onResizerMouseDown}
		role="separator"
		aria-label="パネル幅を調整"
		aria-orientation="vertical"
	></div>

	<div class="chat-col">
		<WorkflowChatPanel
			getCurrent={() => editorRef?.getState() ?? defaultState}
			onApply={(s) => editorRef?.setState(s)}
		/>
	</div>
</div>

<style lang="scss">
	.wf-page {
		display: grid;
		height: 100%;
		overflow: hidden;

		&.resizing {
			cursor: col-resize;
			user-select: none;
		}
	}

	.editor-col {
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
		height: 100%;
		overflow: hidden;
		border-left: 1px solid var(--color-border);
	}
</style>
