<script lang="ts">
	const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

	type DataPoint = { label: string; value: number };

	type Props = {
		data: DataPoint[];
		title?: string;
		donut?: boolean;
	};

	let { data, title, donut = true }: Props = $props();

	const cx = 100;
	const cy = 100;
	const r = 85;
	const ir = $derived(donut ? 46 : 0);

	const total = $derived(data.reduce((s, d) => s + d.value, 0));

	const slices = $derived.by(() => {
		let angle = -Math.PI / 2;
		return data.map((d, i) => {
			const sweep = total > 0 ? (d.value / total) * 2 * Math.PI : 0;
			const x1 = cx + r * Math.cos(angle);
			const y1 = cy + r * Math.sin(angle);
			const x2 = cx + r * Math.cos(angle + sweep);
			const y2 = cy + r * Math.sin(angle + sweep);
			const ix1 = cx + ir * Math.cos(angle);
			const iy1 = cy + ir * Math.sin(angle);
			const ix2 = cx + ir * Math.cos(angle + sweep);
			const iy2 = cy + ir * Math.sin(angle + sweep);
			const large = sweep > Math.PI ? 1 : 0;
			const path = donut
				? `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`
				: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
			angle += sweep;
			return {
				path,
				color: COLORS[i % COLORS.length],
				label: d.label,
				pct: total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '0%'
			};
		});
	});
</script>

<figure class="chart">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<div class="wrap">
		<svg viewBox="0 0 200 200" role="img" aria-label={title}>
			{#each slices as s}
				<path d={s.path} fill={s.color} />
			{/each}
		</svg>
		<ul class="legend">
			{#each slices as s}
				<li>
					<span class="dot" style:background={s.color}></span>
					<span class="lbl">{s.label}</span>
					<span class="pct">{s.pct}</span>
				</li>
			{/each}
		</ul>
	</div>
</figure>

<style lang="scss">
	.chart { display: flex; flex-direction: column; gap: 6px; margin: 0; }
	figcaption { font-size: 0.9375rem; font-weight: 600; color: var(--color-text); }
	.wrap { display: flex; align-items: center; gap: 20px; }
	svg { width: 160px; height: 160px; flex-shrink: 0; }
	.legend { list-style: none; display: flex; flex-direction: column; gap: 8px; }
	.legend li { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; }
	.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
	.lbl { flex: 1; color: var(--color-text); }
	.pct { color: var(--color-text-muted); font-size: 0.8125rem; min-width: 44px; text-align: right; }
</style>
