<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Link from './Link.svelte';
	import type { LinkContent } from '$lib/types/chat';

	type Props = {
		jobId: string;
		label: string;
		onResolved?: (result: LinkContent) => void;
	};

	let { jobId, label, onResolved }: Props = $props();

	type JobState =
		| { status: 'pending' }
		| { status: 'done'; result: LinkContent }
		| { status: 'error'; error: string };

	let job = $state<JobState>({ status: 'pending' });
	let timer: ReturnType<typeof setInterval> | undefined;

	async function poll() {
		try {
			const res = await fetch(`/api/documents/jobs/${jobId}`);
			if (!res.ok) {
				job = { status: 'error', error: 'Could not retrieve the document generation status' };
				stop();
				return;
			}
			const data = (await res.json()) as JobState;
			job = data;
			if (data.status !== 'pending') stop();
			if (data.status === 'done') onResolved?.(data.result);
		} catch {
			job = { status: 'error', error: 'Could not retrieve the document generation status' };
			stop();
		}
	}

	function stop() {
		if (timer) {
			clearInterval(timer);
			timer = undefined;
		}
	}

	onMount(() => {
		poll();
		timer = setInterval(poll, 2000);
	});

	onDestroy(stop);
</script>

{#if job.status === 'pending'}
	<div class="job-pending">
		<span class="spinner"></span>
		<span class="job-label">Generating: {label}</span>
	</div>
{:else if job.status === 'done'}
	<Link label={job.result.label} href={job.result.href} description={job.result.description} newTab={job.result.newTab} download={true} />
{:else}
	<p class="job-error">Document generation failed: {job.error}</p>
{/if}

<style lang="scss">
	.job-pending {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 420px;
		padding: 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
	}

	.job-label {
		font-size: 0.9375rem;
		color: var(--color-text);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		flex-shrink: 0;
		animation: spin 0.8s linear infinite;
	}

	.job-error {
		font-size: 0.9375rem;
		color: var(--color-danger);
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
