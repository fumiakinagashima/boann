<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<rect x="3" y="3" width="6" height="6" rx="1" />
	<rect x="15" y="15" width="6" height="6" rx="1" />
	<rect x="15" y="3" width="6" height="6" rx="1" />
	<path d="M9 6h3a3 3 0 0 1 3 3v3" />
	<path d="M18 9v3" />
</svg>
