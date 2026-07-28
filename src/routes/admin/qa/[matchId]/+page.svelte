<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import QaRubricPanel from '$lib/components/QaRubricPanel.svelte';
	import QaFlagNote from '$lib/components/QaFlagNote.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let r = $derived(data.review);

	// Humanize the reason-chip key stored with thumbs-down feedback.
	const REASON_LABELS: Record<string, string> = {
		too_generic: 'Too generic',
		not_relevant: 'Not relevant',
		wrong_tone: 'Wrong tone',
		factually_off: 'Factually off',
		other: 'Other'
	};
	const reasonLabel = (k: string | null) => (k ? (REASON_LABELS[k] ?? k) : null);

	// Per-message flag state + notes, seeded from any existing review.
	const initialFlags = data.review.existingReview?.flagged_message_ids ?? [];
	let flagged = $state<Record<string, boolean>>(
		Object.fromEntries(initialFlags.map((f) => [f.id, true]))
	);
	let notes = $state<Record<string, string>>(
		Object.fromEntries(initialFlags.map((f) => [f.id, f.note]))
	);

	// Per-note save: a "Save note" button submits the whole review form, but we track
	// which note triggered it so we can show local "Saving…/Saved ✓" feedback.
	let pendingNoteId = $state<string | null>(null);
	let savingNoteId = $state<string | null>(null);
	let savedNoteId = $state<string | null>(null);

	function requestNoteSave(id: string) {
		pendingNoteId = id;
	}

	const submitReview = () => {
		const noteId = pendingNoteId;
		if (noteId) savingNoteId = noteId;
		return async ({ result, update }: { result: { type: string }; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			// Keep the reviewer's in-progress scores/notes — don't reset the form.
			await update({ reset: false });
			savingNoteId = null;
			if (noteId && result.type === 'success') savedNoteId = noteId;
			pendingNoteId = null;
		};
	};

	function fmtTime(ts: string): string {
		return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
	const signalColor = (s: string | null) =>
		s === '🚩' ? 'border-rose-500/40 bg-rose-500/5' : s === '⚠️' ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5';

	// ── Hand-off panel ────────────────────────────────────────────────────────
	let h = $derived(r.handoff);

	const PHASE_LABEL: Record<string, string> = {
		none: 'No checklist yet',
		active: 'Bestie still vetting',
		held: 'Wrap held by proof gate',
		wrapped: 'Handed off — awaiting her',
		expired: 'Expired'
	};
	const PHASE_STYLE: Record<string, string> = {
		none: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
		active: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
		held: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
		wrapped: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
		expired: 'border-rose-500/40 bg-rose-500/10 text-rose-300'
	};

	const hoursText = (n: number | null) =>
		n == null ? '—' : n <= 0 ? 'under an hour' : n === 1 ? '1 hour' : `${n} hours`;

	// Everything a reviewer should be alarmed by, in one list. These are the exact
	// conditions under which a waiting man gets no honest signal about where he stands.
	let handoffWarnings = $derived.by(() => {
		const w: string[] = [];
		if (h.phase !== 'wrapped') return w;
		if (h.ownerReadSinceHandoff === false)
			w.push('She has not opened this thread since the hand-off — notified, but never saw it.');
		if (!h.ownerHasPush)
			w.push('No device token: push nudges cannot reach her (email fallback only, stages 2–3).');
		if (h.nudgeStage === 0) w.push('No nudge has fired yet for her.');
		if (h.remainingHours != null && h.remainingHours <= 6)
			w.push(`Under ${hoursText(h.remainingHours)} left before this expires and he is auto-rematched.`);
		return w;
	});

	// Where the hand-off falls in the transcript — the first message at/after the wrap.
	let handoffMarkerId = $derived.by(() => {
		if (!h.wrappedAt) return null;
		const t = Date.parse(h.wrappedAt);
		return r.messages.find((m) => Date.parse(m.createdAt) >= t)?.id ?? null;
	});
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

	<form method="POST" action="?/save" use:enhance={submitReview}>
		<div class="flex flex-col gap-6 lg:flex-row">
			<!-- LEFT: reconstructed conversation -->
			<div class="min-w-0 flex-1 space-y-6">
				<!-- Hand-off state: whether Bestie has handed off, and where the 48h window stands. -->
				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Hand-off</h2>
					<div class="rounded-xl border border-white/[0.06] bg-[#0d1522] p-3">
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="rounded border px-2 py-0.5 text-xs font-semibold {PHASE_STYLE[h.phase] ??
									PHASE_STYLE.none}"
							>
								{PHASE_LABEL[h.phase] ?? h.phase}
							</span>
							{#if h.itemsTotal > 0}
								<span class="text-xs text-slate-400">checklist {h.itemsDone}/{h.itemsTotal}</span>
							{/if}
							<span class="text-xs {h.bestieActive ? 'text-indigo-300' : 'text-slate-500'}">
								· Bestie {h.bestieActive ? 'active (speaking for her)' : 'off (she took over)'}
							</span>
						</div>

						{#if h.phase === 'wrapped' || h.phase === 'expired'}
							<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
								<div>
									<dt class="text-slate-500">Handed off</dt>
									<dd class="text-slate-200">{h.wrappedAt ? fmtTime(h.wrappedAt) : '—'}</dd>
								</div>
								<div>
									<dt class="text-slate-500">He has waited</dt>
									<dd class="text-slate-200">{hoursText(h.elapsedHours)}</dd>
								</div>
								<div>
									<dt class="text-slate-500">Window left</dt>
									<dd class={h.remainingHours != null && h.remainingHours <= 6 ? 'text-rose-300' : 'text-slate-200'}>
										{h.phase === 'expired' ? 'expired' : hoursText(h.remainingHours)}
									</dd>
								</div>
								<div>
									<dt class="text-slate-500">Nudges sent</dt>
									<dd class="text-slate-200">stage {h.nudgeStage} of 3</dd>
								</div>
								<div>
									<dt class="text-slate-500">She last opened</dt>
									<dd class={h.ownerReadSinceHandoff === false ? 'text-rose-300' : 'text-slate-200'}>
										{h.ownerLastReadAt ? fmtTime(h.ownerLastReadAt) : 'never'}
										{#if h.ownerReadSinceHandoff === false}<span class="text-rose-400"> (pre-hand-off)</span>{/if}
									</dd>
								</div>
								<div>
									<dt class="text-slate-500">Expires</dt>
									<dd class="text-slate-200">{h.expiresAt ? fmtTime(h.expiresAt) : '—'}</dd>
								</div>
							</dl>
						{/if}

						{#if h.expiredAt}
							<p class="mt-2 text-xs text-rose-300">
								Expired {fmtTime(h.expiredAt)}{#if h.replacedByMatchId}
									· replaced by
									<a href="/admin/qa/{h.replacedByMatchId}" class="underline hover:text-rose-200">
										his new match
									</a>
								{/if}
							</p>
						{/if}

						{#if handoffWarnings.length > 0}
							<ul class="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
								{#each handoffWarnings as warn (warn)}
									<li class="text-xs text-amber-300">⚠️ {warn}</li>
								{/each}
							</ul>
						{/if}
					</div>
				</section>

				<section>
					<h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Match thread</h2>
					{#if r.messages.length === 0}
						<p class="text-sm text-slate-600">No messages in this match thread.</p>
					{/if}
					<div class="space-y-3">
						{#each r.messages as m (m.id)}
							{@const mine = m.senderId === r.participantA.id}
							{#if m.id === handoffMarkerId}
								<div class="flex items-center gap-2 py-1">
									<div class="h-px flex-1 bg-emerald-500/30"></div>
									<span class="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
										Hand-off — everything below is her waiting
									</span>
									<div class="h-px flex-1 bg-emerald-500/30"></div>
								</div>
							{/if}
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
									<div class="mt-1 {mine ? '' : 'flex flex-col items-end'}">
										<QaFlagNote
											id={m.id}
											bind:flagged={flagged[m.id]}
											bind:note={notes[m.id]}
											saving={savingNoteId === m.id}
											saved={savedNoteId === m.id}
											onRequestSave={requestNoteSave}
										/>
									</div>
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
									<div class="mb-1 flex flex-wrap items-center gap-x-2 text-xs">
										<span class={f.feedbackType === 'positive' ? 'text-emerald-400' : 'text-rose-400'}
											>{f.feedbackType === 'positive' ? '👍' : '👎'} {f.ownerName}</span
										>
										<span class="rounded bg-white/[0.06] px-1.5 py-0.5 uppercase tracking-wide text-slate-400"
											>{f.assistantType === 'wingman' ? 'Wingman' : 'Bestie'}</span
										>
										{#if reasonLabel(f.reasonChip)}
											<span class="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">{reasonLabel(f.reasonChip)}</span>
										{/if}
										<span class="text-slate-600"> · {fmtTime(f.createdAt)}</span>
									</div>
									<div class="whitespace-pre-wrap text-slate-300">{f.messageContent}</div>
									{#if f.feedbackText}
										<div class="mt-2 border-l-2 border-rose-500/40 pl-2 text-xs italic text-slate-400">
											“{f.feedbackText}”
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			<!-- RIGHT: rubric (resizable, shared with advisor review) -->
			<QaRubricPanel existingReview={r.existingReview} {form} />
		</div>
	</form>
</div>
