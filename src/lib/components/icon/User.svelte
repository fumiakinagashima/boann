<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<circle cx="12" cy="8" r="4" />
	<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
</svg>
