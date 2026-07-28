/**
 * handoff-clock.ts — the shared 48h hand-off window (spec B2).
 *
 * When Bestie wraps up her checklist the woman has a fixed window to step in;
 * if she doesn't, the match expires (reversibly) and the man is given a fresh
 * replacement. Two places need that clock and they must never disagree:
 *
 *   · the handoff-timeout cron — nudge cadence + expiry
 *   · AI Bestie — so she can tell the man WHERE HE STANDS instead of inventing
 *     a timeline ("she's joining today, promise" — an invention that cost us a
 *     real man's trust on 2026-07-28)
 *
 * The man-facing half of this module exists because the honest answer to "is she
 * going to join or should I give up?" is a FACT we already hold: she was notified,
 * the window is N hours, X have elapsed. Bestie may state that. She may never
 * speak for the woman's intent — see buildHandoffPhaseBlock.
 *
 * PURE: no DB, no clock reads except the injectable `now`.
 */

/** The hand-off window. She steps in inside this, or the match expires (reversibly). */
export const HANDOFF_TIMEOUT_HOURS = 48;
/** Nudge cadence within the window (stage 1 fires at hand-off). */
export const HANDOFF_NUDGE_24H_HOURS = 24;
export const HANDOFF_NUDGE_FINAL_HOURS = 45; // ~3h before expiry

export interface HandoffClock {
	wrappedAt: string;
	/** Whole hours since the hand-off (floored — never overstates how long he's waited). */
	elapsedHours: number;
	/** Whole hours left in the window (floored — never over-promises time he doesn't have). */
	remainingHours: number;
	expiresAt: string;
	/** Past the window: the cron's next sweep will expire this match. */
	expired: boolean;
}

/**
 * Compute the hand-off clock from a checklist's `wrapped_at`. Returns null when
 * there's no usable timestamp (an un-wrapped or legacy checklist) — callers then
 * simply have no clock to talk about, which is the pre-existing behaviour.
 */
export function computeHandoffClock(
	wrappedAt: string | null | undefined,
	now: number = Date.now()
): HandoffClock | null {
	if (!wrappedAt) return null;
	const start = Date.parse(wrappedAt);
	if (Number.isNaN(start)) return null;

	const elapsedMs = Math.max(0, now - start);
	const windowMs = HANDOFF_TIMEOUT_HOURS * 3_600_000;
	const remainingMs = windowMs - elapsedMs;

	return {
		wrappedAt,
		elapsedHours: Math.floor(elapsedMs / 3_600_000),
		remainingHours: Math.max(0, Math.floor(remainingMs / 3_600_000)),
		expiresAt: new Date(start + windowMs).toISOString(),
		expired: remainingMs <= 0
	};
}

/** Human duration for prompt/UI copy: "under an hour", "1 hour", "23 hours". */
export function hoursLabel(hours: number): string {
	if (hours <= 0) return 'under an hour';
	return hours === 1 ? '1 hour' : `${hours} hours`;
}
