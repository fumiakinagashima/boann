<script lang="ts">
	type Deal = {
		id: string;
		title: string;
		customerId: string;
		status: string;
		amount: number | null;
		plannedStart: string | null;
		plannedEnd: string | null;
	};

	type Customer = { id: string; name: string };

	type Props = {
		deals: Deal[];
		customers: Customer[];
		onDateChange: (id: string, plannedStart: string, plannedEnd: string) => void;
	};

	let { deals, customers, onDateChange }: Props = $props();

	// ── Zoom ────────────────────────────────────────────────────────────────
	let zoom = $state(1);
	const PX_PER_DAY = [4, 8, 16, 32];
	const pxPerDay = $derived(PX_PER_DAY[zoom]);

	// ── Chart date range ────────────────────────────────────────────────────
	const chartRange = $derived.by(() => {
		const today = new Date();
		let minMs = Infinity, maxMs = -Infinity;
		for (const d of deals) {
			if (d.plannedStart) { const ms = +new Date(d.plannedStart); if (ms < minMs) minMs = ms; }
			if (d.plannedEnd)   { const ms = +new Date(d.plannedEnd);   if (ms > maxMs) maxMs = ms; }
		}
		if (!isFinite(minMs)) minMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
		if (!isFinite(maxMs)) maxMs = new Date(today.getFullYear(), today.getMonth() + 4, 0).getTime();

		const start = new Date(minMs);
		start.setDate(1);
		start.setMonth(start.getMonth() - 1);

		const end = new Date(maxMs);
		end.setMonth(end.getMonth() + 2, 0);

		return { start, end };
	});

	const totalDays = $derived(
		Math.ceil((chartRange.end.getTime() - chartRange.start.getTime()) / 86400000) + 1
	);
	const chartWidth = $derived(totalDays * pxPerDay);

	// ── Date ↔ Pixel ────────────────────────────────────────────────────────
	function msToX(ms: number): number {
		return ((ms - chartRange.start.getTime()) / 86400000) * pxPerDay;
	}
	function xToDateStr(x: number): string {
		const ms = chartRange.start.getTime() + (x / pxPerDay) * 86400000;
		const d = new Date(ms);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	function snapDay(x: number): number {
		return Math.round(x / pxPerDay) * pxPerDay;
	}
	function clientXToChartX(clientX: number): number {
		if (!rightBodyEl) return 0;
		return clientX - rightBodyEl.getBoundingClientRect().left + rightBodyEl.scrollLeft;
	}

	// ── Header computation ──────────────────────────────────────────────────
	const months = $derived.by(() => {
		const result: { label: string; x: number; width: number }[] = [];
		let cur = new Date(chartRange.start.getFullYear(), chartRange.start.getMonth(), 1);
		while (cur < chartRange.end) {
			const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
			const segStart = Math.max(cur.getTime(), chartRange.start.getTime());
			const segEnd   = Math.min(next.getTime(), chartRange.end.getTime());
			const x = msToX(segStart);
			const width = ((segEnd - segStart) / 86400000) * pxPerDay;
			result.push({ label: `${cur.getFullYear()}年${cur.getMonth() + 1}月`, x, width });
			cur = next;
		}
		return result;
	});

	const subHeaders = $derived.by(() => {
		const result: { label: string; x: number; isWeekend?: boolean }[] = [];
		if (zoom === 3) {
			const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
			let cur = new Date(chartRange.start);
			while (cur <= chartRange.end) {
				const dow = cur.getDay();
				result.push({ label: `${cur.getDate()}${DAY_LABELS[dow]}`, x: msToX(cur.getTime()), isWeekend: dow === 0 || dow === 6 });
				cur = new Date(cur.getTime() + 86400000);
			}
		} else {
			let cur = new Date(chartRange.start);
			const dow = cur.getDay();
			if (dow !== 1) cur = new Date(cur.getTime() + ((dow === 0 ? 1 : 8 - dow) * 86400000));
			while (cur <= chartRange.end) {
				result.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}`, x: msToX(cur.getTime()) });
				cur = new Date(cur.getTime() + 7 * 86400000);
			}
		}
		return result;
	});

	const weekendRanges = $derived.by(() => {
		if (zoom < 3) return [];
		const ranges: { x: number; width: number }[] = [];
		let cur = new Date(chartRange.start);
		while (cur <= chartRange.end) {
			const dow = cur.getDay();
			if (dow === 0 || dow === 6) ranges.push({ x: msToX(cur.getTime()), width: pxPerDay });
			cur = new Date(cur.getTime() + 86400000);
		}
		return ranges;
	});

	const todayX = $derived(msToX(new Date().setHours(0, 0, 0, 0)));

	// ── Status colors ────────────────────────────────────────────────────────
	const STATUS: Record<string, { bg: string; border: string; label: string }> = {
		open: { bg: 'color-mix(in srgb, var(--color-primary) 18%, transparent)', border: 'var(--color-primary)', label: '商談中' },
		won:  { bg: 'color-mix(in srgb, var(--color-success) 18%, transparent)', border: 'var(--color-success)', label: '受注' },
		lost: { bg: 'color-mix(in srgb, var(--color-error) 18%, transparent)', border: 'var(--color-error)', label: '失注' }
	};

	// ── Customer lookup ──────────────────────────────────────────────────────
	const customerMap = $derived(Object.fromEntries(customers.map(c => [c.id, c.name])));

	// ── Left panel width (resizable, with progressive column hiding) ─────────
	const LEFT_W_MIN = 76;
	const RIGHT_MIN = 120;
	let LEFT_W = $state(480);

	// Hide secondary columns as the left panel narrows, in order of priority
	const showStatus   = $derived(LEFT_W >= 354);
	const showDates    = $derived(LEFT_W >= 286);
	const showCustomer = $derived(LEFT_W >= 176);

	let ganttEl = $state<HTMLDivElement | null>(null);
	let resizing = $state(false);
	let resizeStartX = $state(0);
	let resizeStartW = $state(0);

	function startResize(e: MouseEvent) {
		e.preventDefault();
		resizing = true;
		resizeStartX = e.clientX;
		resizeStartW = LEFT_W;
	}

	// ── Drag state ───────────────────────────────────────────────────────────
	type DragMode = 'move' | 'left' | 'right' | 'create';

	let dragId    = $state<string | null>(null);
	let dragMode  = $state<DragMode>('move');
	let dragClientStartX = $state(0);   // screen X when drag started
	let dragChartStartX  = $state(0);   // chart X when drag started (for create)
	let dragOrigStart = $state('');
	let dragOrigEnd   = $state('');

	// Overrides applied during drag for visual feedback
	let overrides = $state<Record<string, { plannedStart: string; plannedEnd: string }>>({});

	const displayDeals = $derived(
		deals.map(d => ({
			...d,
			plannedStart: overrides[d.id]?.plannedStart ?? d.plannedStart,
			plannedEnd:   overrides[d.id]?.plannedEnd   ?? d.plannedEnd
		}))
	);

	function barStyle(deal: (typeof displayDeals)[0]): { x: number; width: number; bg: string; border: string } | null {
		if (!deal.plannedStart || !deal.plannedEnd) return null;
		const x = msToX(new Date(deal.plannedStart).getTime());
		const endX = msToX(new Date(deal.plannedEnd).getTime() + 86400000);
		const width = Math.max(endX - x, pxPerDay);
		const s = STATUS[deal.status] ?? STATUS.open;
		return { x, width, bg: s.bg, border: s.border };
	}

	function getHandleSize(barWidth: number): number {
		return Math.min(12, barWidth / 4);
	}

	// Start drag on existing bar (move / resize)
	function startDrag(e: MouseEvent, deal: (typeof displayDeals)[0], mode: DragMode) {
		e.preventDefault();
		e.stopPropagation();
		dragId = deal.id;
		dragMode = mode;
		dragClientStartX = e.clientX;
		dragOrigStart = deal.plannedStart ?? '';
		dragOrigEnd   = deal.plannedEnd   ?? '';
	}

	// Start create drag on an empty chart row
	function startCreate(e: MouseEvent, deal: (typeof displayDeals)[0]) {
		if (e.button !== 0) return;
		e.preventDefault();
		dragId = deal.id;
		dragMode = 'create';
		dragClientStartX = e.clientX;
		dragChartStartX = snapDay(clientXToChartX(e.clientX));
		dragOrigStart = '';
		dragOrigEnd   = '';
		// Set initial single-day bar
		const dateStr = xToDateStr(dragChartStartX);
		overrides = { ...overrides, [deal.id]: { plannedStart: dateStr, plannedEnd: dateStr } };
	}

	function onMouseMove(e: MouseEvent) {
		if (resizing) {
			const dx = e.clientX - resizeStartX;
			const maxW = Math.max(LEFT_W_MIN, (ganttEl?.clientWidth ?? Infinity) - RIGHT_MIN);
			LEFT_W = Math.min(Math.max(resizeStartW + dx, LEFT_W_MIN), maxW);
			return;
		}
		if (!dragId) return;
		const dx = e.clientX - dragClientStartX;
		const daysDelta = Math.round(dx / pxPerDay);

		if (dragMode === 'create') {
			// Drag from chart-relative start X
			const currentChartX = snapDay(clientXToChartX(e.clientX));
			const x1 = Math.min(dragChartStartX, currentChartX);
			const x2 = Math.max(dragChartStartX, currentChartX);
			overrides = { ...overrides, [dragId]: {
				plannedStart: xToDateStr(x1),
				plannedEnd:   xToDateStr(x2)
			}};
			return;
		}

		const origStartMs = new Date(dragOrigStart).getTime();
		const origEndMs   = new Date(dragOrigEnd).getTime();
		let newStart = dragOrigStart;
		let newEnd   = dragOrigEnd;

		if (dragMode === 'move') {
			newStart = xToDateStr(msToX(origStartMs) + daysDelta * pxPerDay);
			newEnd   = xToDateStr(msToX(origEndMs)   + daysDelta * pxPerDay);
		} else if (dragMode === 'left') {
			const rawX = snapDay(msToX(origStartMs) + daysDelta * pxPerDay);
			newStart = xToDateStr(Math.min(rawX, msToX(origEndMs) - pxPerDay));
		} else if (dragMode === 'right') {
			const rawX = snapDay(msToX(origEndMs) + daysDelta * pxPerDay);
			newEnd = xToDateStr(Math.max(rawX, msToX(origStartMs) + pxPerDay));
		}

		overrides = { ...overrides, [dragId]: { plannedStart: newStart, plannedEnd: newEnd } };
	}

	function onMouseUp() {
		if (resizing) { resizing = false; return; }
		if (!dragId) return;
		const o = overrides[dragId];
		if (o) onDateChange(dragId, o.plannedStart, o.plannedEnd);
		dragId = null;
	}

	// ── Scroll sync ──────────────────────────────────────────────────────────
	let rightHeadEl = $state<HTMLDivElement | null>(null);
	let rightBodyEl = $state<HTMLDivElement | null>(null);

	function onBodyScroll() {
		if (rightHeadEl && rightBodyEl) rightHeadEl.scrollLeft = rightBodyEl.scrollLeft;
	}

	// ── Cursor ───────────────────────────────────────────────────────────────
	const cursor = $derived(
		resizing
			? 'col-resize'
			: dragId
				? (dragMode === 'move' ? 'grabbing' : dragMode === 'create' ? 'crosshair' : 'ew-resize')
				: 'default'
	);

	// ── Helpers ──────────────────────────────────────────────────────────────
	function fmtDate(s: string | null): string {
		if (!s) return '—';
		const d = new Date(s);
		return `${d.getMonth() + 1}/${d.getDate()}`;
	}

	const ROW_H = 40;
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<div class="gantt" bind:this={ganttEl} style:cursor={cursor}>
	<!-- ── Controls ──────────────────────────────────────────────────────── -->
	<div class="controls">
		<span class="zoom-label">ズーム</span>
		<button class="zoom-btn" onclick={() => zoom = Math.max(0, zoom - 1)} disabled={zoom === 0}>−</button>
		<span class="zoom-val">{['全体','月','週','日'][zoom]}</span>
		<button class="zoom-btn" onclick={() => zoom = Math.min(3, zoom + 1)} disabled={zoom === 3}>＋</button>
		<span class="hint">期間未設定の行をドラッグしてバーを作成</span>
	</div>

	<!-- ── Header ────────────────────────────────────────────────────────── -->
	<div class="gantt-head">
		<div class="left-head" style:width="{LEFT_W}px">
			<div class="lh-col title">案件名</div>
			{#if showCustomer}<div class="lh-col customer">顧客</div>{/if}
			{#if showDates}<div class="lh-col dates">期間</div>{/if}
			{#if showStatus}<div class="lh-col status">状況</div>{/if}
		</div>
		<div class="right-head" bind:this={rightHeadEl}>
			<div class="rh-inner" style:width="{chartWidth}px">
				<div class="rh-row months">
					{#each months as mo}
						<div class="rh-month" style:left="{mo.x}px" style:width="{mo.width}px">{mo.label}</div>
					{/each}
				</div>
				{#if zoom > 0}
					<div class="rh-row subs">
						{#each subHeaders as s}
							<div
								class="rh-sub"
								class:weekend={zoom === 3 && s.isWeekend}
								style:left="{s.x}px"
								style:width="{pxPerDay * (zoom === 3 ? 1 : 7)}px"
							>{s.label}</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ── Body ──────────────────────────────────────────────────────────── -->
	<div class="gantt-body">
		<!-- Left panel -->
		<div class="left-body" style:width="{LEFT_W}px">
			{#each displayDeals as deal}
				<div class="left-row" style:height="{ROW_H}px">
					<a class="col title" href="/database/deals/{deal.id}">{deal.title}</a>
					{#if showCustomer}
						<span class="col customer">{customerMap[deal.customerId] ?? '—'}</span>
					{/if}
					{#if showDates}
						<span class="col dates">
							{#if deal.plannedStart && deal.plannedEnd}
								{fmtDate(deal.plannedStart)} – {fmtDate(deal.plannedEnd)}
							{:else}
								<span class="unset">未設定</span>
							{/if}
						</span>
					{/if}
					{#if showStatus}
						<span class="col status">
							<span class="status-badge status-{deal.status}">
								{STATUS[deal.status]?.label ?? deal.status}
							</span>
						</span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Right panel (chart) -->
		<div class="right-body" bind:this={rightBodyEl} onscroll={onBodyScroll}>
			<div class="chart-inner" style:width="{chartWidth}px">
				<!-- Weekend backgrounds -->
				{#each weekendRanges as wr}
					<div class="weekend-bg"
						style:left="{wr.x}px"
						style:width="{wr.width}px"
						style:height="{ROW_H * displayDeals.length}px"
					></div>
				{/each}
				<!-- Month grid lines -->
				{#each months as mo}
					<div class="grid-line"
						style:left="{mo.x}px"
						style:height="{ROW_H * displayDeals.length}px"
					></div>
				{/each}
				<!-- Today line -->
				{#if todayX >= 0 && todayX <= chartWidth}
					<div class="today-line"
						style:left="{todayX}px"
						style:height="{ROW_H * displayDeals.length}px"
					></div>
				{/if}

				<!-- Deal rows -->
				{#each displayDeals as deal}
					{@const bar = barStyle(deal)}
					{@const handleSz = getHandleSize(bar?.width ?? 0)}

					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="chart-row"
						class:empty-row={!bar}
						style:height="{ROW_H}px"
						onmousedown={!bar ? (e) => startCreate(e, deal) : undefined}
					>
						{#if bar}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="bar"
								style:left="{bar.x}px"
								style:width="{bar.width}px"
								style:background={bar.bg}
								style:border-color={bar.border}
								onmousedown={(e) => startDrag(e, deal, 'move')}
							>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="bar-handle left" style:width="{handleSz}px" onmousedown={(e) => startDrag(e, deal, 'left')}></div>
								<span class="bar-label">{deal.title}</span>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="bar-handle right" style:width="{handleSz}px" onmousedown={(e) => startDrag(e, deal, 'right')}></div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
	<!-- ── Resize handle ─────────────────────────────────────────────────── -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="resize-handle" class:active={resizing} style:left="{LEFT_W}px" onmousedown={startResize}></div>
</div>

<style lang="scss">
	.gantt {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		user-select: none;
		font-size: 0.875rem;
	}

	/* Controls */
	.controls {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		flex-shrink: 0;
	}
	.zoom-label { font-size: 0.8125rem; color: var(--color-text-muted); }
	.zoom-val   { min-width: 28px; text-align: center; font-size: 0.8125rem; color: var(--color-text-muted); }
	.zoom-btn {
		width: 24px; height: 24px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9375rem;
		cursor: pointer;
		display: flex; align-items: center; justify-content: center;
	}
	.zoom-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.zoom-btn:not(:disabled):hover { border-color: var(--color-primary); color: var(--color-primary); }
	.hint {
		margin-left: 12px;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	/* Header */
	.gantt-head {
		display: flex;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.left-head {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border);
		padding: 0 8px;
	}
	.lh-col {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.right-head { flex: 1; overflow: hidden; position: relative; }
	.rh-inner { position: relative; }
	.rh-row { position: relative; }
	.rh-row.months { height: 24px; border-bottom: 1px solid var(--color-border); }
	.rh-row.subs   { height: 22px; }
	.rh-month {
		position: absolute; top: 0; bottom: 0;
		display: flex; align-items: center;
		padding-left: 8px;
		font-size: 0.75rem; font-weight: 600;
		color: var(--color-text-muted);
		border-right: 1px solid var(--color-border);
		overflow: hidden; white-space: nowrap;
	}
	.rh-sub {
		position: absolute; top: 0; bottom: 0;
		display: flex; align-items: center;
		padding-left: 4px;
		font-size: 0.6875rem; color: var(--color-text-muted);
		border-right: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
		overflow: hidden; white-space: nowrap;
	}
	.rh-sub.weekend { color: #e05252; }

	/* Body */
	.gantt-body { display: flex; flex: 1; overflow-y: auto; overflow-x: hidden; }

	.left-body { flex-shrink: 0; border-right: 1px solid var(--color-border); overflow: hidden; }
	.left-row {
		display: flex; align-items: center;
		padding: 0 8px;
		border-bottom: 1px solid var(--color-border);
	}
	.left-row:last-child { border-bottom: none; }

	.col { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.col.title    { flex: 1; min-width: 0; color: var(--color-primary); text-decoration: none; font-weight: 500; }
	.col.title:hover { text-decoration: underline; }
	.col.customer { width: 100px; flex-shrink: 0; color: var(--color-text-muted); font-size: 0.8125rem; }
	.col.dates    { width: 110px; flex-shrink: 0; font-size: 0.8125rem; color: var(--color-text-muted); }
	.col.status   { width: 68px; flex-shrink: 0; }

	.unset { font-size: 0.75rem; color: var(--color-text-muted); opacity: 0.5; }

	.status-badge {
		display: inline-block;
		font-size: 0.6875rem;
		padding: 1px 6px;
		border: 1px solid;
		border-radius: 20px;
		white-space: nowrap;

		&.status-open { color: var(--color-primary); border-color: var(--color-primary); }
		&.status-won { color: var(--color-success); border-color: var(--color-success); }
		&.status-lost { color: var(--color-error); border-color: var(--color-error); }
	}

	/* Left column widths */
	.lh-col.title    { flex: 1; min-width: 0; }
	.lh-col.customer { width: 100px; flex-shrink: 0; }
	.lh-col.dates    { width: 110px; flex-shrink: 0; }
	.lh-col.status   { width: 68px; flex-shrink: 0; }

	/* Right body */
	.right-body { flex: 1; overflow-x: auto; overflow-y: hidden; }
	.chart-inner { position: relative; }

	.weekend-bg {
		position: absolute; top: 0;
		background: color-mix(in srgb, #f87171 7%, transparent);
		pointer-events: none;
	}
	.grid-line {
		position: absolute; top: 0; width: 1px;
		background: var(--color-border);
		pointer-events: none;
	}
	.today-line {
		position: absolute; top: 0; width: 2px;
		background: #ef4444; opacity: 0.7;
		pointer-events: none; z-index: 2;
	}

	.chart-row {
		position: relative;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: center;
	}
	.chart-row:last-child { border-bottom: none; }

	/* Empty rows show crosshair to indicate draggable */
	.empty-row { cursor: crosshair; }
	.empty-row:hover { background: color-mix(in srgb, var(--color-primary) 4%, transparent); }

	/* Bar */
	.bar {
		position: absolute;
		top: 50%; transform: translateY(-50%);
		height: 24px;
		border: 1.5px solid;
		border-radius: 4px;
		display: flex; align-items: center;
		cursor: grab; z-index: 3;
		overflow: hidden;
	}
	.bar:active { cursor: grabbing; }

	.bar-handle {
		height: 100%;
		flex-shrink: 0;
		cursor: ew-resize;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.bar:hover .bar-handle { opacity: 1; }
	.bar-handle.left  { background: linear-gradient(to right, rgba(0,0,0,0.2), transparent); }
	.bar-handle.right { background: linear-gradient(to left, rgba(0,0,0,0.2), transparent); }

	.bar-label {
		flex: 1;
		font-size: 0.75rem; font-weight: 500;
		padding: 0 4px;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		color: var(--color-text);
		pointer-events: none;
	}

	/* Left panel resize handle */
	.resize-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 7px;
		margin-left: -3.5px;
		cursor: col-resize;
		z-index: 20;
		background: transparent;
		transition: background 0.1s;
	}
	.resize-handle:hover,
	.resize-handle.active {
		background: color-mix(in srgb, var(--color-primary) 35%, transparent);
	}
</style>
