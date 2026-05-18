<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowRight, CheckCircle2 } from 'lucide-svelte';
	import type { UserProfile, CommunicationStyle, PersonalityVibe, MattersMost } from '$lib/types';

	let currentQuestion = $state(0);
	let answers = $state<{
		relationshipGoal?: 'casual' | 'serious' | 'not_sure';
		communicationStyle?: CommunicationStyle;
		personalityVibe?: PersonalityVibe;
		mattersMost?: MattersMost;
	}>({});

	const questions = [
		{
			id: 'relationshipGoal',
			question: "Whats your vibe?",
			subtitle: "Dating goals for now",
			options: [
				{ value: 'casual', label: '🔥 Keep it casual', emoji: '🔥' },
				{ value: 'serious', label: '💘 Looking for something real', emoji: '💘' },
				{ value: 'not_sure', label: '🤷 Honestly, not sure yet', emoji: '🤷' }
			]
		},
		{
			id: 'communicationStyle',
			question: 'How do you usually text?',
			subtitle: 'Your communication style',
			options: [
				{ value: 'playful', label: '😂 Playful & jokey', emoji: '😂' },
				{ value: 'genuine', label: '💯 Real & genuine', emoji: '💯' },
				{ value: 'direct', label: '🎯 Direct & straightforward', emoji: '🎯' }
			]
		},
		{
			id: 'personalityVibe',
			question: 'Whats your energy?',
			subtitle: 'How people describe you',
			options: [
				{ value: 'ambitious', label: '🚀 Ambitious & driven', emoji: '🚀' },
				{ value: 'chill', label: '😎 Chill & easygoing', emoji: '😎' },
				{ value: 'adventurous', label: '🧗 Adventurous & spontaneous', emoji: '🧗' }
			]
		},
		{
			id: 'mattersMost',
			question: 'What matters most?',
			subtitle: 'In a potential match',
			options: [
				{ value: 'looks', label: '👀 Physical attraction', emoji: '👀' },
				{ value: 'humor', label: '😄 Can make me laugh', emoji: '😄' },
				{ value: 'compatibility', label: '🧩 We just click', emoji: '🧩' }
			]
		}
	];

	let question = $derived(questions[currentQuestion]);
	const answered = Object.keys(answers).length;
	const total = questions.length;
	const progress = (answered / total) * 100;

	function selectOption(optionValue: string) {
		answers[question.id as keyof typeof answers] = optionValue as never;

		if (currentQuestion < questions.length - 1) {
			setTimeout(() => {
				currentQuestion++;
			}, 300);
		} else {
			completeQuiz();
		}
	}

	function completeQuiz() {
		// Load existing profile
		const existingProfile = localStorage.getItem('pdc_profile');
		const profile: UserProfile = existingProfile ? JSON.parse(existingProfile) : {
			gender: 'man',
			ageRange: '25-35',
			datingApp: 'tinder',
			relationshipGoal: 'serious'
		};

		// Update with quiz answers
		profile.relationshipGoal = answers.relationshipGoal as 'casual' | 'serious' | 'not_sure';
		profile.communicationStyle = answers.communicationStyle;
		profile.personalityVibe = answers.personalityVibe;
		profile.mattersMost = answers.mattersMost;

		localStorage.setItem('pdc_profile', JSON.stringify(profile));
		goto('/profile-intake');
	}

	function goBack() {
		if (currentQuestion > 0) {
			currentQuestion--;
		} else {
			goto('/');
		}
	}
</script>

<div class="min-h-screen bg-slate-950 text-white flex flex-col">
	<!-- Header with progress -->
	<div class="px-6 py-6 border-b border-slate-800">
		<div class="max-w-2xl mx-auto">
			<div class="flex items-center justify-between mb-4">
				<button
					onclick={goBack}
					class="text-slate-400 hover:text-white transition-colors"
				>
					← Back
				</button>
				<div class="text-sm text-slate-400">
					{answered}/{total}
				</div>
			</div>
			<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
				<div
					class="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-300"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Quiz content -->
	<div class="flex-1 flex items-center justify-center px-6 py-12">
		<div class="max-w-2xl w-full">
			<!-- Question -->
			<div class="mb-12">
				<p class="text-slate-400 text-sm mb-2">{question.subtitle}</p>
				<h1 class="text-4xl md:text-5xl font-bold mb-2">{question.question}</h1>
			</div>

			<!-- Options -->
			<div class="space-y-3">
				{#each question.options as option (option.value)}
					<button
						onclick={() => selectOption(option.value)}
						class="w-full group relative overflow-hidden rounded-xl bg-slate-800 hover:bg-slate-700 transition-all duration-200 p-6 text-left border border-slate-700 hover:border-rose-500/50"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<span class="text-3xl">{option.emoji}</span>
								<span class="text-lg font-medium">{option.label}</span>
							</div>
							<ArrowRight class="w-5 h-5 text-slate-600 group-hover:text-rose-500 transition-colors" />
						</div>
					</button>
				{/each}
			</div>

			<!-- Celebration message -->
			{#if answered === total}
				<div class="mt-12 text-center">
					<div class="mb-4 flex justify-center">
						<CheckCircle2 class="w-16 h-16 text-emerald-500" />
					</div>
					<p class="text-xl text-slate-300">You're all set! Let's build your profile.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Footer hint -->
	<div class="px-6 py-6 text-center text-sm text-slate-500 border-t border-slate-800">
		Take your time. This helps us personalize your experience.
	</div>
</div>
