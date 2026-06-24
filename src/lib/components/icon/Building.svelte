<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 9h1M14 9h1M9 13h1M14 13h1" />
</svg>
