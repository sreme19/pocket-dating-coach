<script lang="ts">
	import { Heart, Shield, Settings, ChevronDown, Loader2 } from 'lucide-svelte';
	import type { UserProfile, AssistantType } from '$lib/types';

	interface Props {
		userProfile: UserProfile | null;
		activeAssistant: AssistantType | null;
		isLoading?: boolean;
		onActivate?: (assistantType: AssistantType) => Promise<void>;
		onDeactivate?: () => Promise<void>;
		onConfigure?: () => void;
		exchangeCount?: number;
	}

	let {
		userProfile = $bindable(),
		activeAssistant = $bindable(),
		isLoading = false,
		onActivate,
		onDeactivate,
		onConfigure,
		exchangeCount = 0
	}: Props = $props();

	let showDropdown = $state(false);
	let activating = $state(false);
	let deactivating = $state(false);

	// Determine which assistant to show based on user gender
	const assistantType = userProfile?.gender === 'woman' ? 'bestie' : userProfile?.gender === 'man' ? 'wingman' : null;
	const assistantLabel = assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman';
	const assistantIcon = assistantType === 'bestie' ? Heart : Shield;
	const assistantColor = assistantType === 'bestie' ? 'rose' : 'blue';
	const badgeColor = assistantType === 'bestie' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
	const buttonColor = assistantType === 'bestie' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700';
	const buttonColorInactive = assistantType === 'bestie' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-700 hover:bg-gray-600';

	async function handleActivate() {
		if (!assistantType || !onActivate) return;
		activating = true;
		try {
			await onActivate(assistantType);
		} finally {
			activating = false;
		}
	}

	async function handleDeactivate() {
		if (!onDeactivate) return;
		deactivating = true;
		try {
			await onDeactivate();
			showDropdown = false;
		} finally {
			deactivating = false;
		}
	}

	function handleConfigure() {
		if (onConfigure) {
			onConfigure();
			showDropdown = false;
		}
	}
</script>

{#if userProfile?.gender && userProfile.gender !== 'prefer_not_to_say'}
<div class="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
	<!-- Main activation button -->
	<div class="relative">
		<button
			onclick={handleActivate}
			disabled={activeAssistant === assistantType || activating || isLoading}
			class={`w-full md:w-auto px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
				activeAssistant === assistantType
					? `${buttonColor} text-white`
					: `${buttonColorInactive} text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed`
			}`}
		>
			{#if activating || isLoading}
				<Loader2 class="w-4 h-4 animate-spin" />
			{:else}
				<svelte:component this={assistantIcon} class="w-4 h-4" />
			{/if}
			<span>Activate {assistantLabel}</span>
		</button>
	</div>

	<!-- Active status badge -->
	{#if activeAssistant === assistantType}
		<div class={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 ${badgeColor}`}>
			<div class="w-2 h-2 rounded-full bg-current animate-pulse"></div>
			<span>Active</span>
			{#if exchangeCount > 0}
				<span class="opacity-70">({exchangeCount})</span>
			{/if}
		</div>
	{/if}

	<!-- Configuration dropdown -->
	<div class="relative">
		<button
			onclick={() => (showDropdown = !showDropdown)}
			disabled={isLoading}
			class="w-full md:w-auto px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
			title="Configuration options"
		>
			<Settings class="w-4 h-4" />
			<ChevronDown class={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
		</button>

		<!-- Dropdown menu -->
		{#if showDropdown}
			<div class="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
				<button
					onclick={handleConfigure}
					class="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-750 transition-colors border-b border-gray-700 flex items-center gap-2"
				>
					<Settings class="w-4 h-4" />
					<span>Configure Assistant</span>
				</button>

				{#if activeAssistant === assistantType}
					<button
						onclick={handleDeactivate}
						disabled={deactivating}
						class="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if deactivating}
							<Loader2 class="w-4 h-4 animate-spin" />
						{:else}
							<span>✕</span>
						{/if}
						<span>Deactivate {assistantLabel}</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
{/if}

<!-- Click outside to close dropdown -->
<svelte:window
	onclick={(e) => {
		if (showDropdown && !(e.target as HTMLElement).closest('button')) {
			showDropdown = false;
		}
	}}
/>

<style>
	:global(.bg-gray-750) {
		background-color: rgb(31, 41, 55);
	}
</style>
