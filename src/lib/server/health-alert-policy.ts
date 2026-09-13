import type { HealthReport } from './health';

/**
 * Decision rules for the health-alert cron — pure, no I/O, so the whole rule
 * set can be exercised deterministically in a test.
 *
 * The cron runs every 10 minutes and, before this existed, emailed on every
 * single failing run — one Supabase outage on 2026-09-13 produced ~70 identical
 * emails about a fault first reported at 01:40 GMT. Detection stays at 10
 * minutes; only the notification is throttled.
 */

/** How long the same fault stays quiet after it has been emailed once. */
export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
	/** Which fault this is, so an escalation is never mistaken for a repeat. */
	signature: string;
	firstSeenAt: string;
	lastEmailedAt: string;
}

export type AlertReason =
	| 'new'             // fault we have not emailed about
	| 'changed'         // a different fault than the one on record — escalation
	| 'reminder'        // same fault, still broken a day later
	| 'recovered'       // was failing, now clear
	| 'cooldown'        // same fault, already emailed inside the last 24h
	| 'fallback_slot'   // store unreachable, and this is the one daily slot
	| 'fallback_quiet'  // store unreachable, not the daily slot
	| 'healthy';        // nothing wrong and nothing on record

export interface AlertDecision {
	email: boolean;
	reason: AlertReason;
	/** State to persist after a successful send. null means clear the record. */
	nextState: AlertState | null;
}

/**
 * A stable name for "what is wrong right now" — sorted, so key order can never
 * make one fault look like two. supabase going degraded -> down changes this
 * string, which is what stops an escalation being swallowed as a repeat.
 */
export function faultSignature(report: HealthReport): string {
	return Object.entries(report.services)
		.filter(([, s]) => s.status !== 'ok')
		.map(([name, s]) => `${name}:${s.status}`)
		.sort()
		.join('|');
}

/**
 * Pure decision. Takes the report, the clock and whatever was on record
 * (undefined means the store could not be read) and returns whether to email.
 * Kept free of I/O so the whole rule set can be exercised deterministically.
 */
export function decideAlert(
	report: HealthReport,
	now: Date,
	state: AlertState | null | undefined,
): AlertDecision {
	const signature = faultSignature(report);
	const healthy = report.status === 'ok';

	// Store unreachable — which is exactly what a Supabase outage looks like.
	if (state === undefined) {
		if (healthy) return { email: false, reason: 'healthy', nextState: null };
		const inSlot =
			now.getUTCHours() === FALLBACK_HOUR_UTC && now.getUTCMinutes() < FALLBACK_SLOT_MINUTES;
		return {
			email: inSlot,
			reason: inSlot ? 'fallback_slot' : 'fallback_quiet',
			nextState: null,
		};
	}

	if (healthy) {
		// Only worth an email if we told them it was broken in the first place.
		if (state) return { email: true, reason: 'recovered', nextState: null };
		return { email: false, reason: 'healthy', nextState: null };
	}

	const nowIso = now.toISOString();

	if (!state) {
		return {
			email: true,
			reason: 'new',
			nextState: { signature, firstSeenAt: nowIso, lastEmailedAt: nowIso },
		};
	}

	if (state.signature !== signature) {
		return {
			email: true,
			reason: 'changed',
			nextState: { signature, firstSeenAt: nowIso, lastEmailedAt: nowIso },
		};
	}

	const since = now.getTime() - Date.parse(state.lastEmailedAt);
	if (Number.isNaN(since) || since >= COOLDOWN_MS) {
		return {
			email: true,
			reason: 'reminder',
			nextState: { ...state, lastEmailedAt: nowIso },
		};
	}

	return { email: false, reason: 'cooldown', nextState: state };
}

