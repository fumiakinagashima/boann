<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
	import Check from '$lib/components/icon/Check.svelte';
	import AlertCircle from '$lib/components/icon/AlertCircle.svelte';
	import InfoCircle from '$lib/components/icon/InfoCircle.svelte';
</script>

{#if toast.items.length > 0}
	<div class="toast-container" role="region" aria-live="polite" aria-label="通知">
		{#each toast.items as item (item.id)}
			<div class="toast" class:toast-success={item.type === 'success'} class:toast-error={item.type === 'error'} class:toast-info={item.type === 'info'}>
				{#if item.type === 'success'}
					<Check size={16} />
				{:else if item.type === 'error'}
					<AlertCircle size={16} />
				{:else}
					<InfoCircle size={16} />
				{/if}
				<span>{item.message}</span>
			</div>
		{/each}
	</div>
{/if}

<style lang="scss">
	.toast-container {
		position: fixed;
		bottom: 24px;
		right: 24px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 9999;
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		min-width: 240px;
		max-width: 380px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.2s ease;

		&.toast-success { background: var(--color-success); color: #fff; }
		&.toast-error { background: var(--color-error); color: #fff; }
		&.toast-info {
			background: var(--color-surface, #fff);
			color: var(--color-text, #111);
			border: 1px solid var(--color-border, #e5e7eb);
		}
	}

	@keyframes slideIn {
		from { transform: translateX(20px); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
</style>
