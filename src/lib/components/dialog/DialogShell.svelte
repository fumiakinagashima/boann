<script lang="ts">
	import type { Snippet } from 'svelte';
	import DialogChatSide from './DialogChatSide.svelte';
	import X from '$lib/components/icon/X.svelte';

	type RecordContext = {
		type: string;
		typeLabel: string;
		id: string;
		label: string;
		data?: Record<string, unknown>;
	};

	type Props = {
		title: string;
		onclose: () => void;
		contextTitle?: string;
		contextFields?: { key: string; label: string }[];
		recordContext?: RecordContext | null;
		children: Snippet;
		footer: Snippet;
	};

	let { title, onclose, contextTitle, contextFields = [], recordContext = null, children, footer }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="overlay" role="presentation"></div>

<div class="dialog" role="dialog" aria-modal="true" aria-label={title}>
	<div class="dialog-header">
		<span class="dialog-title">{title}</span>
		<button class="close-btn" onclick={onclose} aria-label="閉じる">
			<X size={16} />
		</button>
	</div>

	<div class="dialog-body">
		<DialogChatSide contextTitle={contextTitle ?? title} {contextFields} {recordContext} />
		<div class="form-side">
			{@render children()}
		</div>
	</div>

	<div class="dialog-footer">
		{@render footer()}
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
		width: min(900px, 95vw);
		height: min(680px, 90vh);
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

	.form-side {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		padding: 24px;
		border-left: 1px solid var(--color-border);
	}

	.dialog-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		padding: 12px 20px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dialog-in {
		from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
		to { opacity: 1; transform: translate(-50%, -50%); }
	}
</style>
