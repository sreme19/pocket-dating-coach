<script lang="ts">
	import { ICONS } from './lib';

	let {
		name,
		size = 16,
		color = undefined,
		spin = false
	}: { name: string; size?: number; color?: string; spin?: boolean } = $props();

	let paths = $derived(
		(ICONS[name] ?? '')
			.split('M')
			.filter(Boolean)
			.map((d) => 'M' + d)
	);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={spin ? 'spin' : ''}
	style={color ? `color:${color}` : undefined}
>
	{#each paths as d}
		<path {d} />
	{/each}
</svg>
