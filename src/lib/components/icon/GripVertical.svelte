<script lang="ts">
	let { size = 24, class: cls = '' }: { size?: number; class?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={cls} aria-hidden="true">
	<circle cx="9" cy="5" r="1.4" />
	<circle cx="9" cy="12" r="1.4" />
	<circle cx="9" cy="19" r="1.4" />
	<circle cx="15" cy="5" r="1.4" />
	<circle cx="15" cy="12" r="1.4" />
	<circle cx="15" cy="19" r="1.4" />
</svg>
