<script lang="ts">
	import { ChevronRight, ChevronLeft, CheckCircle, AlertCircle, Loader2, Shield, Heart, Zap } from 'lucide-svelte';
	import type { AssistantType } from '$lib/types';
	import PrivacySettings from './PrivacySettings.svelte';
	import PreferencesEditor from './PreferencesEditor.svelte';
	import PersonalityEditor from './PersonalityEditor.svelte';

	interface Props {
		assistantType?: AssistantType;
		onComplete?: (assistantType: AssistantType) => Promise<void>;
		onCancel?: () => void;
	}

	let { assistantType = 'bestie', onComplete, onCancel }: Props = $props();

	// Wizard state
	let currentStep = $state(1);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	// Step 1: Privacy consent
	let privacyAcknowledged = $state(false);

	// Step 2: Profile data
	let profileDataChoice = $state<'create' | 'import' | null>(null);
	let importedData = $state<string>('');

	// Step 3: Preferences/Personality
	let setupComplete = $state(false);

	const totalSteps = 4;
	const isRose = $derived(assistantType === 'bestie');
	const assistantLabel = $derived(assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman');
	const assistantDescription = $derived(
		assistantType === 'bestie'
			? 'Your personal dating coach who helps you navigate conversations with matches'
			: 'Your strategic dating advisor grounded in proven dating principles'
	);

	function canProceedToNextStep(): boolean {
		switch (currentStep) {
			case 1:
				return privacyAcknowledged;
			case 2:
				return profileDataChoice !== null;
			case 3:
				return setupComplete;
			default:
				return false;
		}
	}

	function nextStep() {
		if (canProceedToNextStep() && currentStep < totalSteps) {
			currentStep++;
			error = null;
		}
	}

	function previousStep() {
		if (currentStep > 1) {
			currentStep--;
			error = null;
		}
	}

	async function handlePrivacyAcknowledge() {
		privacyAcknowledged = true;
	}

	async function handleComplete() {
		isLoading = true;
		error = null;

		try {
			if (onComplete) {
				await onComplete(assistantType);
			}
			success = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to complete setup';
		} finally {
			isLoading = false;
		}
	}

	function handleCancel() {
		if (confirm('Are you sure you want to cancel the setup? You can complete it later.')) {
			onCancel?.();
		}
	}
</script>

<div class="w-full max-w-2xl mx-auto">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-3 mb-4">
			{#if isRose}
				<Heart class="w-8 h-8 text-rose-400" />
			{:else}
				<Zap class="w-8 h-8 text-blue-400" />
			{/if}
			<div>
				<h1 class="text-3xl font-bold text-gray-100">{assistantLabel} Setup</h1>
				<p class="text-gray-400 text-sm">{assistantDescription}</p>
			</div>
		</div>

		<!-- Progress Indicator -->
		<div class="flex items-center gap-2 mb-4">
			{#each Array(totalSteps) as _, i}
				<div class="flex items-center gap-2">
					<div
						class={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
							i + 1 < currentStep
								? isRose
									? 'bg-rose-600 text-white'
									: 'bg-blue-600 text-white'
								: i + 1 === currentStep
									? isRose
										? 'bg-rose-500/30 border-2 border-rose-500 text-rose-300'
										: 'bg-blue-500/30 border-2 border-blue-500 text-blue-300'
									: 'bg-gray-700 text-gray-400'
						}`}
					>
						{#if i + 1 < currentStep}
							<CheckCircle class="w-5 h-5" />
						{:else}
							{i + 1}
						{/if}
					</div>
					{#if i < totalSteps - 1}
						<div
							class={`h-1 w-8 transition-all ${
								i + 1 < currentStep
									? isRose
										? 'bg-rose-600'
										: 'bg-blue-600'
									: 'bg-gray-700'
							}`}
						></div>
					{/if}
				</div>
			{/each}
		</div>

		<p class="text-sm text-gray-400">
			Step {currentStep} of {totalSteps}
		</p>
	</div>

	<!-- Error Message -->
	{#if error}
		<div class="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
			<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-medium text-red-300">Error</p>
				<p class="text-sm text-red-200">{error}</p>
			</div>
		</div>
	{/if}

	<!-- Success Message -->
	{#if success}
		<div class="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
			<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-medium text-green-300">Setup Complete!</p>
				<p class="text-sm text-green-200">{assistantLabel} is now ready to use.</p>
			</div>
		</div>
	{/if}

	<!-- Step Content -->
	<div class="mb-8">
		<!-- Step 1: Privacy Notice and Consent -->
		{#if currentStep === 1}
			<div class="animate-in fade-in duration-300">
				<PrivacySettings
					{assistantType}
					isFirstActivation={true}
					onAcknowledge={handlePrivacyAcknowledge}
					onClose={handleCancel}
				/>
			</div>
		{/if}

		<!-- Step 2: Profile Data Import or Creation -->
		{#if currentStep === 2}
			<div class="animate-in fade-in duration-300">
				<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
					<h2 class="text-xl font-semibold text-gray-100 mb-2">
						{assistantType === 'bestie' ? 'Import or Create Your Preferences' : 'Import or Create Your Personality Profile'}
					</h2>
					<p class="text-gray-400 text-sm mb-6">
						{assistantType === 'bestie'
							? 'Do you have existing preferences from the Dating Assistant? You can import them or create new ones.'
							: 'Do you have an existing personality profile from the Dating Assistant? You can import it or create a new one.'}
					</p>

					<!-- Choice Buttons -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
						<!-- Create New -->
						<button
							onclick={() => (profileDataChoice = 'create')}
							class={`p-4 rounded-lg border-2 transition-all text-left ${
								profileDataChoice === 'create'
									? isRose
										? 'border-rose-500 bg-rose-500/10'
										: 'border-blue-500 bg-blue-500/10'
									: 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
							}`}
						>
							<div class="flex items-start gap-3">
								<div
									class={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
										profileDataChoice === 'create'
											? isRose
												? 'border-rose-500 bg-rose-500'
												: 'border-blue-500 bg-blue-500'
											: 'border-gray-600'
									}`}
								>
									{#if profileDataChoice === 'create'}
										<div class="w-2 h-2 bg-white rounded-full"></div>
									{/if}
								</div>
								<div>
									<h3 class="font-semibold text-gray-100 mb-1">Create New</h3>
									<p class="text-sm text-gray-400">Start fresh with a new profile</p>
								</div>
							</div>
						</button>

						<!-- Import Existing -->
						<button
							onclick={() => (profileDataChoice = 'import')}
							class={`p-4 rounded-lg border-2 transition-all text-left ${
								profileDataChoice === 'import'
									? isRose
										? 'border-rose-500 bg-rose-500/10'
										: 'border-blue-500 bg-blue-500/10'
									: 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
							}`}
						>
							<div class="flex items-start gap-3">
								<div
									class={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
										profileDataChoice === 'import'
											? isRose
												? 'border-rose-500 bg-rose-500'
												: 'border-blue-500 bg-blue-500'
											: 'border-gray-600'
									}`}
								>
									{#if profileDataChoice === 'import'}
										<div class="w-2 h-2 bg-white rounded-full"></div>
									{/if}
								</div>
								<div>
									<h3 class="font-semibold text-gray-100 mb-1">Import Existing</h3>
									<p class="text-sm text-gray-400">Use data from Dating Assistant</p>
								</div>
							</div>
						</button>
					</div>

					<!-- Import Data Textarea -->
					{#if profileDataChoice === 'import'}
						<div class="mb-6">
							<label for="import-data" class="block text-sm font-semibold text-gray-200 mb-2">
								Paste your {assistantType === 'bestie' ? 'preferences.md' : 'personality.md'} content
							</label>
							<textarea
								id="import-data"
								bind:value={importedData}
								placeholder={`Paste your ${assistantType === 'bestie' ? 'preferences' : 'personality'} profile content here...`}
								class="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-400 transition-colors text-sm resize-none"
								rows="6"
							></textarea>
							<p class="text-xs text-gray-400 mt-2">
								You can copy this from your existing Dating Assistant profile
							</p>
						</div>
					{/if}

					<!-- Info Box -->
					<div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
						<AlertCircle class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
						<div>
							<p class="text-sm font-medium text-blue-300 mb-1">
								{assistantType === 'bestie' ? 'About Your Preferences' : 'About Your Personality Profile'}
							</p>
							<p class="text-sm text-blue-200">
								{assistantType === 'bestie'
									? 'Your preferences help AI Bestie understand what you value in a partner and provide better compatibility assessments.'
									: 'Your personality profile helps AI Wingman give advice that matches your authentic self and communication style.'}
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Step 3: Preferences/Personality Setup -->
		{#if currentStep === 3}
			<div class="animate-in fade-in duration-300">
				<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
					<h2 class="text-xl font-semibold text-gray-100 mb-2">
						{assistantType === 'bestie' ? 'Set Up Your Preferences' : 'Set Up Your Personality Profile'}
					</h2>
					<p class="text-gray-400 text-sm mb-6">
						{assistantType === 'bestie'
							? 'Tell us about what matters to you in a partner. This helps AI Bestie provide personalized advice.'
							: 'Tell us about yourself. This helps AI Wingman give advice that matches your authentic personality.'}
					</p>

					<!-- Editor Component -->
					{#if assistantType === 'bestie'}
						<PreferencesEditor
							onSave={async () => {
								setupComplete = true;
							}}
							onCancel={() => {
								setupComplete = false;
							}}
						/>
					{:else}
						<PersonalityEditor
							onSave={async () => {
								setupComplete = true;
							}}
							onCancel={() => {
								setupComplete = false;
							}}
						/>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Step 4: Confirmation and Activation -->
		{#if currentStep === 4}
			<div class="animate-in fade-in duration-300">
				<div class="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
					<div class="text-center mb-8">
						<div class="flex justify-center mb-4">
							{#if isRose}
								<Heart class="w-16 h-16 text-rose-400" />
							{:else}
								<Zap class="w-16 h-16 text-blue-400" />
							{/if}
						</div>
						<h2 class="text-2xl font-bold text-gray-100 mb-2">You're All Set!</h2>
						<p class="text-gray-400">
							{assistantLabel} is ready to help you navigate your dating conversations.
						</p>
					</div>

					<!-- Summary -->
					<div class="space-y-3 mb-8">
						<div class="flex items-start gap-3 p-4 rounded-lg bg-gray-700/50 border border-gray-600">
							<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
							<div>
								<p class="font-medium text-gray-200">Privacy & Consent</p>
								<p class="text-sm text-gray-400">You've reviewed and accepted our privacy notice</p>
							</div>
						</div>

						<div class="flex items-start gap-3 p-4 rounded-lg bg-gray-700/50 border border-gray-600">
							<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
							<div>
								<p class="font-medium text-gray-200">
									{assistantType === 'bestie' ? 'Preferences' : 'Personality Profile'}
								</p>
								<p class="text-sm text-gray-400">
									{assistantType === 'bestie'
										? 'Your preferences are set up and ready to use'
										: 'Your personality profile is set up and ready to use'}
								</p>
							</div>
						</div>

						<div class="flex items-start gap-3 p-4 rounded-lg bg-gray-700/50 border border-gray-600">
							<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
							<div>
								<p class="font-medium text-gray-200">Ready to Go</p>
								<p class="text-sm text-gray-400">
									{assistantLabel} will be available in your chat conversations
								</p>
							</div>
						</div>
					</div>

					<!-- Next Steps -->
					<div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-8">
						<h3 class="font-semibold text-blue-300 mb-3">Next Steps</h3>
						<ul class="text-sm text-blue-200 space-y-2">
							<li>• Go to a chat conversation with a match</li>
							<li>• Click the "{assistantLabel}" button to activate</li>
							<li>• Start getting personalized advice and insights</li>
							<li>• You can update your profile anytime in settings</li>
						</ul>
					</div>

					<!-- Activation Button -->
					<button
						onclick={handleComplete}
						disabled={isLoading}
						class={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 ${
							isRose
								? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-700/50'
								: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-700/50'
						}`}
					>
						{#if isLoading}
							<Loader2 class="w-5 h-5 animate-spin" />
							<span>Activating...</span>
						{:else}
							<CheckCircle class="w-5 h-5" />
							<span>Activate {assistantLabel}</span>
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Navigation Buttons -->
	<div class="flex gap-3 justify-between">
		<button
			onclick={previousStep}
			disabled={currentStep === 1 || isLoading}
			class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-300 font-medium transition-all"
		>
			<ChevronLeft class="w-4 h-4" />
			<span>Previous</span>
		</button>

		<button
			onclick={handleCancel}
			disabled={isLoading}
			class="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-gray-300 font-medium transition-all"
		>
			Cancel
		</button>

		{#if currentStep < totalSteps}
			<button
				onclick={nextStep}
				disabled={!canProceedToNextStep() || isLoading}
				class={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
					canProceedToNextStep() && !isLoading
						? isRose
							? 'bg-rose-600 hover:bg-rose-700 text-white'
							: 'bg-blue-600 hover:bg-blue-700 text-white'
						: 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
				}`}
			>
				<span>Next</span>
				<ChevronRight class="w-4 h-4" />
			</button>
		{:else if currentStep === totalSteps && !success}
			<button
				onclick={handleComplete}
				disabled={isLoading}
				class={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
					isRose
						? 'bg-rose-600 hover:bg-rose-700 text-white disabled:bg-rose-700/50'
						: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-700/50'
				}`}
			>
				{#if isLoading}
					<Loader2 class="w-4 h-4 animate-spin" />
					<span>Completing...</span>
				{:else}
					<CheckCircle class="w-4 h-4" />
					<span>Complete Setup</span>
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	:global(.animate-in) {
		animation: fadeIn 0.3s ease-in-out;
	}

	:global(.fade-in) {
		animation: fadeIn 0.3s ease-in-out;
	}

	:global(.duration-300) {
		animation-duration: 0.3s;
	}
</style>
