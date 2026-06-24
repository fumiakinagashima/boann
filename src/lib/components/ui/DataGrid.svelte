<script lang="ts">
	type CellType = 'text' | 'number' | 'select';

	type GridColumn = {
		key: string;
		label: string;
		type?: CellType;
		options?: { value: string; label: string }[];
		width?: number;
		readonly?: boolean;
	};

	type GridRow = Record<string, string | number | null>;

	type Props = {
		columns: GridColumn[];
		rows?: GridRow[];
		addable?: boolean;
		deletable?: boolean;
		onchange?: (rows: GridRow[]) => void;
	};

	let {
		columns,
		rows = $bindable([]),
		addable = true,
		deletable = true,
		onchange
	}: Props = $props();

	let active = $state<{ row: number; col: number } | null>(null);
	// Flag to suppress blur-triggered deactivation during keyboard navigation
	let navigating = false;

	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function focusSelect(node: HTMLSelectElement) {
		node.focus();
	}

	function activate(r: number, c: number) {
		if (columns[c]?.readonly) return;
		active = { row: r, col: c };
	}

	function deactivate() {
		if (navigating) return;
		active = null;
	}

	function updateCell(ri: number, key: string, val: string | number | null) {
		rows = rows.map((row, i) => (i === ri ? { ...row, [key]: val } : row));
		onchange?.(rows);
	}

	function navigate(ri: number, ci: number, dRow: number, dCol: number) {
		navigating = true;
		const nextRi = ri + dRow;
		const nextCi = ci + dCol;
		if (nextCi >= 0 && nextCi < columns.length && nextRi >= 0 && nextRi < rows.length) {
			active = { row: nextRi, col: nextCi };
		} else {
			active = null;
		}
		// Reset flag after blur has fired
		setTimeout(() => { navigating = false; }, 0);
	}

	function handleKeydown(e: KeyboardEvent, ri: number, ci: number) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const nextCi = e.shiftKey ? ci - 1 : ci + 1;
			if (nextCi >= 0 && nextCi < columns.length) {
				navigate(ri, ci, 0, e.shiftKey ? -1 : 1);
			} else if (!e.shiftKey && ri < rows.length - 1) {
				navigating = true;
				active = { row: ri + 1, col: 0 };
				setTimeout(() => { navigating = false; }, 0);
			} else if (e.shiftKey && ri > 0) {
				navigating = true;
				active = { row: ri - 1, col: columns.length - 1 };
				setTimeout(() => { navigating = false; }, 0);
			} else {
				active = null;
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			navigate(ri, ci, 1, 0);
		} else if (e.key === 'Escape') {
			active = null;
		}
	}

	function addRow() {
		const newRow: GridRow = Object.fromEntries(
			columns.map((c) => [c.key, c.type === 'number' ? 0 : ''])
		);
		rows = [...rows, newRow];
		onchange?.(rows);
	}

	function deleteRow(i: number) {
		rows = rows.filter((_, idx) => idx !== i);
		if (active) {
			if (active.row === i) active = null;
			else if (active.row > i) active = { ...active, row: active.row - 1 };
		}
		onchange?.(rows);
	}

	function getCellDisplay(row: GridRow, col: GridColumn): string {
		const val = row[col.key];
		if (col.type === 'select' && col.options) {
			return col.options.find((o) => o.value === String(val ?? ''))?.label ?? String(val ?? '');
		}
		return String(val ?? '');
	}
</script>

<div class="grid-wrap">
	<div class="scroll">
		<table>
			<thead>
				<tr>
					{#each columns as col}
						<th style={col.width ? `width:${col.width}px` : undefined}>{col.label}</th>
					{/each}
					{#if deletable}<th class="ctrl-th"></th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each rows as row, ri}
					<tr>
						{#each columns as col, ci}
							{@const isActive = active?.row === ri && active?.col === ci}
							<td
								class:active-cell={isActive}
								class:readonly={col.readonly}
								onclick={() => !col.readonly && activate(ri, ci)}
							>
								{#if isActive}
									{#if col.type === 'select' && col.options}
										<select
											use:focusSelect
											value={String(row[col.key] ?? '')}
											onchange={(e) => {
												updateCell(ri, col.key, (e.currentTarget as HTMLSelectElement).value);
											}}
											onkeydown={(e) => handleKeydown(e, ri, ci)}
											onblur={deactivate}
										>
											{#each col.options as opt}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else}
										<input
											use:focusInput
											type={col.type === 'number' ? 'number' : 'text'}
											value={String(row[col.key] ?? '')}
											oninput={(e) => {
												const v = (e.currentTarget as HTMLInputElement).value;
												updateCell(ri, col.key, col.type === 'number' ? (Number(v) || 0) : v);
											}}
											onkeydown={(e) => handleKeydown(e, ri, ci)}
											onblur={deactivate}
										/>
									{/if}
								{:else}
									<span class="display">{getCellDisplay(row, col)}</span>
								{/if}
							</td>
						{/each}
						{#if deletable}
							<td class="ctrl-td">
								<button type="button" onclick={() => deleteRow(ri)} aria-label="行を削除">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="3 6 5 6 21 6" />
										<path d="M19 6l-1 14H6L5 6" />
										<path d="M10 11v6M14 11v6" />
									</svg>
								</button>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if addable}
		<button type="button" class="add-row" onclick={addRow}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			行を追加
		</button>
	{/if}
</div>

<style lang="scss">
	.grid-wrap { display: flex; flex-direction: column; gap: 0; }

	.scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: 8px 8px 0 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	thead { background: var(--color-surface); }

	th {
		padding: 8px 12px;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
		user-select: none;
	}

	.ctrl-th { width: 40px; }

	td {
		padding: 0;
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
		position: relative;
		cursor: cell;
	}
	td:last-child { border-right: none; }
	tr:last-child td { border-bottom: none; }

	td.readonly { cursor: default; background: color-mix(in srgb, var(--color-border) 30%, transparent); }

	td:not(.active-cell):not(.readonly):hover { background: var(--color-surface); }

	td.active-cell {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		z-index: 1;
	}

	.display {
		display: block;
		padding: 8px 12px;
		min-height: 37px;
		color: var(--color-text);
		white-space: nowrap;
	}

	td.active-cell input,
	td.active-cell select {
		display: block;
		width: 100%;
		height: 37px;
		padding: 0 12px;
		border: none;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		outline: none;
	}

	td.active-cell select { cursor: pointer; }

	.ctrl-td {
		cursor: default;
		border-right: none;
		width: 40px;
	}

	.ctrl-td button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 37px;
		padding: 0 8px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s;
	}

	tr:hover .ctrl-td button { opacity: 1; }
	.ctrl-td button:hover { color: var(--color-danger); }
	.ctrl-td button svg { width: 14px; height: 14px; }

	.add-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-top: none;
		border-radius: 0 0 8px 8px;
		background: var(--color-surface);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		cursor: pointer;
		width: 100%;
		transition: background 0.15s, color 0.15s;
	}
	.add-row:hover { background: var(--color-border); color: var(--color-text); }
	.add-row svg { width: 14px; height: 14px; }
</style>
