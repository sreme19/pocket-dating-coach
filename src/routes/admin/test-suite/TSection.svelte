<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Snippet } from 'svelte';

	let {
		num,
		icon,
		title,
		meta = '',
		open = false,
		children
	}: {
		num: string;
		icon: string;
		title: string;
		meta?: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	let isOpen = $state(open);
</script>

<div class="tsec {isOpen ? 'open' : ''}">
	<button class="tsec-head" onclick={() => (isOpen = !isOpen)}>
		<span class="tsec-num">{num}</span>
		<span class="tsec-ic"><Icon name={icon} size={15} /></span>
		<span class="tsec-title">{title}</span>
		{#if meta}<span class="tsec-meta">{meta}</span>{/if}
		<span class="tsec-chev"><Icon name="chevron" size={15} /></span>
	</button>
	{#if isOpen}
		<div class="tsec-body fade-in">{@render children()}</div>
	{/if}
</div>
