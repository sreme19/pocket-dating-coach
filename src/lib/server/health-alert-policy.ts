import type { HealthReport } from './health';

/**
 * Decision rules for the health-alert cron — pure, no I/O, so the whole rule
 * set can be exercised deterministically in a test.
 *
 * Written against two real incidents on 2026-09-13.
 *
 * FIRST: a sustained Supabase outage emailed on all ~70 failing runs, because
 * the cron had no memory of having already written.
 *
 * SECOND, after the memory was added: Supabase began FLAPPING — intermittent
 * 504s, fine in between — and produced three emails in forty minutes. Two
 * causes, both fixed here. Every down -> up -> down counted as a brand new
 * incident and earned a fresh pair of emails; and a recovery notice repeated
 * whenever clearing the record failed, which it does exactly when the database
 * being written to is the one flapping.
 *
 * Hence the two rules that matter most below: ONE EMAIL PER 24 HOURS whatever
 * it says (the clock survives recovery instead of being reset by it), and a
 * fault must survive MIN_CONSECUTIVE_FAULTS checks before it is worth anything.
 */

/** At most one email per day, of any kind. The single strongest guarantee here. */
export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * How many consecutive failing checks before a fault is real. The cron runs
 * every 10 minutes, so 2 means a fault must still be there 10 minutes later.
 * A lone 504 in an otherwise healthy run now produces nothing at all.
 */
export const MIN_CONSECUTIVE_FAULTS = 2;

/**
 * The blind path. The store lives in Supabase, so when Supabase itself is down
 * the cron cannot look up whether it already emailed. Nothing is remembered, so
 * the clock decides instead: a blind run may email only in one fixed slot per
 * day. The cron fires at :00/:10/.../:50, so exactly one run a day satisfies
 * both conditions.
 *
 * 02:00 UTC is 07:30 IST. Cron drift of a few minutes stays inside the window;
 * the worst case is two emails in that hour rather than one, never seventy.
 */
export const FALLBACK_HOUR_UTC = 2;
const FALLBACK_SLOT_MINUTES = 10;

export interface AlertState {
	/** What is failing right now. '' when healthy. */
	currentSignature: string;
	/** What we last actually told them about. '' when we last said "recovered". */
	reportedSignature: string;
	/** Consecutive checks the current fault has been present for. */
	consecutiveFaults: number;
	/** When the current fault was first seen. '' when healthy. */
	firstSeenAt: string;
	/** Last email of ANY kind. Survives recovery — this is what caps the volume. */
	lastEmailedAt: string;
}

export type AlertReason =
	| 'new'             // a fault we have not reported, present long enough to be real
	| 'changed'         // strictly worse than what we last reported — escalation
	| 'reminder'        // same fault, still broken a day later
	| 'recovered'       // we reported a fault, it is now clear
	| 'settling'        // a fault, but not yet on two consecutive checks
	| 'cooldown'        // inside the 24h ceiling
	| 'fallback_slot'   // store unreachable, and this is the one daily slot
	| 'fallback_quiet'  // store unreachable, not the daily slot
	| 'healthy';        // nothing wrong and nothing outstanding

export interface AlertDecision {
	email: boolean;
	reason: AlertReason;
	/** State to persist. null only on the blind path, where nothing can be written. */
	nextState: AlertState | null;
}

export const EMPTY_STATE: AlertState = {
	currentSignature: '',
	reportedSignature: '',
	consecutiveFaults: 0,
	firstSeenAt: '',
	lastEmailedAt: '',
};

/**
 * A stable name for "what is wrong right now" — sorted, so key order can never
 * make one fault look like two. supabase going degraded -> down changes this
 * string, which is what lets an escalation through the ceiling below.
 */
export function faultSignature(report: HealthReport): string {
	return Object.entries(report.services)
		.filter(([, s]) => s.status !== 'ok')
		.map(([name, s]) => `${name}:${s.status}`)
		.sort()
		.join('|');
}

/** down beats degraded beats fine. Used only to spot a fault getting worse. */
function severity(signature: string): number {
	if (signature.includes(':down')) return 2;
	if (signature.includes(':degraded')) return 1;
	return 0;
}

/**
 * Pure decision. Takes the report, the clock and whatever was on record
 * (undefined means the store could not be read) and returns whether to email
 * plus the state to persist — which is returned on every run, not only the ones
 * that send, because the consecutive-fault count has to advance either way.
 */
export function decideAlert(
	report: HealthReport,
	now: Date,
	state: AlertState | null | undefined,
): AlertDecision {
	const signature = faultSignature(report);

	// Store unreachable — which is exactly what a Supabase outage looks like.
	if (state === undefined) {
		if (!signature) return { email: false, reason: 'healthy', nextState: null };
		const inSlot =
			now.getUTCHours() === FALLBACK_HOUR_UTC && now.getUTCMinutes() < FALLBACK_SLOT_MINUTES;
		return {
			email: inSlot,
			reason: inSlot ? 'fallback_slot' : 'fallback_quiet',
			nextState: null,
		};
	}

	const prev = state ?? EMPTY_STATE;
	const nowIso = now.toISOString();
	const sameFault = signature !== '' && signature === prev.currentSignature;

	const next: AlertState = {
		...prev,
		currentSignature: signature,
		consecutiveFaults: signature ? (sameFault ? prev.consecutiveFaults + 1 : 1) : 0,
		firstSeenAt: signature ? (sameFault && prev.firstSeenAt ? prev.firstSeenAt : nowIso) : '',
	};

	const cooled =
		!prev.lastEmailedAt || now.getTime() - Date.parse(prev.lastEmailedAt) >= COOLDOWN_MS;

	// ── healthy ──────────────────────────────────────────────────────────────
	if (!signature) {
		// Only worth a word if we actually told them it was broken.
		if (prev.reportedSignature && cooled) {
			return {
				email: true,
				reason: 'recovered',
				nextState: { ...next, reportedSignature: '', lastEmailedAt: nowIso },
			};
		}
		return { email: false, reason: prev.reportedSignature ? 'cooldown' : 'healthy', nextState: next };
	}

	// ── something is wrong ───────────────────────────────────────────────────
	// A single bad check is noise. This is what a flapping 504 now produces.
	if (next.consecutiveFaults < MIN_CONSECUTIVE_FAULTS) {
		return { email: false, reason: 'settling', nextState: next };
	}

	// The one thing allowed through the daily ceiling: a fault we have already
	// reported getting strictly worse. Self-limiting — once reported at the
	// higher severity there is nowhere further up to go.
	const escalation =
		prev.reportedSignature !== '' && severity(signature) > severity(prev.reportedSignature);

	if (!cooled && !escalation) {
		return { email: false, reason: 'cooldown', nextState: next };
	}

	const reason: AlertReason =
		prev.reportedSignature === '' ? 'new'
		: signature !== prev.reportedSignature ? 'changed'
		: 'reminder';

	return {
		email: true,
		reason,
		nextState: { ...next, reportedSignature: signature, lastEmailedAt: nowIso },
	};
}

/** Is persisting this worth a write? Avoids a database round trip every 10 minutes. */
export function stateChanged(prev: AlertState | null, next: AlertState | null): boolean {
	return JSON.stringify(prev ?? EMPTY_STATE) !== JSON.stringify(next ?? EMPTY_STATE);
}
