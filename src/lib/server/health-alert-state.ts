import { getSupabase } from './supabase';
import { EMPTY_STATE, type AlertState } from './health-alert-policy';

/**
 * Persistence for the health-alert cron's memory. The rules live in
 * health-alert-policy.ts; this file only reads and writes the record.
 *
 * One marker row in verified_vibe_analytics, following the pattern
 * new-member-alert already uses — no migration. Every call is wrapped, so a
 * missing or unreachable table degrades to the clock fallback rather than
 * throwing, which this repo has been bitten by before.
 */

const SENTINEL_USER_ID = '00000000-0000-0000-0000-000000000000';
const STATE_EVENT = 'ops_health_alert_state';

export * from './health-alert-policy';

/**
 * Read the marker row. Returns null for "nothing on record" and undefined for
 * "could not ask" — the caller treats those very differently, so they must not
 * collapse into one value.
 */
export async function readAlertState(): Promise<AlertState | null | undefined> {
	try {
		const db = getSupabase() as any;
		const { data, error } = await db
			.from('verified_vibe_analytics')
			.select('metadata')
			.eq('event_type', STATE_EVENT)
			.order('created_at', { ascending: false })
			.limit(1);
		if (error) {
			console.warn('[health-alert] state unreadable, falling back to the daily slot:', error.message ?? error);
			return undefined;
		}
		const meta = (data ?? [])[0]?.metadata;
		if (!meta) return null;
		return {
			...EMPTY_STATE,
			// `signature` is the v1 field name: a record written before flap
			// damping existed meant "what we last reported".
			reportedSignature: String(meta.reportedSignature ?? meta.signature ?? ''),
			currentSignature: String(meta.currentSignature ?? ''),
			consecutiveFaults: Number(meta.consecutiveFaults ?? 0) || 0,
			firstSeenAt: String(meta.firstSeenAt ?? ''),
			lastEmailedAt: String(meta.lastEmailedAt ?? ''),
		};
	} catch (err: any) {
		console.warn('[health-alert] state unreadable, falling back to the daily slot:', err?.message ?? err);
		return undefined;
	}
}

/**
 * Replace the marker row. Returns whether the new record is definitely stored —
 * the caller must not send an email on `false`, because an email that was sent
 * but not recorded is exactly what repeats.
 *
 * Insert first, then remove the older rows. The reverse order has a window
 * where no record exists at all, and a run landing in it reads a continuing
 * fault as brand new. A failed cleanup only leaves a stale row behind, and the
 * read above takes the newest.
 */
export async function writeAlertState(next: AlertState): Promise<boolean> {
	try {
		const db = getSupabase() as any;
		const { data, error } = await db
			.from('verified_vibe_analytics')
			.insert({ user_id: SENTINEL_USER_ID, event_type: STATE_EVENT, metadata: next })
			.select('id')
			.single();

		if (error || !data?.id) {
			console.error('[health-alert] state NOT recorded — no email will be sent this run:', error?.message ?? error);
			return false;
		}

		const { error: delErr } = await db
			.from('verified_vibe_analytics')
			.delete()
			.eq('event_type', STATE_EVENT)
			.neq('id', data.id);
		if (delErr) {
			// Harmless: the newest row still wins on read.
			console.warn('[health-alert] could not tidy older state rows:', delErr.message ?? delErr);
		}
		return true;
	} catch (err: any) {
		console.error('[health-alert] state NOT recorded — no email will be sent this run:', err?.message ?? err);
		return false;
	}
}
