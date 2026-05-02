<script lang="ts">
	import type { UserProfile, Gender, DatingApp, RelationshipGoal } from '$lib/types';

	let { existing, onSave, onClose }: {
		existing: UserProfile | null;
		onSave: (p: UserProfile) => void;
		onClose: () => void;
	} = $props();

	let gender = $state<Gender>(existing?.gender ?? 'man');
	let ageRange = $state(existing?.ageRange ?? '25-30');
	let datingApp = $state<DatingApp>(existing?.datingApp ?? 'hinge');
	let relationshipGoal = $state<RelationshipGoal>(existing?.relationshipGoal ?? 'serious');

	function save() {
		onSave({ gender, ageRange, datingApp, relationshipGoal });
	}

	const isNew = !existing;
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
	<div class="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
		<!-- Header -->
		<div class="p-6 pb-4 border-b border-gray-800">
			<div class="flex items-center gap-3 mb-1">
				<div class="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white text-lg">💝</div>
				<h2 class="text-xl font-bold text-white">{isNew ? 'Welcome to Pocket Dating Coach' : 'Update Your Profile'}</h2>
			</div>
			<p class="text-sm text-gray-400 ml-11">{isNew ? 'Tell me a bit about yourself so I can personalize your coaching.' : 'Update your details to keep advice relevant.'}</p>
		</div>

		<div class="p-6 space-y-5">
			<!-- Gender -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">I am a</label>
				<div class="grid grid-cols-3 gap-2">
					{#each [['man', '👨 Man'], ['woman', '👩 Woman'], ['prefer_not_to_say', '🙂 Prefer not']] as [val, label]}
						<button
							onclick={() => gender = val as Gender}
							class={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${gender === val ? 'bg-rose-600 border-rose-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Age Range -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">Age range</label>
				<select
					bind:value={ageRange}
					class="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-rose-500"
				>
					{#each ['18-22', '23-27', '28-32', '33-37', '38-42', '43-50', '50+'] as r}
						<option value={r}>{r}</option>
					{/each}
				</select>
			</div>

			<!-- Dating App -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">Primary dating app</label>
				<div class="grid grid-cols-2 gap-2">
					{#each [['tinder', '🔥 Tinder'], ['bumble', '🐝 Bumble'], ['hinge', '💛 Hinge'], ['other', '📱 Other']] as [val, label]}
						<button
							onclick={() => datingApp = val as DatingApp}
							class={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${datingApp === val ? 'bg-rose-600 border-rose-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Relationship Goal -->
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-2">I'm looking for</label>
				<div class="grid grid-cols-3 gap-2">
					{#each [['serious', '💍 Serious'], ['casual', '✨ Casual'], ['not_sure', '🤷 Not sure']] as [val, label]}
						<button
							onclick={() => relationshipGoal = val as RelationshipGoal}
							class={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${relationshipGoal === val ? 'bg-rose-600 border-rose-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="p-6 pt-0 flex gap-3">
			{#if !isNew}
				<button
					onclick={onClose}
					class="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800 transition-all"
				>
					Cancel
				</button>
			{/if}
			<button
				onclick={save}
				class="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all"
			>
				{isNew ? "Let's go 🚀" : 'Save changes'}
			</button>
		</div>
	</div>
</div>
