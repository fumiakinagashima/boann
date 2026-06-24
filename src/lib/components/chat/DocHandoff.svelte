<script lang="ts">
	import Copy from '$lib/components/icon/Copy.svelte';
	import Download from '$lib/components/icon/Download.svelte';

	type Props = {
		label: string;
		downloadUrl: string;
		filename: string;
		prompt: string;
	};

	let { label, downloadUrl, filename, prompt }: Props = $props();

	let copied = $state(false);

	async function copyPrompt() {
		await navigator.clipboard.writeText(prompt);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="doc-handoff">
	<div class="handoff-header">
		<span class="handoff-label">{label}</span>
		<a href={downloadUrl} download={filename} class="download-btn">
			<Download size={14} />
			ダウンロード
		</a>
	</div>

	<div class="prompt-section">
		<div class="prompt-title">外部AIツール用プロンプト</div>
		<div class="prompt-body">{prompt}</div>
		<button class="copy-btn" onclick={copyPrompt} class:copied>
			<Copy size={13} />
			{copied ? 'コピーしました' : 'プロンプトをコピー'}
		</button>
	</div>
</div>

<style lang="scss">
	.doc-handoff {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
		max-width: 520px;
	}

	.handoff-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.handoff-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.download-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 0.8125rem;
		color: var(--color-primary);
		border: 1px solid var(--color-primary);
		border-radius: 5px;
		text-decoration: none;
		white-space: nowrap;
		&:hover {
			background: var(--color-primary);
			color: #fff;
		}
	}

	.prompt-section {
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.prompt-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.prompt-body {
		font-size: 0.875rem;
		color: var(--color-text);
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		align-self: flex-start;
		padding: 5px 10px;
		font-size: 0.8125rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 5px;
		cursor: pointer;
		color: var(--color-text-muted);
		transition: all 0.15s;

		&:hover {
			border-color: var(--color-primary);
			color: var(--color-primary);
		}

		&.copied {
			border-color: var(--color-success);
			color: var(--color-success);
		}
	}
</style>
