<script module lang="ts">
	import type { Component } from 'svelte';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Users from '@lucide/svelte/icons/users';
	import Package from '@lucide/svelte/icons/package';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Target from '@lucide/svelte/icons/target';
	import LucideSettings from '@lucide/svelte/icons/settings';
	import FileText from '@lucide/svelte/icons/file-text';
	import Wrench from '@lucide/svelte/icons/wrench';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import Building2 from '@lucide/svelte/icons/building-2';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Layers from '@lucide/svelte/icons/layers';
	import Database from '@lucide/svelte/icons/database';
	import Tag from '@lucide/svelte/icons/tag';
	import Boxes from '@lucide/svelte/icons/boxes';
	import Truck from '@lucide/svelte/icons/truck';
	import Heart from '@lucide/svelte/icons/heart';
	import Workflow from '@lucide/svelte/icons/workflow';

	export const ICON_OPTIONS: { name: string; component: Component }[] = [
		{ name: 'layout-grid',    component: LayoutGrid },
		{ name: 'users',          component: Users },
		{ name: 'package',        component: Package },
		{ name: 'briefcase',      component: Briefcase },
		{ name: 'shopping-cart',  component: ShoppingCart },
		{ name: 'calendar',       component: Calendar },
		{ name: 'target',         component: Target },
		{ name: 'settings',       component: LucideSettings },
		{ name: 'file-text',      component: FileText },
		{ name: 'wrench',         component: Wrench },
		{ name: 'chart-bar',      component: ChartBar },
		{ name: 'building-2',     component: Building2 },
		{ name: 'clipboard-list', component: ClipboardList },
		{ name: 'layers',         component: Layers },
		{ name: 'database',       component: Database },
		{ name: 'tag',            component: Tag },
		{ name: 'boxes',          component: Boxes },
		{ name: 'truck',          component: Truck },
		{ name: 'heart',          component: Heart },
		{ name: 'workflow',       component: Workflow },
	];

	const ICON_MAP: Record<string, Component> = Object.fromEntries(
		ICON_OPTIONS.map(o => [o.name, o.component])
	);
</script>

<script lang="ts">
	let {
		icon = 'layout-grid',
		size = 20,
		class: cls = ''
	}: { icon?: string | null; size?: number; class?: string } = $props();

	const IconComp = $derived(
		(icon ? ICON_MAP[icon] : null) ?? LayoutGrid
	);
</script>

<svelte:component this={IconComp} {size} class={cls} />
