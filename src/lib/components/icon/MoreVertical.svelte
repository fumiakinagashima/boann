<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={cls} aria-hidden="true">
	<circle cx="12" cy="5" r="1.6" />
	<circle cx="12" cy="12" r="1.6" />
	<circle cx="12" cy="19" r="1.6" />
</svg>
