<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Heart, MessageCircle, User, Search, ChevronRight, Settings, Sparkles, ShieldCheck } from 'lucide-svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import type { UserProfile } from '$lib/types';

	let { children } = $props();

	let userProfile = $state<UserProfile | null>(null);
	let showOnboarding = $state(false);
	let sidebarOpen = $state(true);

	const navItems = [
		{ href: '/chat', icon: MessageCircle, label: 'Ask Coach', description: 'Get advice' },
		{ href: '/profile-review', icon: User, label: 'Profile Review', description: 'Analyze your profile' },
		{ href: '/female-profile', icon: Sparkles, label: 'For Her', description: 'Profile journey' },
		{ href: '/chat-analyzer', icon: Search, label: 'Chat Analyzer', description: 'Review conversations' },
		{ href: '/reply-suggester', icon: ChevronRight, label: 'Reply Suggester', description: 'Get reply ideas' },
		{ href: '/verified-vibe', icon: ShieldCheck, label: 'Verified Vibe', description: 'Trust-first dating', highlight: true }
	];

	onMount(() => {
		const stored = localStorage.getItem('pdc_profile');
		if (stored) {
			userProfile = JSON.parse(stored);
		} else {
			showOnboarding = true;
		}
	});

	function handleProfileSave(profile: UserProfile) {
		userProfile = profile;
		localStorage.setItem('pdc_profile', JSON.stringify(profile));
		showOnboarding = false;
	}

	function openSettings() {
		showOnboarding = true;
	}
</script>

<svelte:head>
	<title>Pocket Dating Coach</title>
</svelte:head>

<div class="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
	<!-- Sidebar -->
	<aside class={`flex flex-col transition-all duration-300 bg-gray-900 border-r border-gray-800 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
		<!-- Logo -->
		<a href="/" class="flex items-center gap-3 px-4 py-5 border-b border-gray-800 hover:bg-gray-800 transition-colors group">
			<div class="flex-shrink-0 w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center group-hover:bg-rose-700 transition-colors">
				<Heart class="w-4 h-4 text-white" fill="white" />
			</div>
			{#if sidebarOpen}
				<div>
					<p class="font-bold text-sm text-white leading-none group-hover:text-rose-400 transition-colors">Pocket Dating</p>
					<p class="text-xs text-rose-400 font-medium">Coach</p>
				</div>
			{/if}
		</a>

		<!-- Nav -->
		<nav class="flex-1 p-3 space-y-1">
			{#each navItems as item}
				{@const active = $page.url.pathname === item.href}
				<a
					href={item.href}
					class={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
						active
							? 'bg-rose-600/20 text-rose-400 border border-rose-600/30'
							: item.highlight
								? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 border border-emerald-800/30'
								: 'text-gray-400 hover:text-white hover:bg-gray-800'
					}`}
				>
					<item.icon class="w-5 h-5 flex-shrink-0" />
					{#if sidebarOpen}
						<div class="min-w-0 flex-1">
							<p class={`text-sm font-medium truncate ${active ? 'text-rose-300' : item.highlight ? 'text-emerald-400' : ''}`}>{item.label}</p>
							<p class="text-xs text-gray-500 truncate">{item.description}</p>
						</div>
						{#if item.highlight}
							<span class="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-medium">New</span>
						{/if}
					{/if}
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="p-3 border-t border-gray-800 space-y-1">
			{#if userProfile && sidebarOpen}
				<div class="px-3 py-2 rounded-lg bg-gray-800/50 mb-2">
					<p class="text-xs text-gray-500 mb-0.5">Coaching for</p>
					<p class="text-sm text-white font-medium capitalize">{userProfile.gender === 'prefer_not_to_say' ? 'You' : `${userProfile.gender === 'man' ? 'Him' : 'Her'}`} · {userProfile.datingApp}</p>
				</div>
			{/if}
			<button
				onclick={openSettings}
				class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
			>
				<Settings class="w-5 h-5 flex-shrink-0" />
				{#if sidebarOpen}<span class="text-sm">Settings</span>{/if}
			</button>
			<button
				onclick={() => sidebarOpen = !sidebarOpen}
				class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
			>
				<ChevronRight class={`w-5 h-5 flex-shrink-0 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
				{#if sidebarOpen}<span class="text-sm">Collapse</span>{/if}
			</button>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-hidden flex flex-col">
		{@render children()}
	</main>
</div>

{#if showOnboarding}
	<OnboardingModal
		existing={userProfile}
		onSave={handleProfileSave}
		onClose={() => showOnboarding = false}
	/>
{/if}
