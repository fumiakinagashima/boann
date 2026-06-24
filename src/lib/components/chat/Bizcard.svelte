<script lang="ts">
	import BizcardScanner from '$lib/components/bizcard/BizcardScanner.svelte';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import type { BizcardResult } from '../../../routes/api/bizcard/+server';

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.parentNode?.removeChild(node);
			}
		};
	}

	type Props = {
		title?: string;
		onComplete?: () => void;
	};

	let { title, onComplete }: Props = $props();

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
			onComplete?.();
		}
	}

	function handleContactSaved() {
		dialog = null;
		onComplete?.();
	}

	function handleClose() {
		dialog = null;
	}
</script>

{#if title}
	<p class="bizcard-title">{title}</p>
{/if}
<BizcardScanner onRegister={handleRegister} />

{#if dialog?.kind === 'customer'}
	<div use:portal>
		<RecordDialog
			type="customers"
			prefill={dialog.prefill}
			initialView="form"
			onclose={handleClose}
			onSaved={handleCustomerSaved}
		/>
	</div>
{:else if dialog?.kind === 'contact'}
	<div use:portal>
		<RecordDialog
			type="contacts"
			prefill={dialog.prefill}
			initialView="form"
			onclose={handleClose}
			onSaved={handleContactSaved}
		/>
	</div>
{/if}

<style lang="scss">
	.bizcard-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}
</style>
