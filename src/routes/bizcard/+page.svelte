<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import type { BizcardResult } from '../api/bizcard/+server';

	// 現在開いているダイアログ
	type DialogState =
		| { kind: 'customer'; prefill: Record<string, string>; bizcard: BizcardResult }
		| { kind: 'contact'; prefill: Record<string, string> }
		| null;

	let dialog = $state<DialogState>(null);

	function buildCustomerPrefill(r: BizcardResult): Record<string, string> {
		const p: Record<string, string> = {};
		const name = r.company ?? r.name;
		if (name) p.name = name;
		if (r.email) p.email = r.email;
		if (r.phone) p.phone = r.phone;
		if (r.address) p.address = r.address;
		if (r.website) p.website = r.website;
		// 担当者名を備考に残す
		if (r.name && r.company) {
			const label = r.title ? `${r.name}（${r.title}）` : r.name;
			p.notes = `担当者: ${label}`;
		}
		return p;
	}

	function buildContactPrefill(r: BizcardResult, customerId?: string): Record<string, string> {
		const p: Record<string, string> = {};
		if (r.name) p.name = r.name;
		if (r.title) p.role = r.title;
		if (r.email) p.email = r.email;
		if (r.phone) p.phone = r.phone;
		if (customerId) p.customerId = customerId;
		return p;
	}

	function handleRegister(result: BizcardResult, mode: 'both' | 'existing') {
		if (mode === 'both') {
			dialog = { kind: 'customer', prefill: buildCustomerPrefill(result), bizcard: result };
		} else {
			dialog = { kind: 'contact', prefill: buildContactPrefill(result) };
		}
	}

	function handleCustomerSaved(record: Record<string, unknown>) {
		const customerId = String(record.id ?? '');
		const bizcard = dialog?.kind === 'customer' ? dialog.bizcard : null;
		if (bizcard && customerId) {
			dialog = { kind: 'contact', prefill: buildContactPrefill(bizcard, customerId) };
		} else {
			dialog = null;
		}
	}

	function handleContactSaved() {
		dialog = null;
	}
</script>

<div class="page">
	<div class="header">
		<h1>名刺取り込み</h1>
		<p>名刺画像をアップロードすると、Claude が情報を自動抽出します</p>
	</div>

	<BizcardScanner onRegister={handleRegister} />
</div>

{#if dialog?.kind === 'customer'}
	<RecordDialog
		type="customers"
		prefill={dialog.prefill}
		initialView="form"
		onclose={() => (dialog = null)}
		onSaved={handleCustomerSaved}
	/>
{:else if dialog?.kind === 'contact'}
	<RecordDialog
		type="contacts"
		prefill={dialog.prefill}
		initialView="form"
		onclose={() => (dialog = null)}
		onSaved={handleContactSaved}
	/>
{/if}

<style lang="scss">
	.page {
		padding: 40px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 6px;
	}
	.header p {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin: 0;
	}
</style>
