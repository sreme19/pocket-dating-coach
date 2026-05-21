<script lang="ts">
	import { Heart, Shield } from 'lucide-svelte';
	import type { AssistantType } from '$lib/types';

	interface Props {
		assistantType: AssistantType;
		status?: 'active' | 'inactive';
		exchangeCount?: number;
		showTooltip?: boolean;
		size?: 'sm' | 'md' | 'lg';
		variant?: 'badge' | 'pill' | 'compact';
	}

	let {
		assistantType,
		status = 'active',
		exchangeCount = 0,
		showTooltip = true,
		size = 'md',
		variant = 'badge'
	}: Props = $props();

	let showTooltipState = $state(false);

	// Size classes
	const sizeClasses = {
		sm: {
			badge: 'px-2 py-1 text-xs',
			pill: 'px-2.5 py-1 text-xs',
			compact: 'px-1.5 py-0.5 text-xs'
		},
		md: {
			badge: 'px-3 py-1.5 text-sm',
			pill: 'px-3.5 py-1.5 text-sm',
			compact: 'px-2 py-1 text-xs'
		},
		lg: {
			badge: 'px-4 py-2 text-base',
			pill: 'px-4.5 py-2 text-base',
			compact: 'px-3 py-1.5 text-sm'
		}
	};

	// Icon sizes
	const iconSizes = {
		sm: 'w-3 h-3',
		md: 'w-4 h-4',
		lg: 'w-5 h-5'
	};

	// Determine styling based on assistant type
	const isBeestie = $derived(assistantType === 'bestie');
	const label = $derived(isBeestie ? 'AI Bestie' : 'AI Wingman');
	const bgColor = $derived(isBeestie ? 'bg-rose-500/20' : 'bg-blue-500/20');
	const textColor = $derived(isBeestie ? 'text-rose-300' : 'text-blue-300');
	const borderColor = $derived(isBeestie ? 'border-rose-500/30' : 'border-blue-500/30');
	const pulseColor = $derived(isBeestie ? 'bg-rose-400' : 'bg-blue-400');
	const tooltipBg = $derived(isBeestie ? 'bg-rose-900/90' : 'bg-blue-900/90');
	const tooltipBorder = $derived(isBeestie ? 'border-rose-700' : 'border-blue-700');

	const sizeClass = $derived(sizeClasses[size][variant]);
	const iconSize = $derived(iconSizes[size]);

	// Tooltip content
	const tooltipContent = $derived(
		`${label} - ${status === 'active' ? 'Active' : 'Inactive'}${exchangeCount > 0 ? ` (${exchangeCount} exchanges)` : ''}`
	);
</script>

<div class="relative inline-flex">
	<!-- Badge element -->
	<div
		class={`
			${sizeClass}
			rounded-full border font-medium
			flex items-center gap-1.5
			transition-all duration-200
			${bgColor} ${textColor} ${borderColor}
			${status === 'active' ? 'opacity-100' : 'opacity-60'}
		`}
		onmouseenter={() => (showTooltipState = true)}
		onmouseleave={() => (showTooltipState = false)}
		role="status"
		aria-label={tooltipContent}
	>
		<!-- Icon with pulse animation when active -->
		<div class="relative flex items-center justify-center">
			{#if isBeestie}
				<Heart class={`${iconSize} flex-shrink-0`} />
			{:else}
				<Shield class={`${iconSize} flex-shrink-0`} />
			{/if}
			{#if status === 'active'}
				<div class={`absolute inset-0 rounded-full ${pulseColor} animate-pulse opacity-30`}></div>
			{/if}
		</div>

		<!-- Label -->
		{#if variant !== 'compact'}
			<span class="whitespace-nowrap">{label}</span>
		{/if}

		<!-- Exchange count indicator -->
		{#if exchangeCount > 0 && variant !== 'compact'}
			<span class="opacity-70 text-xs">({exchangeCount})</span>
		{/if}
	</div>

	<!-- Tooltip -->
	{#if showTooltip && showTooltipState}
		<div
			class={`
				absolute bottom-full left-1/2 -translate-x-1/2 mb-2
				px-3 py-2 rounded-lg text-xs font-medium
				whitespace-nowrap pointer-events-none
				${tooltipBg} ${tooltipBorder} border
				text-white shadow-lg z-50
				animate-in fade-in duration-200
			`}
		>
			{tooltipContent}
			<!-- Tooltip arrow -->
			<div
				class={`
					absolute top-full left-1/2 -translate-x-1/2
					w-2 h-2 rotate-45
					${isBeestie ? 'bg-rose-900/90' : 'bg-blue-900/90'}
				`}
			></div>
		</div>
	{/if}
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translate(-50%, -8px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	:global(.animate-in) {
		animation: fadeIn 0.2s ease-out;
	}
</style>
