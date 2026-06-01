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
