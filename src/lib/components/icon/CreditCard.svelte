<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<rect x="2" y="6" width="20" height="14" rx="2" />
	<path d="M2 10h20" />
	<circle cx="7" cy="8" r="0.5" fill="currentColor" />
	<circle cx="9" cy="8" r="0.5" fill="currentColor" />
</svg>
