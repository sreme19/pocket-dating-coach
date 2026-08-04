/**
 * question-rounds.ts — "ask him more" (G-27).
 *
 * At the hand-off she gets three ways to commit: step in, set up a call, share her
 * details. There is no button for "interested, but not ready", so that state becomes
 * silence — and silence expires the match. Two thirds of Bestie's completed hand-offs
 * died exactly that way. This is the missing button.
 *
 * She picks follow-up topics and can add a question in her own words; Bestie reopens
 * the checklist and goes back to him. Twice per match at most, and the second time he
 * is told plainly it is the last, because the thing that makes a man walk is not being
 * asked questions — it is not knowing when they stop.
 *
 * PURE. The endpoint does the database work.
 */

import type { BestieChecklist, ChecklistItem } from './bestie-checklist';

/** Two per match, ever. Not per re-vet, not per wrap. */
export const MAX_ROUNDS = 2;

/** Her free-text question, capped in line with every other input surface. */
export const FREE_TEXT_MAX = 300;

export interface RoundsState {
	/** Rounds already spent on this match, 0..MAX_ROUNDS. */
	used: number;
}

export function roundsRemaining(used: number | null | undefined): number {
	return Math.max(0, MAX_ROUNDS - Math.max(0, used ?? 0));
}

/** Is this the final round she will get? Drives the disclosure to him. */
export function isFinalRound(used: number | null | undefined): boolean {
	return roundsRemaining(used) === 1;
}

/**
 * May she ask right now?
 *
 * Only while Bestie is still the proxy on a wrapped checklist. That single condition
 * also rules out the two cases we never wanted: an expired match has Bestie switched
 * off, and a networking thread never shows the hand-off card the button lives on. If
 * she has already taken over, she can simply ask him herself — pulling Bestie back in
 * mid-conversation would be jarring for him and pointless for her.
 */
export function canAskMore(opts: {
	bestieActive: boolean;
	checklistStatus: string | null | undefined;
	roundsUsed: number | null | undefined;
	status: string;
}): { allowed: boolean; reason: string | null } {
	if (opts.status !== 'mutual') return { allowed: false, reason: 'This match is no longer active.' };
	if (!opts.bestieActive) return { allowed: false, reason: "You're talking to him yourself — just ask him." };
	if (opts.checklistStatus !== 'wrapped') return { allowed: false, reason: "I'm still getting to know him." };
	if (roundsRemaining(opts.roundsUsed) === 0) {
		return { allowed: false, reason: "That's everything I can ask him without it turning into an interview." };
	}
	return { allowed: true, reason: null };
}

/**
 * Reopen a wrapped checklist with her questions appended.
 *
 * Reopening is ALSO how the 48-hour clock is suspended — the clock is derived from
 * `wrapped_at`, so clearing it stops the countdown, and the fresh 48 hours begin when
 * Bestie wraps again. No separate pause state, and no way for the two to disagree.
 *
 * CHECKLIST_MAX_ITEMS is deliberately NOT applied. That cap keeps Bestie's own
 * generated checklist legible; these are items the owner explicitly chose, and
 * silently dropping her seventh question would be worse than a long list. Bestie still
 * paces delivery, and the "don't drill" rule still stops her pressing one subject.
 */
export function reopenWithQuestions(
	current: BestieChecklist | null | undefined,
	questions: Array<{ id: string; label: string; topic?: string | null }>,
	now: string = new Date().toISOString()
): BestieChecklist | null {
	if (!current || questions.length === 0) return null;

	const existing = new Set(current.items.map((i) => i.id));
	const added: ChecklistItem[] = [];
	for (const q of questions) {
		const id = slug(q.id || q.label);
		if (!id || existing.has(id)) continue; // already asked — do not ask twice
		existing.add(id);
		added.push({
			id,
			label: q.label.trim().slice(0, 120),
			status: 'open',
			done_at: null,
			...(q.topic ? { topic: q.topic } : {}),
		});
	}
	if (added.length === 0) return null;

	return {
		items: [...current.items, ...added],
		status: 'active',
		created_at: current.created_at,
		wrapped_at: null, // suspends the hand-off clock
		hold: undefined,
		rev: (current.rev ?? 0) + 1,
	};
}

function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 48);
}

// ── Policy screen on her free text ───────────────────────────────────────────

export interface FreeTextVerdict {
	allowed: boolean;
	/** Why Bestie will not ask it, in her voice, for the woman to read. */
	refusal: string | null;
	/** The nearest thing she CAN ask instead, so a no is never a dead end. */
	alternative: string | null;
}

/**
 * Screen a free-text question before it reaches a prompt.
 *
 * She can type anything, and this box is a direct path from her keyboard into what
 * Bestie says to a real person. A declined question is explained and paired with the
 * nearest thing Bestie can do, never silently dropped — silently dropping it would
 * leave her believing it was asked.
 */
