<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { RUBRIC } from '$lib/qa-rubric';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let r = $derived(data.review);
	let ex = $derived(data.review.existingReview);

	const existingScore = (key: string): number | null => {
		if (!ex) return null;
		return (ex as unknown as Record<string, number | null>)[`score_${key}`] ?? null;
	};

	function fmtTime(ts: string): string {
		return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
	const signalColor = (s: string | null) =>
		s === '🚩' ? 'border-rose-500/40 bg-rose-500/5' : s === '⚠️' ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5';
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-6 text-slate-100">
	<a href="/admin/qa" class="text-xs text-slate-500 hover:text-slate-300">← Back to queue</a>

	<div class="mt-2 mb-5">
		<h1 class="text-xl font-bold text-white">{r.participantA.name} ↔ {r.participantB.name}</h1>
		<p class="text-sm text-slate-500">
			{r.participantA.gender ?? '?'}, {r.participantA.archetype ?? '—'}
			· {r.participantB.gender ?? '?'}, {r.participantB.archetype ?? '—'}
			· match {r.status}
		</p>
	</div>

	<form method="POST" action="?/save" use:enhance>
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_480px]">
			<!-- LEFT: reconstructed conversation -->
			<div class="space-y-6">
				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Match thread</h2>
					{#if r.messages.length === 0}
						<p class="text-sm text-slate-600">No messages in this match thread.</p>
					{/if}
					<div class="space-y-3">
						{#each r.messages as m (m.id)}
							{@const mine = m.senderId === r.participantA.id}
							<div class="flex {mine ? 'justify-start' : 'justify-end'}">
								<div class="max-w-[78%]">
									<div class="mb-0.5 flex items-center gap-2 text-xs text-slate-500 {mine ? '' : 'justify-end'}">
										<span class={m.isAi ? 'text-indigo-400' : ''}>{m.senderLabel}</span>
										<span>{fmtTime(m.createdAt)}</span>
										{#if m.isAi}<span class="rounded bg-indigo-500/20 px-1.5 text-[10px] text-indigo-300">AI-sent</span>{/if}
									</div>
									<div
										class="rounded-2xl border px-3 py-2 text-sm {m.isAi
											? 'border-indigo-500/30 bg-indigo-500/10 text-slate-100'
											: 'border-white/[0.08] bg-[#0d1522] text-slate-200'}"
									>
										{m.content}
									</div>
									{#if m.aiRead}
										<div class="mt-1 rounded-lg border px-3 py-2 text-xs text-slate-300 {signalColor(m.aiSignal)}">
											<span class="font-semibold">{m.aiSignal ?? ''} Bestie’s Take:</span>
											{m.aiRead}
										</div>
									{/if}
									<label class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 {mine ? '' : 'justify-end'}">
										<input
											type="checkbox"
											name="flagged"
											value={m.id}
											checked={ex?.flagged_message_ids?.includes(m.id) ?? false}
											class="accent-rose-500"
										/> flag this message
									</label>
								</div>
							</div>
						{/each}
					</div>
				</section>

				{#if r.coachingThreads.length}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
							Coaching conversations (AI ↔ owner)
						</h2>
						{#each r.coachingThreads as t (t.id)}
							<div class="mb-4 rounded-xl border border-white/[0.06] bg-[#0d1522] p-3">
								<div class="mb-2 text-xs text-emerald-400">
									{t.assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman'} · with {t.ownerName}
								</div>
								<div class="space-y-2">
									{#each t.messages as cm}
										<div class="text-sm">
											<span class="text-xs font-semibold {cm.role === 'assistant' ? 'text-indigo-400' : 'text-slate-400'}"
												>{cm.role === 'assistant' ? 'AI' : t.ownerName}:</span
											>
											<span class="text-slate-200"> {cm.content}</span>
											{#if cm.citations?.length}
												<div class="mt-0.5 text-[11px] text-slate-500">{cm.citations.join(' · ')}</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</section>
				{/if}

				{#if r.feedback.length}
					<section>
						<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">User feedback on AI replies</h2>
						<div class="space-y-2">
							{#each r.feedback as f (f.id)}
								<div class="rounded-lg border border-white/[0.06] bg-[#0d1522] p-3 text-sm">
									<div class="mb-1 text-xs">
										<span class={f.feedbackType === 'positive' ? 'text-emerald-400' : 'text-rose-400'}
											>{f.feedbackType === 'positive' ? '👍' : '👎'} {f.ownerName}</span
										>
										<span class="text-slate-600"> · {fmtTime(f.createdAt)}</span>
									</div>
									<div class="whitespace-pre-wrap text-slate-300">{f.messageContent}</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			<!-- RIGHT: rubric -->
			<aside class="lg:sticky lg:top-6 lg:self-start">
				<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-4">
					<h2 class="mb-3 text-sm font-semibold text-white">Rubric · 1 (poor) – 5 (excellent)</h2>

					{#each RUBRIC as dim}
						<div class="mb-4">
							<div class="text-sm text-slate-200">{dim.label}</div>
							<div class="mb-1.5 text-[11px] text-slate-500">{dim.hint}</div>
							<div class="flex gap-1">
								{#each [1, 2, 3, 4, 5] as n}
									<label class="flex-1">
										<input type="radio" name="score_{dim.key}" value={n} checked={existingScore(dim.key) === n} class="peer sr-only" />
										<span
											class="block cursor-pointer rounded-md border border-white/[0.1] py-1 text-center text-xs text-slate-400 peer-checked:border-emerald-400 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-300 hover:border-white/30"
											>{n}</span
										>
									</label>
								{/each}
							</div>
						</div>
					{/each}

					<label class="mb-1 block text-sm text-slate-200" for="comments">Comments</label>
					<textarea
						id="comments"
						name="comments"
						rows="4"
						value={ex?.comments ?? ''}
						placeholder="What worked, what didn’t, anything to escalate…"
						class="mb-3 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
					></textarea>

					<label class="mb-1 block text-xs text-slate-400" for="status">Verdict</label>
					<select
						id="status"
						name="status"
						value={ex?.status ?? 'reviewed'}
						class="mb-4 w-full rounded-lg border border-white/[0.1] bg-[#0b1120] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
					>
						<option value="reviewed">Reviewed — OK</option>
						<option value="needs_followup">Needs follow-up</option>
						<option value="escalated">Escalate</option>
					</select>

					{#if form?.error}<p class="mb-2 text-sm text-rose-400">{form.error}</p>{/if}
					{#if form?.saved}<p class="mb-2 text-sm text-emerald-400">Saved ✓</p>{/if}

					<button class="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#0b1120] hover:bg-emerald-400"
						>Save review</button
					>

					{#if ex}
						<p class="mt-2 text-center text-[11px] text-slate-600">
							Last reviewed by {ex.reviewer} · {fmtTime(ex.updated_at)}
						</p>
					{/if}
				</div>
			</aside>
		</div>
	</form>
</div>
