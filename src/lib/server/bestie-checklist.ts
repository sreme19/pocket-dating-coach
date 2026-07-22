/**
 * bestie-checklist.ts — AI Bestie's per-man CHECKLIST (spec §D "gap analysis
 * first" + §F "path planning, wrap-up, and repeatability").
 *
 * Before Bestie hands a man off to the woman she works through a small CHECKLIST
 * of things to learn about him — the things the woman cares about that he hasn't
 * surfaced or proven yet. The number of items is computed per-man from her
 * preferences vs. his profile/proofs (NOT a fixed 5), and Bestie checks them off
 * one at a time. When every item is done — her own judgment (§F) — she WRAPS UP:
 * the man's chat freezes and the woman is asked to step in.
 *
 * This module is PURE (types + reducers + prompt block). The Claude call that
 * GENERATES the initial checklist, and the DB persistence, live in
 * bestie-responder.ts — mirroring how proof-signals.ts stays pure while
 * bestie-responder does the model work.
 *
 * Persisted at verified_vibe_matches.bestie_checklist (jsonb). Conversational/UX
 * state ONLY — like proof_request it must never feed trust or match scoring.
 */

/** Sensible bounds on how many items a checklist may hold, so the counter stays legible. */
export const CHECKLIST_MIN_ITEMS = 2;
export const CHECKLIST_MAX_ITEMS = 5;

export type ChecklistItemStatus = 'open' | 'done';

export interface ChecklistItem {
	/** Stable kebab-case id Bestie references when she checks it off. */
	id: string;
	/** Short human label (for context/debugging; never shown verbatim to the man). */
	label: string;
	status: ChecklistItemStatus;
	done_at?: string | null;
}

export type ChecklistStatus = 'active' | 'wrapped';

export interface BestieChecklist {
	items: ChecklistItem[];
	status: ChecklistStatus;
	created_at: string;
	wrapped_at?: string | null;
	/**
	 * Optimistic-concurrency version. Bumped by mergeChecklist on every write; the
	 * persist layer guards the DB update on it so overlapping Bestie generations for
	 * the same match can't lose each other's updates (the "wrap never fired" bug).
	 */
	rev?: number;
	/**
	 * Hand-off HELD by the proof gate: all items may be answered, but she values a
	 * dimension he hasn't proven, so the wrap is withheld until he does. Keeps the
	 * merge from auto-wrapping an all-done-but-unproven checklist. Absent (never set)
	 * on prod until the gate ships — merge then wraps on all-done as before.
	 */
	hold?: boolean;
}

/** Items still open, in checklist order. */
export function openItems(checklist: BestieChecklist | null | undefined): ChecklistItem[] {
	return (checklist?.items ?? []).filter((i) => i.status === 'open');
}

/** How many items are done (the progress numerator the man sees). */
export function doneCount(checklist: BestieChecklist | null | undefined): number {
	return (checklist?.items ?? []).filter((i) => i.status === 'done').length;
}

/** Total items in the checklist (the progress denominator the man sees). */
export function totalCount(checklist: BestieChecklist | null | undefined): number {
	return checklist?.items?.length ?? 0;
}

/** True once Bestie has wrapped up (all items done / her judgment). */
export function isWrapped(checklist: BestieChecklist | null | undefined): boolean {
	return checklist?.status === 'wrapped';
}

/**
 * Build a normalised, bounded checklist from raw model-produced items. Dedupes
 * ids, trims labels, caps to CHECKLIST_MAX_ITEMS, and stamps everything
 * open/active. Returns null when there is nothing usable (caller should skip
 * checklist-tracking rather than persist an empty one).
 */
export function buildChecklist(
	rawItems: Array<{ id?: unknown; label?: unknown }> | null | undefined,
	now: string = new Date().toISOString()
): BestieChecklist | null {
	if (!Array.isArray(rawItems)) return null;
	const seen = new Set<string>();
	const items: ChecklistItem[] = [];
	for (const raw of rawItems) {
		const id = slugifyItemId(raw?.id ?? raw?.label);
		const label = `${raw?.label ?? ''}`.trim().slice(0, 80);
		if (!id || !label || seen.has(id)) continue;
		seen.add(id);
		items.push({ id, label, status: 'open', done_at: null });
		if (items.length >= CHECKLIST_MAX_ITEMS) break;
	}
	if (items.length < CHECKLIST_MIN_ITEMS) return null;
	return { items, status: 'active', created_at: now, wrapped_at: null };
}

/** Kebab-case an item id from a raw id or label. */
function slugifyItemId(raw: unknown): string {
	return `${raw ?? ''}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

/**
 * Prompt block listing the OPEN items Bestie should still draw out, plus how to
 * report progress. Returns '' when there is no active checklist or nothing open
 * (so the reply prompt keeps its legacy output shape). `hasWork` tells the caller
 * whether the itemsDone/wrapUp output fields should be requested this turn.
 */
export function buildChecklistBlock(checklist: BestieChecklist | null | undefined): {
	block: string;
	hasWork: boolean;
} {
	if (!checklist || checklist.status !== 'active') return { block: '', hasWork: false };
	const open = openItems(checklist);
	if (open.length === 0) return { block: '', hasWork: false };

	const lines = open.map((i) => `  - ${i.id}: ${i.label}`).join('\n');
	const done = doneCount(checklist);
	const total = totalCount(checklist);
	const block =
		`\nYour open checklist items to draw out (cover them naturally through conversation, ONE focus at a time, never as a checklist read aloud or an interview):\n${lines}\n` +
		`Progress so far: ${done}/${total} done.\n` +
		`- When his latest answer genuinely covers one or more of these items, list their ids in "itemsDone". Only mark an item done when it's really answered — not on a vague or deflecting reply.\n` +
		`- When every item is done (or you judge you have enough to bring her in), set "wrapUp": true. On that turn your "reply" is ONLY a brief, warm one-liner reacting to what he just said — do NOT mention handing off, waiting, or her stepping in, and do NOT ask a question. The hand-off line is appended automatically.`;
	return { block, hasWork: true };
}

