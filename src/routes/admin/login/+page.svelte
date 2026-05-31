<script lang="ts">
	import { page } from '$app/stores';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let next = $derived($page.url.searchParams.get('next') ?? '/admin/qa');
</script>

<div class="flex min-h-screen items-center justify-center bg-[#0b1120] px-6 text-slate-100">
	<form method="POST" action="?/login" class="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-[#0d1522] p-8">
		<h1 class="text-xl font-bold text-white">QA Console</h1>
		<p class="mt-1 mb-6 text-sm text-slate-500">Pocket Dating Coach · AI review</p>

		<input type="hidden" name="next" value={next} />

		<label class="mb-1 block text-xs text-slate-400" for="reviewer">Your name</label>
		<input
			id="reviewer"
			name="reviewer"
			autocomplete="name"
			class="mb-4 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
			placeholder="e.g. Priya (intern)"
		/>

		<label class="mb-1 block text-xs text-slate-400" for="password">Access password</label>
		<input
			id="password"
			name="password"
			type="password"
			autocomplete="current-password"
			class="mb-4 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
		/>

		{#if form?.error}
			<p class="mb-3 text-sm text-rose-400">{form.error}</p>
		{/if}

		<button
			class="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#0b1120] transition-colors hover:bg-emerald-400"
			>Enter</button
		>
	</form>
</div>
