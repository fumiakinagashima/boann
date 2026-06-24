<script lang="ts">
	import type { KanbanColumn, KanbanCard } from '$lib/types/chat';

	type Props = {
		title?: string;
		columns: KanbanColumn[];
		cards: KanbanCard[];
		onchange?: (cardId: string, columnId: string) => boolean | Promise<boolean>;
	};

	let { title, columns, cards: initialCards, onchange }: Props = $props();

	let cards = $state<KanbanCard[]>([...initialCards]);
	let draggingId = $state<string | null>(null);
	let dragOverColId = $state<string | null>(null);

	function cardsFor(columnId: string): KanbanCard[] {
		return cards.filter((c) => c.columnId === columnId);
	}

	function formatAmount(amount: number): string {
		return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
	}

	function columnTotal(columnId: string): number {
		return cardsFor(columnId).reduce((sum, c) => sum + (c.amount ?? 0), 0);
	}

	function handleDragStart(e: DragEvent, cardId: string) {
		draggingId = cardId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', cardId);
		}
	}

	function handleDragOver(e: DragEvent, colId: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverColId = colId;
	}

	function handleDragLeave(e: DragEvent, colId: string) {
		// relatedTarget が同じ列内の子要素なら無視
		const col = (e.currentTarget as HTMLElement);
		if (col.contains(e.relatedTarget as Node)) return;
		if (dragOverColId === colId) dragOverColId = null;
	}

	async function handleDrop(e: DragEvent, colId: string) {
		e.preventDefault();
		dragOverColId = null;
		if (!draggingId) return;
		const id = draggingId;
		draggingId = null;
		const card = cards.find((c) => c.id === id);
		if (!card || card.columnId === colId) return;
		const prevColumnId = card.columnId;
		cards = cards.map((c) => (c.id === id ? { ...c, columnId: colId } : c));
		const ok = await onchange?.(id, colId);
		if (ok === false) {
			cards = cards.map((c) => (c.id === id ? { ...c, columnId: prevColumnId } : c));
		}
	}

	function handleDragEnd() {
		draggingId = null;
		dragOverColId = null;
	}
</script>

<div class="kanban-wrap">
	{#if title}
		<p class="kanban-title">{title}</p>
	{/if}
	<div class="kanban">
		{#each columns as col (col.id)}
			{@const colCards = cardsFor(col.id)}
			{@const total = columnTotal(col.id)}
			<div
				class="kanban-col"
				class:drag-over={dragOverColId === col.id}
				ondragover={(e) => handleDragOver(e, col.id)}
				ondragleave={(e) => handleDragLeave(e, col.id)}
				ondrop={(e) => handleDrop(e, col.id)}
				role="group"
				aria-label={col.label}
			>
				<div class="kanban-col-header">
					<span class="col-label">{col.label}</span>
					<span class="col-badge">{colCards.length}</span>
				</div>
				{#if total > 0}
					<div class="col-total">{formatAmount(total)}</div>
				{/if}
				<div class="kanban-cards">
					{#each colCards as card (card.id)}
						<div
							class="kanban-card"
							class:dragging={draggingId === card.id}
							draggable="true"
							ondragstart={(e) => handleDragStart(e, card.id)}
							ondragend={handleDragEnd}
							role="button"
							tabindex="0"
							aria-label={card.title}
						>
							<span class="card-title">{card.title}</span>
							{#if card.subtitle}
								<span class="card-sub">{card.subtitle}</span>
							{/if}
							{#if card.amount != null}
								<span class="card-amount">{formatAmount(card.amount)}</span>
							{/if}
						</div>
					{/each}
					{#if colCards.length === 0}
						<div class="kanban-empty">—</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	.kanban-wrap {
		width: 100%;
		overflow: hidden;
	}

	.kanban-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0 0 10px;
	}

	.kanban {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 6px;
	}

	.kanban-col {
		flex: 0 0 200px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-radius: 10px;
		padding: 6px;
		margin: -6px;
		transition: background 0.15s ease;
	}

	.kanban-col.drag-over {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		outline: 1.5px dashed color-mix(in srgb, var(--color-primary) 50%, transparent);
		outline-offset: -1.5px;
	}

	.kanban-col-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		background: var(--color-border);
		border-radius: 8px;
	}

	.col-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.col-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		background: var(--color-background);
		border-radius: 10px;
		padding: 1px 7px;
		min-width: 20px;
		text-align: center;
	}

	.col-total {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		text-align: right;
		padding: 0 4px;
	}

	.kanban-cards {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.kanban-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		cursor: grab;
		user-select: none;
		transition:
			opacity 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	.kanban-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		transform: translateY(-1px);
	}

	.kanban-card:active {
		cursor: grabbing;
	}

	.kanban-card.dragging {
		opacity: 0.4;
		transform: scale(0.97);
	}

	.card-title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
		line-height: 1.4;
	}

	.card-sub {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.card-amount {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-primary);
		margin-top: 2px;
	}

	.kanban-empty {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		text-align: center;
		padding: 12px 0;
	}
</style>
