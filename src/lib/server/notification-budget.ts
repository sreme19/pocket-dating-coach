/**
 * Notification budget — quiet hours, per-type daily caps, and the delivery ledger.
 *
 * Until now every send site was unconditional apart from "does a device token
 * exist": no preferences, no quiet hours, no cap. (The settings endpoint at
 * /verified-vibe/api/notification-preferences returns hardcoded values and reads
 * no table.) That was survivable while only four events could actually push. It
 * stops being survivable the moment the advisor starts sending, so the budget
 * lands before the volume does.
 *
 * The rules, as approved:
 *  - proactive advisor insights: at most one per day, and never inside quiet hours
 *  - a result the user explicitly asked for: always delivered, uncapped
 *  - anything time-critical (a hand-off deadline) is likewise not silenced
 */

import { getSupabase } from '$lib/server/supabase';
import type { NotificationType } from '$lib/server/notifications';

type SB = ReturnType<typeof getSupabase>;

/** Fallbacks when a user has no notification_prefs row yet. */
const DEFAULT_QUIET_START = 22;
const DEFAULT_QUIET_END = 8;
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Types the user asked for, or cannot afford to miss. These bypass the cap and
 * quiet hours entirely — silencing them would be a bug, not politeness.
 *
 * `advisor_task_ready` is here on purpose: the user pressed a button and left the
 * screen precisely because we promised to tell them.
 */
const EXEMPT_TYPES: ReadonlySet<string> = new Set<NotificationType>([
	'advisor_task_ready',
	'handoff_nudge',
	'conversation_reminder',
	'secret_admirer',
	'craving_attention'
]);

/** Per-type daily ceilings. Absent = uncapped (subject to EXEMPT_TYPES above). */
const DAILY_CAP: Partial<Record<NotificationType, number>> = {
	advisor_insight: 1,
	intelligence_report: 1,
	profile_tip: 3,
	new_match: 5
};

export interface BudgetDecision {
	allowed: boolean;
	/** Machine-readable reason, for logs and for the admin view. */
	reason: 'ok' | 'exempt' | 'quiet_hours' | 'daily_cap' | 'opted_out';
}

interface Prefs {
	advisorPush: boolean;
	quietStart: number;
	quietEnd: number;
	timezone: string;
}

async function loadPrefs(sb: SB, userId: string): Promise<Prefs> {
	try {
		const { data } = await (sb as SBAny)
			.from('notification_prefs')
			.select('advisor_push, quiet_start, quiet_end, timezone')
			.eq('user_id', userId)
			.maybeSingle();

		const row = data as {
			advisor_push?: boolean;
			quiet_start?: number;
			quiet_end?: number;
			timezone?: string;
		} | null;

		return {
			advisorPush: row?.advisor_push ?? true,
			quietStart: row?.quiet_start ?? DEFAULT_QUIET_START,
			quietEnd: row?.quiet_end ?? DEFAULT_QUIET_END,
			timezone: row?.timezone ?? DEFAULT_TIMEZONE
		};
	} catch {
		// Table not migrated yet, or a transient failure: fall back to defaults
		// rather than blocking delivery on the budget layer being healthy.
		return {
			advisorPush: true,
			quietStart: DEFAULT_QUIET_START,
			quietEnd: DEFAULT_QUIET_END,
			timezone: DEFAULT_TIMEZONE
		};
	}
}

/**
 * The hour of day (0-23) for `now` in the given IANA zone.
 *
 * Uses Intl rather than a UTC offset because quiet hours have to mean 10pm where
 * the member actually is — the base spans India and Indonesia.
 */
export function hourInZone(now: Date, timezone: string): number {
	try {
		const formatted = new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			hour: 'numeric',
			hour12: false
		}).format(now);
		const hour = Number.parseInt(formatted, 10);
		return Number.isFinite(hour) ? hour % 24 : now.getUTCHours();
	} catch {
		// An unrecognised zone must not silence notifications.
		return now.getUTCHours();
	}
}

/**
 * Whether `hour` falls inside the quiet window.
 *
 * The window normally wraps midnight (22 → 8), so a naive `start <= h && h < end`
 * comparison would invert it and silence the entire working day.
 */
export function isQuietHour(hour: number, quietStart: number, quietEnd: number): boolean {
	if (quietStart === quietEnd) return false; // zero-length window = never quiet
	if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
	return hour >= quietStart || hour < quietEnd; // wraps midnight
}

async function countSentToday(sb: SB, userId: string, type: string): Promise<number> {
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	try {
		const { count } = await (sb as SBAny)
			.from('notification_log')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', userId)
			.eq('type', type)
			.gte('sent_at', since);
		return count ?? 0;
	} catch {
		// No ledger means no evidence to cap on; allow rather than block.
		return 0;
	}
}

/**
 * Should this notification go out right now?
 *
 * Every failure mode here errs toward delivering. A broken budget layer that
 * silently swallows notifications is worse than one that occasionally lets an
 * extra one through — the whole point of this work is that people are currently
 * not being told things.
 */
export async function checkBudget(
	sb: SB,
	userId: string,
	type: NotificationType
): Promise<BudgetDecision> {
	if (EXEMPT_TYPES.has(type)) return { allowed: true, reason: 'exempt' };

	const prefs = await loadPrefs(sb, userId);

	// The opt-out covers proactive coaching only.
	if (type === 'advisor_insight' && !prefs.advisorPush) {
		return { allowed: false, reason: 'opted_out' };
	}

	const hour = hourInZone(new Date(), prefs.timezone);
	if (isQuietHour(hour, prefs.quietStart, prefs.quietEnd)) {
		return { allowed: false, reason: 'quiet_hours' };
	}

	const cap = DAILY_CAP[type];
	if (cap !== undefined && (await countSentToday(sb, userId, type)) >= cap) {
		return { allowed: false, reason: 'daily_cap' };
	}

	return { allowed: true, reason: 'ok' };
}

/**
 * Record a delivery. This is what the cap counts, so only call it for a send that
 * actually left the building — logging an attempt would let one failed push
 * consume a user's whole daily allowance.
 */
export async function logNotification(
	sb: SB,
	userId: string,
	type: NotificationType,
	opts: { channel?: 'push' | 'email'; title?: string } = {}
): Promise<void> {
	try {
		await (sb as SBAny).from('notification_log').insert({
			user_id: userId,
			type,
			channel: opts.channel ?? 'push',
			title: opts.title ?? null
		});
	} catch (e) {
		console.warn('[notification-budget] ledger write failed (non-fatal):', e);
	}
}

/** Generated DB types lag these tables; narrowed to this module. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SBAny = any;
