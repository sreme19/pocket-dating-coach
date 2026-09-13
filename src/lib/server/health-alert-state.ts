import { getSupabase } from './supabase';
import type { AlertState } from './health-alert-policy';

/**
 * Persistence for the health-alert cron's memory. The rules themselves live in
 * health-alert-policy.ts; this file only reads and writes the record.
 *
 * State lives in verified_vibe_analytics as a single marker row, following the
 * pattern new-member-alert already uses. That avoids a migration, and avoids the
 * failure mode this repo has hit before where a cron reads a table that was
 * never created and takes the route down with it — every call here is wrapped,
 * and an unreachable store degrades to the fallback rather than throwing.
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
		if (!meta?.signature || !meta?.lastEmailedAt) return null;
		return {
			signature: String(meta.signature),
			firstSeenAt: String(meta.firstSeenAt ?? meta.lastEmailedAt),
			lastEmailedAt: String(meta.lastEmailedAt),
		};
	} catch (err: any) {
		console.warn('[health-alert] state unreadable, falling back to the daily slot:', err?.message ?? err);
		return undefined;
	}
}

/**
 * Replace the marker row (or remove it, for `null`). Kept to exactly one row so
 * this can never grow into the analytics table.
 */
export async function writeAlertState(next: AlertState | null): Promise<boolean> {
	try {
		const db = getSupabase() as any;
		const { error: delErr } = await db
			.from('verified_vibe_analytics')
			.delete()
			.eq('event_type', STATE_EVENT);
		if (delErr) {
			console.error('[health-alert] could not clear old state:', delErr.message ?? delErr);
			return false;
		}
		if (next === null) return true;

		const { error } = await db.from('verified_vibe_analytics').insert({
			user_id: SENTINEL_USER_ID,
			event_type: STATE_EVENT,
			metadata: next,
		});
		if (error) {
			// Loud: a state write that keeps failing is how the email storm returns.
			console.error('[health-alert] could not record state — repeats may resume:', error.message ?? error);
			return false;
		}
		return true;
	} catch (err: any) {
		console.error('[health-alert] could not record state — repeats may resume:', err?.message ?? err);
		return false;
	}
}
