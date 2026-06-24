<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		quickActionCatalog,
		DEFAULT_QUICK_ACTION_IDS,
		MAX_QUICK_ACTIONS,
		QUICK_ACTIONS_STORAGE_KEY,
		isQuickActionId,
		type QuickActionId
	} from '$lib/quick-actions/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function loadIds(): QuickActionId[] {
		if (typeof localStorage === 'undefined') return [...DEFAULT_QUICK_ACTION_IDS];
		const raw = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
		if (!raw) return [...DEFAULT_QUICK_ACTION_IDS];
		try {
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [...DEFAULT_QUICK_ACTION_IDS];
			const valid = parsed.filter(isQuickActionId).slice(0, MAX_QUICK_ACTIONS);
			return valid.length > 0 ? valid : [...DEFAULT_QUICK_ACTION_IDS];
		} catch {
			return [...DEFAULT_QUICK_ACTION_IDS];
		}
	}

	let selectedIds = $state<QuickActionId[]>(loadIds());

	$effect(() => {
		localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(selectedIds));
	});

	function toggle(id: QuickActionId) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter((x) => x !== id);
		} else {
			if (selectedIds.length >= MAX_QUICK_ACTIONS) return;
			selectedIds = [...selectedIds, id];
		}
	}
</script>

<div class="page">
	<h1>設定</h1>

	<nav class="subnav">
		<a href="/settings">一般</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/integrations">{m.integrations()}</a>
		{/if}
		<a href="/settings/quick-actions" class="active">{m.quick_actions()}</a>
		{#if data.account.permission === 'admin'}
			<a href="/settings/email">{m.email_settings()}</a>
			<a href="/settings/ai">{m.ai_settings()}</a>
		{/if}
		<a href="/settings/account">{m.account_settings()}</a>
	</nav>

	<section>
		<h2>{m.quick_actions()}</h2>
		<p class="desc">
			チャット入力欄の「+」ボタンから呼び出せる機能を選択します。AIを介さず直接実行されるため、応答が高速でトークンも消費しません。
		</p>
		<p class="count">{selectedIds.length} / {MAX_QUICK_ACTIONS} 選択中</p>

		<div class="list">
			{#each quickActionCatalog as action}
				{@const checked = selectedIds.includes(action.id)}
				{@const disabled = !checked && selectedIds.length >= MAX_QUICK_ACTIONS}
				<label class="item" class:checked class:disabled>
					<input type="checkbox" {checked} {disabled} onchange={() => toggle(action.id)} />
					<span class="item-icon">{action.icon}</span>
					<span class="item-info">
						<span class="item-label">{action.label}</span>
						<span class="item-desc">{action.description}</span>
					</span>
				</label>
			{/each}
		</div>
	</section>
</div>

<style lang="scss">
	.page {
		padding: 40px 48px;
		max-width: 640px;
	}

	h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 32px;
	}

	section {
		margin-bottom: 40px;
	}

	h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		margin-bottom: 16px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.desc {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.7;
		margin: 0 0 12px;
	}

	.count {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		margin: 0 0 16px;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-surface);
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.item:hover {
		border-color: var(--color-primary);
	}

	.item.checked {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
	}

	.item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.item.disabled:hover {
		border-color: var(--color-border);
	}

	.item input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--color-primary);
		cursor: inherit;
		flex-shrink: 0;
	}

	.item-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
		width: 28px;
		text-align: center;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.item-label {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.item-desc {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.subnav {
		display: flex;
		gap: 4px;
		margin-bottom: 32px;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0;
	}

	.subnav a {
		padding: 8px 14px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color 0.15s;
	}

	.subnav a:hover {
		color: var(--color-text);
	}
	.subnav a.active {
		color: var(--color-text);
		border-bottom-color: var(--color-primary);
		font-weight: 500;
	}
</style>