/**
 * The guaranteed hand-off closing line (spec §F). Appended in code to Bestie's
 * wrap-up reply so the "she'll take it from here" message is ALWAYS said, even if
 * the model's own reply drifts. Keeps her voice (the model writes the lead-in) +
 * guarantees the close-off + the invitation to ask about her while he waits.
 */
export function handoffClosingLine(userName: string): string {
	return `I've got everything I need for now, so I've asked ${userName} to jump in and take it from here. Feel free to ask me anything about her while you wait.`;
}

/**
 * Prompt block for the HAND-OFF PHASE — after Bestie has wrapped up (checklist
 * 'wrapped') she is no longer drawing him out. She's told him she's bringing the
 * woman in and is now just keeping him company until she steps in: reactive, lets
 * HIM lead, and does not interrogate. Injected instead of the checklist block.
 */
export function buildHandoffPhaseBlock(userName: string, matchName: string): string {
	return `

HAND-OFF PHASE — you've already told ${matchName} you're bringing ${userName} in. Now you're just keeping him company until she steps in. Your job here is NOT to draw him out anymore:
- Let HIM lead. Answer whatever he asks about ${userName} warmly and honestly, within her boundaries (never her private contact details).
- Do NOT interrogate, do NOT run through topics, and do NOT end your message with a question. Never stack questions.
- Only ask something back when HIS message naturally invites one (he asked you something that genuinely begs a follow-up) — otherwise none.
- If he has little to say, a short friendly reply is fine. Never chase him or fill silence with a question.
- Don't keep repeating that she's stepping in — you've already said it once.`;
}

/**
 * Compute the post-reply checklist state from what the model reported this turn.
 * Marks the named items done and, when wrapUp is true OR all items end up done,
 * flips the checklist to 'wrapped'. Pure — persistence is the caller's job.
 * Returns undefined when nothing changed.
 */
export function nextChecklistState(
	prev: BestieChecklist | null | undefined,
	parsed: { itemsDone?: unknown; wrapUp?: unknown },
	now: string = new Date().toISOString()
): BestieChecklist | undefined {
	if (!prev || prev.status !== 'active') return undefined;

	const doneIds = new Set(
		(Array.isArray(parsed.itemsDone) ? parsed.itemsDone : [])
			.map((x) => `${x ?? ''}`.trim())
			.filter(Boolean)
	);

	let changed = false;
	const items = prev.items.map((i) => {
		if (i.status === 'open' && doneIds.has(i.id)) {
			changed = true;
			return { ...i, status: 'done' as const, done_at: now };
		}
		return i;
	});

	const allDone = items.every((i) => i.status === 'done');
	const wrapUp = parsed.wrapUp === true || allDone;

	if (!changed && !wrapUp) return undefined;

	if (wrapUp) {
		return { ...prev, items, status: 'wrapped', wrapped_at: now };
	}
	return { ...prev, items };
}

/** Earliest of two ISO timestamps (either may be null/undefined). */
function earliestIso(a?: string | null, b?: string | null): string | null {
	if (a && b) return Date.parse(a) <= Date.parse(b) ? a : b;
	return a ?? b ?? null;
}

/**
 * Monotonically merge a freshly-read checklist (`current`, from the DB right before
 * writing) with a transition computed from a possibly-stale snapshot (`incoming`,
 * from the start of this Bestie generation). This is the concurrency-safe core that
 * fixes lost wrap-ups when two generations for the same match overlap:
 *
 *   · done-marks UNION — an item done in EITHER side stays done (earliest done_at);
 *     item EXISTENCE follows `current` (the fresher row), so a stale set can't
 *     resurrect or drop items;
 *   · wrap is STICKY and also fires when every item is done — UNLESS `hold` is set
 *     (the proof gate withholding the hand-off; absent on prod until the gate ships);
 *   · `rev` is bumped so the persist layer can guard the write (optimistic CAS).
 *
 * Pure. The caller re-reads `current`, calls this, and writes guarded on the old rev.
 */
export function mergeChecklist(
	current: BestieChecklist | null | undefined,
	incoming: BestieChecklist | null | undefined,
	now: string = new Date().toISOString()
): BestieChecklist | null {
	if (!incoming && !current) return null;
	if (!incoming) return current ?? null;
	if (!current) return { ...incoming, rev: (incoming.rev ?? 0) + 1 };

	const incById = new Map(incoming.items.map((i) => [i.id, i]));
	const items = current.items.map((cur) => {
		const inc = incById.get(cur.id);
		const curDone = cur.status === 'done';
		const incDone = inc?.status === 'done';
		if (!curDone && !incDone) return cur;
		return {
			...cur,
			status: 'done' as const,
			done_at: earliestIso(curDone ? cur.done_at : null, incDone ? inc?.done_at : null) ?? now,
		};
	});

	// `hold` is explicit-false-aware: the gate's ready-to-wrap path sets hold:false to
	// release a prior hold, so we must not fall back to current.hold in that case.
	const held = incoming.hold ?? current.hold ?? false;
	const allDone = items.length > 0 && items.every((i) => i.status === 'done');
	const wrapped = current.status === 'wrapped' || incoming.status === 'wrapped' || (allDone && !held);

	return {
		items,
		status: wrapped ? 'wrapped' : 'active',
		created_at: current.created_at,
		wrapped_at: wrapped ? current.wrapped_at ?? now : null,
		hold: wrapped ? undefined : held || undefined,
		rev: (current.rev ?? 0) + 1,
	};
}
