<script lang="ts">
	let { value }: { value: number } = $props();

	const r = 84,
		cx = 100,
		cy = 100;
	let pct = $derived(Math.max(0, Math.min(100, value)) / 100);
	let color = $derived(value >= 70 ? 'var(--emerald)' : value >= 50 ? 'var(--amber)' : 'var(--rose-strong)');

	function arc(a0: number, a1: number): string {
		const x0 = cx + r * Math.cos(a0),
			y0 = cy + r * Math.sin(a0);
		const x1 = cx + r * Math.cos(a1),
			y1 = cy + r * Math.sin(a1);
		const large = a1 - a0 > Math.PI ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
	}

	// animate fill in
	let anim = $state(0);
	$effect(() => {
		value; // track
		anim = 0;
		const t = setTimeout(() => (anim = pct), 60);
		return () => clearTimeout(t);
	});
	let animEnd = $derived(Math.PI + Math.PI * anim);
</script>

<div class="gauge-wrap">
	<svg width="200" height="116" viewBox="0 0 200 116">
		<path d={arc(Math.PI, 2 * Math.PI)} stroke="rgba(255,255,255,0.07)" stroke-width="13" fill="none" stroke-linecap="round" />
		<path
			d={arc(Math.PI, animEnd)}
			stroke={color}
			stroke-width="13"
			fill="none"
			stroke-linecap="round"
			style="transition: all .7s cubic-bezier(.4,0,.2,1); filter: drop-shadow(0 0 6px {color});"
		/>
	</svg>
	<div class="gauge-val">
		<div class="gauge-num" style="color:{color}">{value}</div>
		<div class="gauge-label">Soft Score</div>
	</div>
</div>
