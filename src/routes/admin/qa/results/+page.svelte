<script lang="ts">
	import type { PageData } from './$types';
	import { RUBRIC } from '$lib/qa-rubric';

	let { data }: { data: PageData } = $props();
	let s = $derived(data.stats);
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<h1 class="mb-1 text-2xl font-bold text-white">QA Results</h1>
	<p class="mb-6 text-sm text-slate-500">{s.totalReviews} reviews across {s.matchesReviewed} matches</p>

	<div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
		{#each RUBRIC as dim}
			{@const v = s.avgByDimension[dim.key]}
			<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4 text-center">
				<div class="text-2xl font-bold {v === null ? 'text-slate-600' : v >= 4 ? 'text-emerald-400' : v >= 3 ? 'text-amber-400' : 'text-rose-400'}">
					{v ?? '—'}
				</div>
				<div class="mt-1 text-xs text-slate-500">{dim.label}</div>
			</div>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4">
			<h2 class="mb-3 text-sm font-semibold text-white">By verdict</h2>
			{#each Object.entries(s.byStatus) as [status, count]}
				<div class="flex justify-between border-t border-white/[0.04] py-2 text-sm first:border-0">
					<span class="capitalize text-slate-300">{status.replace('_', ' ')}</span>
					<span class="text-slate-400">{count}</span>
				</div>
			{:else}
				<p class="text-sm text-slate-600">No reviews yet.</p>
			{/each}
		</div>

		<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4">
			<h2 class="mb-3 text-sm font-semibold text-white">By reviewer</h2>
			{#each s.byReviewer as rv}
				<div class="flex justify-between border-t border-white/[0.04] py-2 text-sm first:border-0">
					<span class="text-slate-300">{rv.reviewer}</span>
					<span class="text-slate-400">{rv.count} reviews · avg {rv.avgScore ?? '—'}</span>
				</div>
			{:else}
				<p class="text-sm text-slate-600">No reviews yet.</p>
			{/each}
		</div>
	</div>

	{#if s.escalations.length}
		<div class="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
			<h2 class="mb-3 text-sm font-semibold text-rose-400">Escalations</h2>
			{#each s.escalations as e}
				<a href={e.href} class="block border-t border-white/[0.04] py-2 text-sm first:border-0 hover:bg-white/[0.02]">
					<div class="flex justify-between">
						<span class="text-slate-300">{e.reviewer} <span class="text-xs text-slate-600">· {e.label}</span></span>
						<span class="text-xs text-slate-600">{new Date(e.updatedAt).toLocaleDateString()}</span>
					</div>
					{#if e.comments}<div class="text-xs text-slate-500">{e.comments}</div>{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
