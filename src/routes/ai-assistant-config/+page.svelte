<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings, Heart, Shield, AlertCircle, CheckCircle } from 'lucide-svelte';
	import type { UserProfile, AssistantType } from '$lib/types';

	let userProfile = $state<UserProfile | null>(null);
	let bestieEnabled = $state(false);
	let wingmanEnabled = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let bestieConfig = $state<any>(null);
	let wingmanConfig = $state<any>(null);

	onMount(async () => {
		// Load user profile from localStorage
		const stored = localStorage.getItem('pdc_profile');
		if (stored) {
			userProfile = JSON.parse(stored);
		}

		// Load current configuration
		await loadConfiguration();
	});

	async function loadConfiguration() {
		try {
			loading = true;
			error = null;

			// Fetch current configuration from server
			const res = await fetch('/api/ai-assistant/config', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (res.ok) {
				const data = await res.json();
				bestieConfig = data.bestie || null;
				wingmanConfig = data.wingman || null;
				bestieEnabled = data.bestie?.isEnabled ?? false;
				wingmanEnabled = data.wingman?.isEnabled ?? false;
			}
		} catch (err) {
			console.error('Failed to load configuration:', err);
			error = 'Failed to load configuration';
		} finally {
			loading = false;
		}
	}

	async function toggleAssistant(assistantType: AssistantType) {
		try {
			loading = true;
			error = null;
			success = null;

			const isEnabled = assistantType === 'bestie' ? bestieEnabled : wingmanEnabled;

			const res = await fetch('/api/ai-assistant/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					assistantType,
					isEnabled: !isEnabled
				})
			});

			if (!res.ok) {
				throw new Error('Failed to update configuration');
			}

			const data = await res.json();

			if (assistantType === 'bestie') {
				bestieEnabled = !bestieEnabled;
				bestieConfig = data.config;
				success = `AI Bestie ${bestieEnabled ? 'enabled' : 'disabled'} successfully`;
			} else {
				wingmanEnabled = !wingmanEnabled;
				wingmanConfig = data.config;
				success = `AI Wingman ${wingmanEnabled ? 'enabled' : 'disabled'} successfully`;
			}

			// Clear success message after 3 seconds
			setTimeout(() => {
				success = null;
			}, 3000);
		} catch (err) {
			console.error('Failed to toggle assistant:', err);
			error = err instanceof Error ? err.message : 'Failed to update configuration';
		} finally {
			loading = false;
		}
	}

	function getAssistantDescription(type: AssistantType): string {
		if (type === 'bestie') {
			return 'AI Bestie helps you navigate conversations with matches by providing real-time advice, compatibility assessments, and strategic guidance grounded in your preferences.';
		} else {
			return 'AI Wingman provides strategic dating advice grounded in your personality and the Art of Dating for Indian Men principles. Can also help draft responses after 20+ messages.';
		}
	}

	function getAssistantFeatures(type: AssistantType): string[] {
		if (type === 'bestie') {
			return [
				'Real-time advice on crafting responses',
				'Compatibility assessments (green/yellow/red flags)',
				'Automatic profile updates based on conversations',
				'Hourly summaries of all matches',
				'Strategic guidance grounded in your preferences'
			];
		} else {
			return [
				'Strategic dating advice during conversations',
				'Guidance grounded in your personality profile',
				'Book-based principles and insights',
				'Response drafting after 20+ messages',
				'Automatic profile updates based on conversations'
			];
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-2">
				<Settings class="w-8 h-8 text-slate-700" />
				<h1 class="text-3xl md:text-4xl font-bold text-slate-900">AI Assistant Configuration</h1>
			</div>
			<p class="text-slate-600 text-lg">Manage your AI Bestie and AI Wingman settings</p>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
				<AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
				<div>
					<h3 class="font-semibold text-red-900">Error</h3>
					<p class="text-red-700">{error}</p>
				</div>
			</div>
		{/if}

		<!-- Success Message -->
		{#if success}
			<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
				<CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
				<div>
					<h3 class="font-semibold text-green-900">Success</h3>
					<p class="text-green-700">{success}</p>
				</div>
			</div>
		{/if}

		<!-- Configuration Cards -->
		<div class="grid md:grid-cols-2 gap-6">
			<!-- AI Bestie Card -->
			<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
				<div class="bg-gradient-to-r from-pink-500 to-rose-500 p-6 text-white">
					<div class="flex items-center gap-3 mb-2">
						<Heart class="w-6 h-6" />
						<h2 class="text-2xl font-bold">AI Bestie</h2>
					</div>
					<p class="text-pink-100">For Female Users</p>
				</div>

				<div class="p-6">
					<p class="text-slate-600 mb-4">{getAssistantDescription('bestie')}</p>

					<div class="mb-6">
						<h3 class="font-semibold text-slate-900 mb-3">Features:</h3>
						<ul class="space-y-2">
							{#each getAssistantFeatures('bestie') as feature}
								<li class="flex items-start gap-2 text-slate-700">
									<span class="text-pink-500 font-bold mt-1">•</span>
									<span>{feature}</span>
								</li>
							{/each}
						</ul>
					</div>

					{#if bestieConfig}
						<div class="mb-6 p-4 bg-slate-50 rounded-lg">
							<h4 class="font-semibold text-slate-900 mb-2">Current Status:</h4>
							<div class="space-y-1 text-sm text-slate-600">
								<p><span class="font-medium">Status:</span> {bestieConfig.isActive ? '✓ Active' : '○ Inactive'}</p>
								<p><span class="font-medium">Exchange Count:</span> {bestieConfig.exchangeCount ?? 0}</p>
								<p><span class="font-medium">Last Updated:</span> {new Date(bestieConfig.updatedAt).toLocaleDateString()}</p>
							</div>
						</div>
					{/if}

					<button
						onclick={() => toggleAssistant('bestie')}
						disabled={loading}
						class="w-full py-3 px-4 rounded-lg font-semibold transition-colors {bestieEnabled
							? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
							: 'bg-pink-500 text-white hover:bg-pink-600'} disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if loading}
							<span>Updating...</span>
						{:else}
							{bestieEnabled ? 'Disable AI Bestie' : 'Enable AI Bestie'}
						{/if}
					</button>
				</div>
			</div>

			<!-- AI Wingman Card -->
			<div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
				<div class="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white">
					<div class="flex items-center gap-3 mb-2">
						<Shield class="w-6 h-6" />
						<h2 class="text-2xl font-bold">AI Wingman</h2>
					</div>
					<p class="text-blue-100">For Male Users</p>
				</div>

				<div class="p-6">
					<p class="text-slate-600 mb-4">{getAssistantDescription('wingman')}</p>

					<div class="mb-6">
						<h3 class="font-semibold text-slate-900 mb-3">Features:</h3>
						<ul class="space-y-2">
							{#each getAssistantFeatures('wingman') as feature}
								<li class="flex items-start gap-2 text-slate-700">
									<span class="text-blue-500 font-bold mt-1">•</span>
									<span>{feature}</span>
								</li>
							{/each}
						</ul>
					</div>

					{#if wingmanConfig}
						<div class="mb-6 p-4 bg-slate-50 rounded-lg">
							<h4 class="font-semibold text-slate-900 mb-2">Current Status:</h4>
							<div class="space-y-1 text-sm text-slate-600">
								<p><span class="font-medium">Status:</span> {wingmanConfig.isActive ? '✓ Active' : '○ Inactive'}</p>
								<p><span class="font-medium">Exchange Count:</span> {wingmanConfig.exchangeCount ?? 0}</p>
								<p><span class="font-medium">Last Updated:</span> {new Date(wingmanConfig.updatedAt).toLocaleDateString()}</p>
							</div>
						</div>
					{/if}

					<button
						onclick={() => toggleAssistant('wingman')}
						disabled={loading}
						class="w-full py-3 px-4 rounded-lg font-semibold transition-colors {wingmanEnabled
							? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
							: 'bg-blue-500 text-white hover:bg-blue-600'} disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if loading}
							<span>Updating...</span>
						{:else}
							{wingmanEnabled ? 'Disable AI Wingman' : 'Enable AI Wingman'}
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Privacy Notice -->
		<div class="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
			<h3 class="font-semibold text-blue-900 mb-2">Privacy & Data Usage</h3>
			<p class="text-blue-800 text-sm">
				Your AI assistants use your preferences/personality profile and conversation history to provide personalized advice. All data is encrypted and stored securely in Supabase. You can delete your data at any time from the Privacy Settings page.
			</p>
		</div>

		<!-- Navigation Links -->
		<div class="mt-8 flex gap-4 justify-center">
			<a
				href="/chat"
				class="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
			>
				Back to Chat
			</a>
			<a
				href="/female-profile"
				class="px-6 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
			>
				Edit Profile
			</a>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: #f8fafc;
	}
</style>