export function screenFreeText(raw: string): FreeTextVerdict {
	const text = (raw ?? '').trim();
	if (!text) return { allowed: true, refusal: null, alternative: null };

	// Money. The rule is absolute: financial standing is a fraud check, never a reason
	// anyone is desirable, so Bestie does not ask what a man earns or is worth.
	// Inflections matter here: "what he earns" is the most natural way to ask it, and an
	// un-suffixed \bearn\b misses every one of them. A screen that only catches the
	// phrasing nobody uses is not a screen.
	if (
		/\b(earns?|earning|earnings|salar(y|ies)|income|payslips?|pay ?slips?|net ?worth|bank (balance|statements?)|rich|wealthy|affords?|paid)\b/i.test(text) ||
		/how much (he |does he |she |they )?(makes?|earns?|is worth|has)/i.test(text)
	) {
		return {
			allowed: false,
			refusal:
				"I don't ask anyone what they earn or what they're worth. His financial documents get verified to confirm he's real and solvent, and that's a fraud check rather than something I'd raise as a reason to like him.",
			alternative:
				"If it's stability you're weighing, I can ask how he thinks about the future and what he's building toward.",
		};
	}

	// Her contact details. Hers to give out, and not via Bestie.
	if (/\b(my |her )?(number|phone|whatsapp|instagram|insta|snap|telegram|email|address)\b/i.test(text)) {
		return {
			allowed: false,
			refusal:
				"I won't pass your details on — that's yours to share when you want to, and you can do it from the wrap-up card any time.",
			alternative: 'I can ask how he prefers to keep in touch once you two are talking directly.',
		};
	}

	// Anything sexual. She may of course want to know; Bestie is not the one to ask.
	if (/\b(sex|sexual|in bed|body count|virgin|kinks?|nudes?)\b/i.test(text)) {
		return {
			allowed: false,
			refusal: "That's not something I'll bring up with him on your behalf.",
			alternative: 'I can ask what he wants from a relationship and how he sees it going.',
		};
	}

	return { allowed: true, refusal: null, alternative: null };
}

// ── What to offer her ────────────────────────────────────────────────────────

export interface TopicSuggestion {
	id: string;
	label: string;
	/** Canonical ledger topic key, when there is one. */
	topic: string | null;
	/** Grouping for the full browse list. */
	group: string;
	/** He has already covered this. Shown struck through rather than hidden. */
	answered: boolean;
}

/**
 * The topics she can pick from.
 *
 * Already-answered ones are returned MARKED rather than removed: hiding them leaves
 * her wondering why something obvious is missing, where showing it struck through
 * tells her it is covered. That is also why `answered` is a flag and not a filter.
 */
export function buildTopicSuggestions(opts: {
	/** Canonical taxonomy: [{ key, label, group? }] from vv_ledger_topics. */
	taxonomy: Array<{ key: string; label: string; group?: string | null }>;
	/** Topic keys already on this man's checklist (asked, whether or not answered). */
	askedTopics: Iterable<string>;
	/** Item labels already on the checklist, for taxonomy rows with no key. */
	askedLabels: Iterable<string>;
}): TopicSuggestion[] {
	const asked = new Set([...opts.askedTopics].filter(Boolean));
	const askedLabel = new Set([...opts.askedLabels].map((l) => l.trim().toLowerCase()));
	return opts.taxonomy
		.filter((t) => t.key && t.label)
		.map((t) => ({
			id: t.key,
			label: t.label,
			topic: t.key,
			group: t.group?.trim() || 'More',
			answered: asked.has(t.key) || askedLabel.has(t.label.trim().toLowerCase())
		}));
}

/**
 * The prompt block telling Bestie about this round.
 *
 * The framing rule is the one the hand-off clock work established: state what she
 * DID, never what she feels. "She read everything and came back with more she wants
 * to know" is true and lands warmly. "She's really interested" is unverifiable, and
 * with two thirds of hand-offs going unanswered it would often turn out to be false —
 * which is worse for him than saying nothing.
 */
export function buildQuestionRoundBlock(opts: {
	userName: string;
	matchName: string;
	topics: string[];
	freeText: string | null;
	finalRound: boolean;
}): string {
	const { userName, matchName, topics, freeText, finalRound } = opts;
	const lines = [
		`\n\nSHE HAS COME BACK WITH MORE SHE WANTS TO KNOW — open this reply on it:`,
		`- ${userName} read everything ${matchName} told you and asked you to find out more. Say that plainly and warmly: she read it and came back with more she wants to know, and that does not happen with everyone.`,
		`- State what she DID, never how she feels. You may NOT say she is interested, keen, excited, impressed, or that she likes him — you have not asked her and you do not know. Never predict that she will reply.`,
	];
	if (topics.length > 0) {
		lines.push(`- What she wants to know about: ${topics.join('; ')}.`);
	}
	if (freeText) {
		lines.push(`- In her own words, and this one matters most: "${freeText}" — work it in naturally, in your voice, not as a quotation.`);
	}
	lines.push(
		`- Weave these in over the conversation. Do NOT fire them off as a list, and never more than one question in a message — the same rules as always.`
	);
	if (finalRound) {
		lines.push(
			`- TELL HIM THIS IS THE LAST TIME, unprompted, in this message: after these you are done coming back to him with questions. Say it once, warmly, as a fact rather than an apology. He deserves to know there is an end.`
		);
	}
	return lines.join('\n');
}
