<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<rect x="3" y="3" width="18" height="18" rx="2" />
	<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
</svg>
