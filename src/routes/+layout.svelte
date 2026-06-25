<script lang="ts">
	import '$lib/styles/app.scss';
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { notificationCenter } from '$lib/stores/notifications.svelte';
	import { untrack } from 'svelte';
	import { NOTIFICATION_POLL_INTERVAL_MS } from '$lib/constants';

	let { data, children } = $props();

	notificationCenter.unreadCount = untrack(() => data.unreadNotificationCount);

	$effect(() => {
		const root = document.documentElement;
		if (themeStore.value === 'system') {
			root.removeAttribute('data-theme');
		} else {
			root.setAttribute('data-theme', themeStore.value);
		}
		localStorage.setItem('theme', themeStore.value);
	});

	$effect(() => {
		const interval = setInterval(() => {
			notificationCenter.refreshUnreadCount();
		}, NOTIFICATION_POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !data.account}
	<main class="content-full">
		{@render children()}
	</main>
{:else}
	<div class="shell">
		<Sidebar account={data.account} bookmarkedIds={data.bookmarkedIds} apps={data.apps} />
		<main class="content">
			{@render children()}
		</main>
	</div>
{/if}

<Toast />

<style lang="scss">
	.shell {
		display: grid;
		grid-template-columns: 240px 1fr;
		height: 100vh;
		overflow: hidden;
	}

	.content {
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
	}

	.content-full {
		height: 100vh;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}
</style>
