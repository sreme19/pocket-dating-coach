<script lang="ts">
	import type { PageData } from './$types';
	import type { VoiceCallRow } from './+page.server';

	let { data }: { data: PageData } = $props();

	let statusFilter = $state<'all' | 'completed' | 'partial' | 'failed' | 'no_answer'>('all');
	let expanded = $state<string | null>(null);

	let calls = $derived(
		(data.calls as VoiceCallRow[]).filter((c) => statusFilter === 'all' || c.status === statusFilter)
	);

	function fmtDuration(s: number | null): string {
		if (s == null) return '—';
		const m = Math.floor(s / 60);
		return `${m}:${(s % 60).toString().padStart(2, '0')}`;
	}
	function fmtTime(iso: string): string {
		return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
	}
	function statusClass(s: string): string {
		if (s === 'completed') return 'bg-emerald-500/20 text-emerald-400';
		if (s === 'live' || s === 'ringing') return 'bg-sky-500/20 text-sky-400';
		if (s === 'partial') return 'bg-amber-500/20 text-amber-400';
		return 'bg-rose-500/20 text-rose-400';
	}
	function toggle(id: string) {
		expanded = expanded === id ? null : id;
	}

	const filters = ['all', 'completed', 'partial', 'failed', 'no_answer'] as const;
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-5 text-slate-200">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-lg font-bold text-white">AI Bestie — Voice Calls</h1>
			<p class="text-xs text-slate-400">
				Read-only audit of live bestie voice calls: transcript, the recap posted to the thread, the
				private read, and any drafts. Latency is in Analytics → AI Latency (type
				<code class="text-slate-300">voice_summary</code>).
			</p>
		</div>
		<div class="flex gap-1">
			{#each filters as f}
				<button
					class="rounded px-2.5 py-1 text-xs transition-colors {statusFilter === f
						? 'bg-emerald-500/20 text-emerald-400'
						: 'text-slate-400 hover:text-slate-200'}"
					onclick={() => (statusFilter = f)}
				>
					{f}
				</button>
			{/each}
		</div>
	</div>

	{#if calls.length === 0}
		<div class="rounded border border-white/[0.06] bg-[#0f172a] px-4 py-10 text-center text-sm text-slate-400">
			No voice calls{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ' yet'}.
		</div>
	{:else}
		<div class="overflow-hidden rounded border border-white/[0.06]">
			<table class="w-full text-sm">
				<thead class="bg-[#0f172a] text-xs uppercase tracking-wide text-slate-500">
					<tr>
						<th class="px-3 py-2 text-left font-medium">When</th>
						<th class="px-3 py-2 text-left font-medium">Bestie of → Caller</th>
						<th class="px-3 py-2 text-left font-medium">Status</th>
						<th class="px-3 py-2 text-left font-medium">Voice</th>
						<th class="px-3 py-2 text-right font-medium">Duration</th>
						<th class="px-3 py-2 text-right font-medium">Turns</th>
						<th class="px-3 py-2 text-right font-medium">Drafts</th>
					</tr>
				</thead>
				<tbody>
					{#each calls as c (c.id)}
						<tr
							class="cursor-pointer border-t border-white/[0.04] hover:bg-white/[0.02] {expanded === c.id ? 'bg-white/[0.03]' : ''}"
							onclick={() => toggle(c.id)}
						>
							<td class="px-3 py-2 text-slate-400">{fmtTime(c.startedAt)}</td>
							<td class="px-3 py-2">
								<span class="text-white">{c.ownerName}</span>
								<span class="text-slate-500"> → </span>
								<span class="text-slate-300">{c.callerName}</span>
							</td>
							<td class="px-3 py-2">
								<span class="rounded px-2 py-0.5 text-xs {statusClass(c.status)}">{c.status}</span>
							</td>
							<td class="px-3 py-2 text-xs text-slate-400">{c.usedClonedVoice ? 'cloned' : 'default'}</td>
							<td class="px-3 py-2 text-right text-slate-300">{fmtDuration(c.durationS)}</td>
							<td class="px-3 py-2 text-right text-slate-400">{c.turnCount}</td>
							<td class="px-3 py-2 text-right text-slate-400">{c.draftCount}</td>
						</tr>
						{#if expanded === c.id}
							<tr class="border-t border-white/[0.04] bg-[#0a0f1c]">
								<td colspan="7" class="px-4 py-4">
									<div class="mb-3">
										<a href={`/admin/qa/voice/${c.id}`} class="rounded bg-pink-500/15 px-2.5 py-1 text-xs font-medium text-pink-300 hover:bg-pink-500/25">
											Open scored review →
										</a>
									</div>
									<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
										<!-- Transcript -->
										<div>
											<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Transcript</h3>
											{#if c.transcript.length === 0}
												<p class="text-xs text-slate-500">No transcript captured.</p>
											{:else}
												<div class="space-y-1.5">
													{#each c.transcript as t}
														<div class="text-sm">
															<span class="text-xs font-semibold {t.role === 'agent' ? 'text-pink-400' : 'text-sky-400'}">
																{t.role === 'agent' ? `${c.ownerName}'s bestie` : c.callerName}:
															</span>
															<span class="text-slate-300"> {t.text}</span>
														</div>
													{/each}
												</div>
											{/if}
										</div>

										<!-- Recap + read + drafts -->
										<div class="space-y-3">
											<div>
												<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
													Recap posted to thread
												</h3>
												<p class="text-sm text-slate-300">{c.recap ?? '— none —'}</p>
											</div>
											<div>
												<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
													Private read for {c.ownerName} {c.signal ? `· ${c.signal}` : ''}
												</h3>
												<p class="text-sm text-slate-300">{c.read || '— none —'}</p>
											</div>
											{#if c.drafts.length}
												<div>
													<h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
														Drafts left ({c.drafts.length})
													</h3>
													<ul class="space-y-1">
														{#each c.drafts as d}
															<li class="rounded bg-white/[0.04] px-2 py-1 text-sm text-slate-300">{d.text}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if c.failureReason}
												<p class="text-xs text-rose-400">Failure: {c.failureReason}</p>
											{/if}
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
