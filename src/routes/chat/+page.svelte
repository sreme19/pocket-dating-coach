<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Send, Loader2, Sparkles } from 'lucide-svelte';
	import FeedbackButtons from '$lib/components/FeedbackButtons.svelte';
	import AIAssistantControls from '$lib/components/AIAssistantControls.svelte';
	import AssistantBadge from '$lib/components/AssistantBadge.svelte';
	import type { ChatMessage, UserProfile, AssistantType } from '$lib/types';
	import { createSessionStore } from '$lib/client/session-store';
	import { user } from '$lib/verified-vibe/stores';

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let loading = $state(false);
	let userProfile = $state<UserProfile | null>(null);
	let activeAssistant = $state<AssistantType | null>(null);
	let exchangeCount = $state(0);
	let messagesEl: HTMLDivElement;
	let sessionStore: ReturnType<typeof createSessionStore> | null = null;
	let matchId = $state<string>('default-match');
	let userId = $state<string>('');
	let sessionLoading = $state(true);

	const suggestions = [
		'How do I write a good Hinge bio?',
		'What should my first message be?',
		'How do I know if she\'s interested?',
		'Tips for getting more matches on Tinder?',
		'How do I ask someone out without being weird?'
	];

	onMount(async () => {
		// Try to load user profile from multiple sources
		let stored = localStorage.getItem('pdc_profile');
		
		// If not found, try Verified Vibe user
		if (!stored) {
			const vvUser = localStorage.getItem('vv_user');
			if (vvUser) {
				stored = vvUser;
			}
		}
		
		// If not found, try Verified Vibe profile
		if (!stored) {
			stored = localStorage.getItem('vv_profile');
		}
		
		// If still not found, try draft profile
		if (!stored) {
			stored = localStorage.getItem('vv_profile_draft');
		}
		
		// If still not found, try to get from user store (Verified Vibe)
		if (!stored && $user) {
			userProfile = {
				gender: $user.gender || 'prefer_not_to_say',
				ageRange: $user.ageRange || '',
				datingApp: $user.datingApp || '',
				relationshipGoal: $user.relationshipGoal || ''
			};
		}
		
		if (stored && !userProfile) {
			try {
				const profile = JSON.parse(stored);
				// Ensure gender is set
				if (profile.gender) {
					userProfile = profile;
				}
			} catch (e) {
				console.error('Failed to parse profile:', e);
			}
		}

		// Debug logging
		console.log('Chat page - userProfile:', userProfile);
		console.log('Chat page - user store:', $user);
		console.log('Chat page - localStorage keys:', Object.keys(localStorage));

		// Get user ID from localStorage or auth
		const storedUserId = localStorage.getItem('pdc_user_id');
		userId = storedUserId || 'anonymous-user';

		// Get match ID from URL params or use default
		const params = new URLSearchParams(window.location.search);
		matchId = params.get('matchId') || 'default-match';

		// Initialize session store
		sessionStore = createSessionStore(userId, matchId);

		// Load session state from server
		await sessionStore.load();

		// Subscribe to session state changes
		sessionStore.subscribe((state) => {
			activeAssistant = state.activeAssistant;
			exchangeCount = state.assistantConfig?.exchangeCount ?? 0;
			messages = state.conversationHistory;
		});

		sessionLoading = false;
	});

	async function sendMessage(text?: string) {
		const content = text ?? input.trim();
		if (!content || loading) return;
		input = '';

		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content,
			timestamp: Date.now()
		};
		messages = [...messages, userMsg];
		loading = true;
		await tick();
		scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > messages.length - 10).map(m => ({ role: m.role, content: m.content })),
					userProfile,
					matchId,
					activeAssistant
				})
			});

			if (!res.ok) throw new Error('Request failed');
			const data = await res.json();

			const assistantMsg: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: data.reply,
				citations: data.citations,
				timestamp: Date.now(),
				feedback: null,
				assistantType: data.assistantType
			};
			messages = [...messages, assistantMsg];

			// Persist to session store
			if (sessionStore && activeAssistant) {
				await sessionStore.addMessage(userMsg);
				await sessionStore.addMessage(assistantMsg);
			}
		} catch {
			messages = [...messages, {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: "Sorry, something went wrong. Please try again.",
				timestamp: Date.now()
			}];
		} finally {
			loading = false;
			await tick();
			scrollToBottom();
		}
	}

	function scrollToBottom() {
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function setFeedback(id: string, value: 'up' | 'down') {
		messages = messages.map(m => m.id === id ? { ...m, feedback: value } : m);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	async function handleActivateAssistant(assistantType: AssistantType) {
		try {
			if (sessionStore) {
				await sessionStore.activateAssistant(assistantType);
			}
		} catch (error) {
			console.error('Failed to activate assistant:', error);
		}
	}

	async function handleDeactivateAssistant() {
		try {
			if (sessionStore) {
				await sessionStore.deactivateAssistant();
			}
		} catch (error) {
			console.error('Failed to deactivate assistant:', error);
		}
	}

	function handleConfigureAssistant() {
		// Navigate to configuration page
		window.location.href = '/ai-assistant-config';
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="px-6 py-4 border-b border-gray-800">
		<div class="flex items-center justify-between gap-3 mb-3">
			<div class="flex items-center gap-3">
				<Sparkles class="w-5 h-5 text-rose-400" />
				<div>
					<h1 class="font-semibold text-white">Ask Your Coach</h1>
					<p class="text-xs text-gray-500">Powered by your dating book</p>
				</div>
			</div>
			<!-- Active Assistant Badge in Header -->
			{#if activeAssistant && !sessionLoading}
				<AssistantBadge
					assistantType={activeAssistant}
					status="active"
					exchangeCount={exchangeCount}
					showTooltip={true}
					size="md"
					variant="pill"
				/>
			{/if}
		</div>
		<!-- AI Assistant Controls -->
		{#if userProfile && !sessionLoading}
			<AIAssistantControls
				bind:userProfile
				bind:activeAssistant
				{exchangeCount}
				onActivate={handleActivateAssistant}
				onDeactivate={handleDeactivateAssistant}
				onConfigure={handleConfigureAssistant}
			/>
		{/if}
	</div>

	<!-- Messages -->
	<div bind:this={messagesEl} class="flex-1 overflow-y-auto p-6 space-y-4">
		{#if messages.length === 0}
			<div class="flex flex-col items-center justify-center h-full gap-6 text-center">
				<div class="text-5xl">💝</div>
				<div>
					<h2 class="text-xl font-bold text-white mb-1">Your Pocket Dating Coach</h2>
					<p class="text-gray-400 text-sm max-w-sm">Ask anything about dating, profiles, conversations, or relationships. All advice is grounded in your book.</p>
				</div>
				<div class="grid grid-cols-1 gap-2 w-full max-w-md">
					{#each suggestions as s}
						<button
							onclick={() => sendMessage(s)}
							class="text-left px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-rose-500/50 text-sm text-gray-300 hover:text-white transition-all"
						>
							{s}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#each messages as msg (msg.id)}
			<div class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
				<div class={`max-w-[75%] px-4 py-3 rounded-2xl ${
					msg.role === 'user'
						? 'bg-rose-600 text-white rounded-tr-sm'
						: msg.assistantType === 'bestie'
							? 'bg-rose-500/20 text-rose-100 rounded-tl-sm border border-rose-500/30'
							: msg.assistantType === 'wingman'
								? 'bg-blue-500/20 text-blue-100 rounded-tl-sm border border-blue-500/30'
								: 'bg-gray-800 text-gray-100 rounded-tl-sm'
				}`}>
					<!-- Assistant type badge for AI messages -->
					{#if msg.role === 'assistant' && msg.assistantType}
						<div class="mb-2 flex items-center gap-1.5">
							<AssistantBadge
								assistantType={msg.assistantType}
								status="active"
								size="sm"
								variant="compact"
								showTooltip={false}
							/>
						</div>
					{/if}
					<p class="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
					{#if msg.citations && msg.citations.length > 0}
						<div class="mt-2 pt-2 border-t border-white/10">
							{#each msg.citations as citation}
								<p class="text-xs italic opacity-70">{citation}</p>
							{/each}
						</div>
					{/if}
					{#if msg.role === 'assistant'}
						<FeedbackButtons value={msg.feedback ?? null} onFeedback={(v) => setFeedback(msg.id, v)} />
					{/if}
				</div>
			</div>
		{/each}

		{#if loading}
			<div class="flex justify-start">
				<div class="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
					<Loader2 class="w-4 h-4 text-rose-400 animate-spin" />
					<span class="text-sm text-gray-400">Thinking...</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="p-4 border-t border-gray-800">
		<div class="flex gap-3 items-end bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700 focus-within:border-rose-500/50 transition-colors">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="Ask your coach anything..."
				rows="1"
				class="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none leading-relaxed max-h-32"
			></textarea>
			<!-- AI Bestie Toggle Button -->
			{#if userProfile}
				<button
					onclick={() => {
						if (activeAssistant) {
							handleDeactivateAssistant();
						} else {
							handleActivateAssistant(userProfile?.gender === 'woman' ? 'bestie' : 'wingman');
						}
					}}
					disabled={loading || sessionLoading}
					title={activeAssistant ? 'Deactivate AI Assistant' : 'Activate AI Assistant'}
					class={`p-2 rounded-xl transition-all flex-shrink-0 ${
						activeAssistant
							? 'bg-rose-600 hover:bg-rose-700 text-white'
							: 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-300'
					} disabled:opacity-40 disabled:cursor-not-allowed`}
				>
					<Sparkles class="w-4 h-4" />
				</button>
			{/if}
			<!-- Send Button -->
			<button
				onclick={() => sendMessage()}
				disabled={!input.trim() || loading}
				class="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
			>
				<Send class="w-4 h-4 text-white" />
			</button>
		</div>
		<p class="text-xs text-gray-600 text-center mt-2">Advice grounded in "Art of Dating for Indian Men" · Press Enter to send</p>
	</div>
</div>
