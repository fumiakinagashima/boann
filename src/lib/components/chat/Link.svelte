<script lang="ts">
	import ChevronRight from '$lib/components/icon/ChevronRight.svelte';
	import Download from '$lib/components/icon/Download.svelte';

	type Props = {
		label: string;
		href: string;
		description?: string;
		newTab?: boolean;
		download?: boolean;
	};

	let { label, href, description, newTab, download }: Props = $props();

	// Only allow in-app paths (starting with "/", excluding "//" protocol-relative URLs) to prevent dangerous schemes like javascript:
	const safeHref = $derived(/^\/(?!\/)/.test(href) ? href : undefined);
</script>

<a class="link-card" href={safeHref} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
	<span class="label">{label}</span>
	{#if description}
		<span class="desc">{description}</span>
	{/if}
	{#if download}
		<Download size={16} class="icon" />
	{:else}
		<ChevronRight size={16} class="icon" />
	{/if}
</a>

<style lang="scss">
	.link-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		max-width: 420px;
		padding: 10px 36px 10px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		text-decoration: none;
		transition: border-color 0.15s, background 0.15s;

		&:hover {
			border-color: var(--color-primary);
			background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
		}
	}

	.label {
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	:global(.icon) {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}
</style>
