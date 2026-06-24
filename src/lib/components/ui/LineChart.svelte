<script lang="ts">
	type DataPoint = { label: string; value: number };
	type Series = { name: string; data: DataPoint[] };

	type Props = {
		data?: DataPoint[];
		series?: Series[];
		title?: string;
		color?: string;
	};

	let { data, series, title, color = 'var(--chart-1)' }: Props = $props();

	const COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];

	const allSeries = $derived<Series[]>(
		series && series.length > 0
			? series
			: data && data.length > 0
				? [{ name: '', data }]
				: []
	);

	const isMulti = $derived(allSeries.length > 1);
	const labels = $derived(allSeries[0]?.data.map((d) => d.label) ?? []);

	const maxVal = $derived(
		Math.max(...allSeries.flatMap((s) => s.data.map((d) => d.value)), 1)
	);

	const W = 680;
	const PL = 90;
	const PR = 16;
	const PT = 16;
	const rotateLabs = $derived(labels.length > 10);
	const H = $derived(rotateLabs ? 330 : 250);
	const PB = $derived((isMulti ? 52 : 40) + (rotateLabs ? 80 : 0));
	const plotW = $derived(W - PL - PR);
	const plotH = $derived(H - PT - PB);

	function px(i: number, total: number): number {
		if (total === 1) return PL + plotW / 2;
		return PL + (i / (total - 1)) * plotW;
	}
	function py(v: number): number {
		return PT + (1 - v / maxVal) * plotH;
	}

	function seriesColor(si: number): string {
		// single series: respect the color prop for backward compat
		if (!isMulti) return color;
		return `var(${COLORS[si % COLORS.length]})`;
	}

	function makeLine(s: Series): string {
		return s.data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i, s.data.length)} ${py(d.value)}`).join(' ');
	}

	function makeArea(s: Series): string {
		if (s.data.length <= 1) return '';
		const line = makeLine(s);
		const n = s.data.length;
		return `${line} L ${px(n - 1, n)} ${PT + plotH} L ${px(0, n)} ${PT + plotH} Z`;
	}

	const yTicks = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => ({
			y: PT + plotH * (1 - t),
			label: Math.round(maxVal * t).toLocaleString()
		}))
	);

	// unique gradient id per instance
	const baseId = Math.random().toString(36).slice(2, 7);
</script>

<figure class="chart">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
		<defs>
			{#each allSeries as s, si}
				<linearGradient id="lg-{baseId}-{si}" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={seriesColor(si)} stop-opacity={isMulti ? 0.12 : 0.2} />
					<stop offset="100%" stop-color={seriesColor(si)} stop-opacity="0.02" />
				</linearGradient>
			{/each}
		</defs>

		<!-- Grid -->
		{#each yTicks as t}
			<line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
				stroke="var(--color-border)" stroke-width="1" />
			<text x={PL - 6} y={t.y + 4} text-anchor="end"
				fill="var(--color-text-muted)" font-size="11">{t.label}</text>
		{/each}

		<!-- Area fills (drawn first, below lines) -->
		{#each allSeries as s, si}
			{#if s.data.length > 1}
				<path d={makeArea(s)} fill="url(#lg-{baseId}-{si})" />
			{/if}
		{/each}

		<!-- Lines -->
		{#each allSeries as s, si}
			<path d={makeLine(s)} fill="none" stroke={seriesColor(si)}
				stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		{/each}

		<!-- Dots -->
		{#each allSeries as s, si}
			{#each s.data as d, i}
				<circle cx={px(i, s.data.length)} cy={py(d.value)} r="4" fill={seriesColor(si)} />
			{/each}
		{/each}

		<!-- X-axis labels (from first series) -->
		{#each labels as label, i}
			{@const lx = px(i, labels.length)}
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
				<line
					x1={si * itemW + (itemW - 60) / 2}
					y1={H - 7}
					x2={si * itemW + (itemW - 60) / 2 + 14}
					y2={H - 7}
					stroke={seriesColor(si)}
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<text x={si * itemW + (itemW - 60) / 2 + 18} y={H - 3}
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
