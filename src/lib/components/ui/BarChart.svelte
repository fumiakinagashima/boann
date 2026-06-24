<script lang="ts">
	type DataPoint = { label: string; value: number };
	type Series = { name: string; data: DataPoint[] };

	type Props = {
		data?: DataPoint[];
		series?: Series[];
		title?: string;
		color?: string;
		mode?: 'normal' | 'stacked' | 'grouped';
	};

	let { data, series, title, color = 'var(--chart-1)', mode = 'normal' }: Props = $props();

	const COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

	// Normalize to multi-series internally
	const allSeries = $derived<Series[]>(
		series && series.length > 0
			? series
			: data && data.length > 0
				? [{ name: '', data }]
				: []
	);

	const isMulti = $derived(allSeries.length > 1);
	const labels = $derived(allSeries[0]?.data.map((d) => d.label) ?? []);

	// Per-label stacked totals (for stacked mode y-axis)
	const stackedTotals = $derived(
		labels.map((_, li) =>
			allSeries.reduce((sum, s) => sum + (s.data[li]?.value ?? 0), 0)
		)
	);

	const maxVal = $derived(
		mode === 'stacked'
			? Math.max(...stackedTotals, 1)
			: Math.max(...allSeries.flatMap((s) => s.data.map((d) => d.value)), 1)
	);

	const W = 680;
	const PL = 90;
	const PR = 16;
	const PT = 12;
	const rotateLabs = $derived(labels.length > 10);
	const H = $derived(rotateLabs ? 280 : 200);
	const PB = $derived((isMulti ? 40 : 28) + (rotateLabs ? 80 : 0));
	const plotW = $derived(W - PL - PR);
	const plotH = $derived(H - PT - PB);

	const groupW = $derived(plotW / Math.max(labels.length, 1));

	function barColor(si: number): string {
		return `var(${COLORS[si % COLORS.length]})`;
	}

	// x position of the left edge of a bar
	function bx(labelIndex: number, seriesIndex: number): number {
		if (mode === 'grouped') {
			const barW = groupW * 0.8 / allSeries.length;
			const groupLeft = PL + labelIndex * groupW + groupW * 0.1;
			return groupLeft + seriesIndex * barW;
		}
		// normal or stacked: centered in group
		return PL + labelIndex * groupW + groupW * 0.2;
	}

	function barW(seriesCount: number): number {
		if (mode === 'grouped') return groupW * 0.8 / seriesCount;
		return groupW * 0.6;
	}

	function barH(v: number): number {
		return (v / maxVal) * plotH;
	}

	// y for stacked: start from the already-stacked base
	function stackedY(labelIndex: number, seriesIndex: number): number {
		const base = allSeries
			.slice(0, seriesIndex)
			.reduce((sum, s) => sum + (s.data[labelIndex]?.value ?? 0), 0);
		return PT + plotH - barH(base) - barH(allSeries[seriesIndex].data[labelIndex]?.value ?? 0);
	}

	const yTicks = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => ({
			y: PT + plotH * (1 - t),
			label: Math.round(maxVal * t).toLocaleString()
		}))
	);

	// legend y position (below x-axis)
	const legendY = $derived(H - 12);
</script>

<figure class="chart">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
		<!-- Grid -->
		{#each yTicks as t}
			<line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
				stroke="var(--color-border)" stroke-width="1" />
			<text x={PL - 6} y={t.y + 4} text-anchor="end"
				fill="var(--color-text-muted)" font-size="11">{t.label}</text>
		{/each}

		<!-- Bars -->
		{#each allSeries as s, si}
			{#each s.data as d, li}
				{#if mode === 'stacked'}
					<rect
						x={bx(li, si)}
						y={stackedY(li, si)}
						width={barW(allSeries.length)}
						height={barH(d.value)}
						fill={barColor(si)}
						rx={si === allSeries.length - 1 ? 3 : 0}
						opacity="0.9"
					/>
				{:else}
					<rect
						x={bx(li, si)}
						y={PT + plotH - barH(d.value)}
						width={barW(allSeries.length)}
						height={barH(d.value)}
						fill={barColor(si)}
						rx="3"
						opacity="0.9"
					/>
				{/if}
			{/each}
		{/each}

		<!-- X-axis labels -->
		{#each labels as label, li}
			{@const lx = PL + li * groupW + groupW / 2}
			{@const ly = PT + plotH + 16}
			<text
				x={lx} y={ly}
				text-anchor={rotateLabs ? 'end' : 'middle'}
				fill="var(--color-text-muted)"
				font-size="11"
				transform={rotateLabs ? `rotate(-45 ${lx} ${ly})` : undefined}
			>{label}</text>
		{/each}

		<!-- Axes -->
		<line x1={PL} y1={PT} x2={PL} y2={PT + plotH}
			stroke="var(--color-border)" stroke-width="1" />
		<line x1={PL} y1={PT + plotH} x2={W - PR} y2={PT + plotH}
			stroke="var(--color-border)" stroke-width="1" />

		<!-- Legend (multi-series only) -->
		{#if isMulti}
			{@const itemW = W / allSeries.length}
			{#each allSeries as s, si}
				<rect x={si * itemW + (itemW - 60) / 2} y={legendY - 9} width="10" height="10"
					fill={barColor(si)} rx="2" />
				<text x={si * itemW + (itemW - 60) / 2 + 14} y={legendY}
					fill="var(--color-text-muted)" font-size="11">{s.name}</text>
			{/each}
		{/if}
	</svg>
</figure>

<style lang="scss">
	.chart { display: flex; flex-direction: column; gap: 6px; margin: 0; }
	figcaption { font-size: 0.9375rem; font-weight: 600; color: var(--color-text); }
	svg { width: 100%; height: auto; }
</style>
