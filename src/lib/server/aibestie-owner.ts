/**
 * aibestie-owner.ts — whose thread an /aibestie ad visitor lands in, and what we
 * are allowed to promise him about her.
 *
 * TWO SEPARATE QUESTIONS, DELIBERATELY NOT ONE FLAG.
 *
 * The roster (AIBESTIE_LP_OWNER_IDS) says which profile the landing page opens a
 * thread against. The staffed list (AIBESTIE_LP_STAFFED_IDS) says which of those
 * profiles has a real, consenting human behind them who has agreed to read these
 * threads and step in.
 *
 * They are separate because the whole conversion moment rests on one sentence —
 * "she'll read this, and she may step in" — and that sentence is TRUE or FALSE
 * depending on the answer to the second question alone. Today the only available
 * owner is a seed profile, so it is false. When a real woman is assigned it
 * becomes true. If "who owns the thread" and "is anyone actually behind it" were
 * the same setting, then pointing the page at a profile would silently switch the
 * promise on, and the honest-terminus decision would live in prose inside a prompt
 * — the least reliable place in the system to keep a factual claim.
 *
 * So the promise is structural. An unstaffed owner CANNOT tell it: the caller asks
 * terminusMode() and gets 'artifact', whose copy only claims things that are true
 * of a seed profile (the transcript is saved, it goes on his profile, the
 * matchmaker will use it). No prompt edit and no deploy can turn that into a
 * person who is going to reply.
 *
 * Both settings are env-driven so the roster can change without a deploy, and
 * neither has a hardcoded default: an unset roster disables the landing page
 * rather than falling back to some profile nobody chose.
 */

import { env } from '$env/dynamic/private';

function idList(raw: string | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * The profiles the landing page may open a thread against.
 *
 * Empty means the page is not configured, which is the correct posture for an
 * unset variable: a paid ad pointing at a thread with no owner should fail
 * closed and visibly, not pick someone.
 */
export function lpOwnerRoster(): string[] {
	return idList(env.AIBESTIE_LP_OWNER_IDS);
}

/**
 * Owners with a real human behind them who has agreed, in writing, to read these
 * threads and to their profile being used this way.
 *
 * Intentionally NOT derived from is_seed. A non-seed profile is not evidence that
 * its owner agreed to receive paid anonymous traffic — that is a decision someone
 * makes off-platform, so it is recorded off-platform too.
 */
export function staffedOwners(): string[] {
	const roster = new Set(lpOwnerRoster());
	return idList(env.AIBESTIE_LP_STAFFED_IDS).filter((id) => roster.has(id));
}

export function isStaffedOwner(ownerId: string): boolean {
	return staffedOwners().includes(ownerId);
}

/** Is the landing page configured enough to serve anyone at all? */
export function lpConfigured(): boolean {
	return lpOwnerRoster().length > 0;
}

/**
 * Choose the owner for a new visitor.
 *
 * Staffed owners are preferred whenever any exist: a thread a human will actually
 * read is worth more than an even spread across the roster. Within a tier the pick
 * is random, which is all the load-spreading a roster of this size needs.
 */
export function pickOwner(): string | null {
	const staffed = staffedOwners();
	const pool = staffed.length > 0 ? staffed : lpOwnerRoster();
	if (pool.length === 0) return null;
	return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Which closing promise this thread has earned.
 *
 *  'human'    — a real person will read this and may step in. Only for a staffed
 *               owner, and only ever set from the staffed list.
 *  'artifact' — everything he said is saved and goes on his profile, and the
 *               matchmaker will use it. True of every owner including a seed, so
 *               it is the safe default and the fallback for anything unknown.
 */
export type TerminusMode = 'human' | 'artifact';

export function terminusMode(ownerId: string | null | undefined): TerminusMode {
	return ownerId && isStaffedOwner(ownerId) ? 'human' : 'artifact';
}
