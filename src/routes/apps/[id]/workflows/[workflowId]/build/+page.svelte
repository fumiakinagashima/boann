<script lang="ts">
	import WorkflowEditor from '$lib/components/database/WorkflowEditor.svelte';
	import WorkflowChatPanel from '$lib/components/database/WorkflowChatPanel.svelte';
	import ChevronLeft from '$lib/components/icon/ChevronLeft.svelte';
	import type { WorkflowState } from '$lib/components/chat/Workflow.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type EditorRef = { getState: () => WorkflowState; setState: (s: WorkflowState) => void };
	let editorRef = $state<EditorRef | null>(null);

	function confirmDeleteWorkflow(e: SubmitEvent) {
		if (!confirm(`ワークフロー「${data.workflow.name}」を削除しますか？`)) e.preventDefault();
	}

	const defaultState: WorkflowState = {
		name: data.workflow.name,
		triggerHour: data.workflow.triggerHour,
		triggerMinute: data.workflow.triggerMinute,
		steps: data.workflow.steps
	};

	const CHAT_MIN = 220, CHAT_MAX = 640;
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

<svelte:head><title>{data.workflow.name} — {data.app.label}</title></svelte:head>

<div class="wf-page" style="grid-template-columns: 1fr 5px {chatWidth}px" class:resizing>
	<div class="editor-col">
		<div class="editor-header">
			<a href="/apps/{data.app.id}" class="back-link"><ChevronLeft size={15} />{data.app.label}</a>
			<form method="POST" action="?/delete" onsubmit={confirmDeleteWorkflow} class="delete-form">
				<button type="submit" class="btn-danger-ghost">削除</button>
			</form>
		</div>
		{#if form?.message}<p class="delete-error">{form.message}</p>{/if}
		<WorkflowEditor
			bind:this={editorRef}
			id={data.workflow.id}
			initialName={data.workflow.name}
			initialTriggerHour={data.workflow.triggerHour}
			initialTriggerMinute={data.workflow.triggerMinute}
			initialSteps={data.workflow.steps}
			initialEnabled={data.workflow.enabled}
			runs={data.runs}
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
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.editor-header {
		padding: 12px 24px 8px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		text-decoration: none;
		&:hover { color: var(--color-text); }
	}

	.delete-form { display: contents; }

	.btn-danger-ghost {
		padding: 5px 12px;
		border-radius: 6px;
		font-size: 0.8125rem;
		border: 1px solid var(--color-border);
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		&:hover { border-color: var(--color-danger); color: var(--color-danger); }
	}

	.delete-error {
		margin: 8px 24px 0;
		font-size: 0.8125rem;
		color: var(--color-danger, var(--color-error));
	}

	.resizer {
		width: 5px;
		cursor: col-resize;
		background: var(--color-border);
		transition: background 0.15s;
		position: relative;
		&::after { content: ''; position: absolute; inset: 0 -2px; }
		&:hover { background: var(--color-primary); }
	}

	.chat-col {
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--color-border);
		overflow: hidden;
	}
</style>
