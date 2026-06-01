<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let aiOnly = $state(true);
	let reviewFilter = $state<'all' | 'unreviewed' | 'reviewed'>('unreviewed');
	let search = $state('');

	let filtered = $derived(
		data.queue
			.filter((r) => {
				if (aiOnly && !r.hasAi) return false;
				if (reviewFilter === 'unreviewed' && r.review) return false;
				if (reviewFilter === 'reviewed' && !r.review) return false;
				if (search.trim()) {
					const q = search.toLowerCase();
					if (!`${r.participantA.name} ${r.participantB.name}`.toLowerCase().includes(q)) return false;
				}
				return true;
			})
			.sort((a, b) => {
				const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
				const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
				return tb - ta;
			})
	);

	let stats = $derived({
		total: data.queue.length,
		withAi: data.queue.filter((r) => r.hasAi).length,
		unreviewed: data.queue.filter((r) => r.hasAi && !r.review).length
	});

	function fmt(ts: string | null): string {
		if (!ts) return '—';
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mb-1 flex items-baseline justify-between">
		<h1 class="text-2xl font-bold text-white">QA Queue</h1>
		<a href="/admin/qa/export" class="text-xs text-emerald-400 hover:text-emerald-300">Download CSV ↓</a>
	</div>
	<p class="mb-6 text-sm text-slate-500">
		{stats.withAi} threads with AI activity · {stats.unreviewed} awaiting review
	</p>

	<div class="mb-5 flex flex-wrap items-center gap-2">
		<div class="flex overflow-hidden rounded-lg border border-white/[0.08] text-xs">
			{#each ['unreviewed', 'all', 'reviewed'] as const as f}
				<button
					onclick={() => (reviewFilter = f)}
					class="px-3 py-1.5 capitalize transition-colors {reviewFilter === f
						? 'bg-emerald-500/20 text-emerald-400'
						: 'text-slate-400 hover:text-slate-200'}">{f}</button
				>
			{/each}
		</div>
		<label class="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-400">
			<input type="checkbox" bind:checked={aiOnly} class="accent-emerald-500" /> AI activity only
		</label>
		<input
			bind:value={search}
			placeholder="Search participants…"
			class="rounded-lg border border-white/[0.08] bg-[#0d1522] px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500/50"
		/>
	</div>

	<div class="overflow-hidden rounded-xl border border-white/[0.06]">
		<table class="w-full text-left text-sm">
			<thead class="bg-[#0d1522] text-xs text-slate-500">
				<tr>
					<th class="px-4 py-2.5 font-medium">Match</th>
					<th class="px-4 py-2.5 font-medium">AI activity</th>
					<th class="px-4 py-2.5 font-medium">Last msg</th>
					<th class="px-4 py-2.5 font-medium">Review</th>
					<th class="px-4 py-2.5"></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as r (r.href)}
					<tr class="border-t border-white/[0.04] hover:bg-white/[0.02]">
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<div class="font-medium text-slate-100">{r.participantA.name} ↔ {r.participantB.name}</div>
								{#if r.kind === 'advisor'}
									<span class="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">advisor</span>
								{/if}
							</div>
							<div class="text-xs text-slate-500">
								{#if r.kind === 'advisor'}
									global advisor · {r.participantB.archetype ?? '—'}
								{:else}
									{r.participantA.archetype ?? '—'} · {r.participantB.archetype ?? '—'}
								{/if}
							</div>
						</td>
						<td class="px-4 py-3 text-xs text-slate-400">
							<span class="text-slate-200">{r.counts.messages}</span> msgs
							{#if r.counts.aiMessages}· <span class="text-indigo-400">{r.counts.aiMessages} AI-sent</span>{/if}
							{#if r.counts.coached}· <span class="text-amber-400">{r.counts.coached} coached</span>{/if}
							{#if r.counts.coachingThreads}· <span class="text-emerald-400">{r.counts.coachingThreads} threads</span>{/if}
						</td>
						<td class="px-4 py-3 text-xs text-slate-400">{fmt(r.lastActivityAt)}</td>
						<td class="px-4 py-3 text-xs">
							{#if r.review}
								<span
									class="rounded px-2 py-0.5 {r.review.status === 'escalated'
										? 'bg-rose-500/15 text-rose-400'
										: 'bg-emerald-500/15 text-emerald-400'}">{r.review.status}</span
								>
								{#if r.review.avgScore !== null}<span class="ml-1 text-slate-500">avg {r.review.avgScore}</span>{/if}
								<div class="mt-0.5 text-slate-600">{r.review.reviewer}</div>
							{:else}
								<span class="text-slate-600">—</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<a
								href={r.href}
								class="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
								>{r.review ? 'View' : 'Review'} →</a
							>
						</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">No matches for this filter.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
