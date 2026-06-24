<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class={cls} aria-hidden="true">
	<circle cx="12" cy="12" r="10" />
	<line x1="12" y1="8" x2="12" y2="12" />
	<line x1="12" y1="16" x2="12.01" y2="16" />
</svg>
