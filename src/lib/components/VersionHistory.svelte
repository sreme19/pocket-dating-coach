<script lang="ts">
	import { Clock, RotateCcw, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { ProfileVersion } from '$lib/server/profile-service';

	interface Props {
		versions?: ProfileVersion[];
		profileType?: 'preferences' | 'personality';
		isLoading?: boolean;
		onRestore?: (versionId: string) => Promise<void>;
	}

	let {
		versions = [],
		profileType = 'preferences',
		isLoading = false,
		onRestore
	}: Props = $props();

	let restoringVersionId = $state<string | null>(null);
	let restoreError = $state<string | null>(null);
	let restoreSuccess = $state(false);
	let expandedVersionId = $state<string | null>(null);

	async function handleRestore(versionId: string) {
		if (!confirm('Are you sure you want to restore this version? This will overwrite your current profile.')) {
			return;
		}

		restoringVersionId = versionId;
		restoreError = null;
		restoreSuccess = false;

		try {
			await onRestore?.(versionId);
			restoreSuccess = true;
			setTimeout(() => {
				restoreSuccess = false;
			}, 3000);
		} catch (err) {
			restoreError = err instanceof Error ? err.message : 'Failed to restore version';
		} finally {
			restoringVersionId = null;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getProfileTypeLabel(): string {
		return profileType === 'preferences' ? 'Preferences' : 'Personality';
	}

	function getProfileTypeIcon(): string {
		return profileType === 'preferences' ? '❤️' : '🛡️';
	}

	function getVersionSummary(version: ProfileVersion): string {
		const data = version.data;
		if (profileType === 'preferences') {
			const prefs = data as any;
			const items = [
				prefs.emotionalSignals?.length || 0,
				prefs.lifestyleSignals?.length || 0,
				prefs.boundaries?.length || 0,
				prefs.dealbreakers?.length || 0
			].reduce((a, b) => a + b, 0);
			return `${items} items`;
		} else {
			const pers = data as any;
			const items = [
				pers.values?.length || 0,
				pers.datingPatterns?.length || 0,
				pers.redFlagsToAvoid?.length || 0
			].reduce((a, b) => a + b, 0);
			return `${items} items`;
		}
	}

	function toggleExpanded(versionId: string) {
		expandedVersionId = expandedVersionId === versionId ? null : versionId;
	}
</script>

<div class="w-full">
	<!-- Header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-100 mb-2">
			{getProfileTypeIcon()} {getProfileTypeLabel()} Version History
		</h2>
		<p class="text-gray-400">
			View and restore previous versions of your {profileType} profile. All changes are tracked with timestamps and reasons.
		</p>
	</div>

	<!-- Status Messages -->
	{#if restoreError}
		<div class="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
			<AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm font-medium text-red-400">Error</p>
				<p class="text-sm text-red-300">{restoreError}</p>
			</div>
		</div>
	{/if}

	{#if restoreSuccess}
		<div class="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-3">
			<CheckCircle class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
			<p class="text-sm text-green-300">Version restored successfully!</p>
		</div>
	{/if}

	<!-- Empty State -->
	{#if versions.length === 0}
		<div class="p-8 rounded-lg bg-gray-800/50 border border-gray-700 text-center">
			<Clock class="w-12 h-12 text-gray-600 mx-auto mb-3" />
			<p class="text-gray-400 mb-2">No version history yet</p>
			<p class="text-sm text-gray-500">
				Version history will appear here as you update your {profileType} profile.
			</p>
		</div>
	{:else}
		<!-- Version List -->
		<div class="space-y-3">
			{#each versions as version, index (version.id)}
				<div class="rounded-lg bg-gray-800/50 border border-gray-700 overflow-hidden transition-all hover:border-gray-600">
					<!-- Version Header -->
					<button
						onclick={() => toggleExpanded(version.id)}
						class="w-full px-4 py-4 flex items-start justify-between hover:bg-gray-700/30 transition-colors text-left"
					>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-3 mb-2">
								<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-semibold text-sm">
									v{version.version}
								</span>
								<span class="text-sm text-gray-400">
									{formatDate(version.createdAt)}
								</span>
								<span class="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
									{getVersionSummary(version)}
								</span>
								{#if index === 0}
									<span class="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
										Current
									</span>
								{/if}
							</div>
							<p class="text-sm text-gray-300 line-clamp-2">{version.reason}</p>
						</div>
						<div class="ml-4 flex-shrink-0">
							{#if expandedVersionId === version.id}
								<ChevronUp class="w-5 h-5 text-gray-400" />
							{:else}
								<ChevronDown class="w-5 h-5 text-gray-400" />
							{/if}
						</div>
					</button>

					<!-- Version Details (Expandable) -->
					{#if expandedVersionId === version.id}
						<div class="px-4 py-4 border-t border-gray-700 bg-gray-900/30">
							<!-- Reason -->
							<div class="mb-4">
								<h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Reason for Update</h4>
								<p class="text-sm text-gray-300 bg-gray-700/30 rounded p-3">
									{version.reason}
								</p>
							</div>

							<!-- Profile Data Preview -->
							<div class="mb-4">
								<h4 class="text-xs font-semibold text-gray-400 uppercase mb-2">Profile Data</h4>
								<div class="bg-gray-700/30 rounded p-3 max-h-48 overflow-y-auto">
									{#if profileType === 'preferences'}
										{@const prefs = version.data as any}
										<div class="space-y-3 text-sm">
											{#if prefs.emotionalSignals?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Emotional Signals:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each prefs.emotionalSignals as signal}
															<li>{signal}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if prefs.lifestyleSignals?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Lifestyle Signals:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each prefs.lifestyleSignals as signal}
															<li>{signal}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if prefs.boundaries?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Boundaries:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each prefs.boundaries as boundary}
															<li>{boundary}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if prefs.dealbreakers?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Dealbreakers:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each prefs.dealbreakers as dealbreaker}
															<li>{dealbreaker}</li>
														{/each}
													</ul>
												</div>
											{/if}
										</div>
									{:else}
										{@const pers = version.data as any}
										<div class="space-y-3 text-sm">
											{#if pers.communicationStyle}
												<div>
													<p class="text-gray-400 font-medium mb-1">Communication Style:</p>
													<p class="text-gray-300">{pers.communicationStyle}</p>
												</div>
											{/if}
											{#if pers.personalityVibe}
												<div>
													<p class="text-gray-400 font-medium mb-1">Personality Vibe:</p>
													<p class="text-gray-300">{pers.personalityVibe}</p>
												</div>
											{/if}
											{#if pers.mattersMost}
												<div>
													<p class="text-gray-400 font-medium mb-1">What Matters Most:</p>
													<p class="text-gray-300">{pers.mattersMost}</p>
												</div>
											{/if}
											{#if pers.values?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Core Values:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each pers.values as value}
															<li>{value}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if pers.datingPatterns?.length > 0}
												<div>
													<p class="text-gray-400 font-medium mb-1">Dating Patterns:</p>
													<ul class="list-disc list-inside text-gray-300 space-y-1">
														{#each pers.datingPatterns as pattern}
															<li>{pattern}</li>
														{/each}
													</ul>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<!-- Restore Button -->
							{#if index !== 0}
								<button
									onclick={() => handleRestore(version.id)}
									disabled={restoringVersionId === version.id || isLoading}
									class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors text-sm"
								>
									{#if restoringVersionId === version.id}
										<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										<span>Restoring...</span>
									{:else}
										<RotateCcw class="w-4 h-4" />
										<span>Restore This Version</span>
									{/if}
								</button>
							{:else}
								<div class="w-full px-4 py-2 rounded-lg bg-gray-700/50 text-gray-400 font-medium text-center text-sm">
									This is your current version
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Info Box -->
		<div class="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
			<h4 class="text-sm font-semibold text-blue-300 mb-2">💡 About Version History</h4>
			<ul class="text-xs text-blue-200 space-y-1">
				<li>• Each update creates a new version with a timestamp and reason</li>
				<li>• You can restore any previous version at any time</li>
				<li>• The current version is marked with a green badge</li>
				<li>• Restoring a version will overwrite your current profile</li>
			</ul>
		</div>
	{/if}
</div>

<style>
	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}
</style>
