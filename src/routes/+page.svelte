<script lang="ts">
	import { goto } from '$app/navigation';
	import { Heart, Zap, Users } from 'lucide-svelte';
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
	<!-- Header with navigation -->
	<div class="px-6 py-4 border-b border-slate-800/50">
		<div class="max-w-6xl mx-auto flex items-center justify-between">
			<div class="text-2xl font-bold">💬 Pocket Dating Coach</div>
			<div class="flex gap-4">
				<button
					onclick={() => goto('/chat')}
					class="text-slate-400 hover:text-white transition-colors"
				>
					Ask Coach
				</button>
				<button
					onclick={() => goto('/profile-review')}
					class="text-slate-400 hover:text-white transition-colors"
				>
					Analyze Profile
				</button>
			</div>
		</div>
	</div>

	<!-- Hero section -->
	<div class="flex-1 flex flex-col items-center justify-center px-6 py-20">
		<div class="max-w-2xl w-full text-center">
			<!-- Main heading -->
			<h1 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">
				Build your <span class="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500"
					>dating profile</span
				> in minutes
			</h1>

			<!-- Subheading -->
			<p class="text-xl text-slate-300 mb-8">
				Upload photos, tell your story, get a psychographic profile that makes you feel good.
			</p>

			<!-- Features -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 py-8">
				<div class="flex flex-col items-center">
					<div class="w-12 h-12 rounded-xl bg-rose-600/20 flex items-center justify-center mb-3">
						<Heart class="w-6 h-6 text-rose-400" />
					</div>
					<p class="text-sm font-medium">Flattering, not fake</p>
					<p class="text-xs text-slate-500">Grounded in your real story</p>
				</div>
				<div class="flex flex-col items-center">
					<div class="w-12 h-12 rounded-xl bg-amber-600/20 flex items-center justify-center mb-3">
						<Zap class="w-6 h-6 text-amber-400" />
					</div>
					<p class="text-sm font-medium">AI-powered</p>
					<p class="text-xs text-slate-500">Powered by Claude</p>
				</div>
				<div class="flex flex-col items-center">
					<div class="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center mb-3">
						<Users class="w-6 h-6 text-blue-400" />
					</div>
					<p class="text-sm font-medium">Shareable</p>
					<p class="text-xs text-slate-500">Export to Tinder, Hinge, Bumble</p>
				</div>
			</div>

			<!-- CTA buttons -->
			<div class="flex flex-col sm:flex-row gap-4 justify-center mb-12">
				<button
					onclick={() => goto('/vibe-quiz')}
					class="px-8 py-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 rounded-xl font-bold text-lg transition-all transform hover:scale-105"
				>
					Build Your Profile →
				</button>
				<button
					onclick={() => goto('/chat')}
					class="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-lg transition-colors"
				>
					Ask Coach First
				</button>
			</div>

			<!-- Trust indicators -->
			<div class="flex items-center justify-center gap-8 text-sm text-slate-400 flex-wrap">
				<div>✓ No creepy AI</div>
				<div>✓ Your data is private</div>
				<div>✓ Takes 5 minutes</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div class="px-6 py-8 border-t border-slate-800/50 text-center text-sm text-slate-500">
		<p>Made for the modern dating scene. By your dating coach, powered by AI.</p>
	</div>
</div>
