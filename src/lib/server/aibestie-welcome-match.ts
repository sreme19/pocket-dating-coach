/**
 * aibestie-welcome-match.ts — requirement 9: the man who came from the advert
 * gets more matches without asking for them.
 *
 * WHY THIS DOES NOT LIVE AT SIGNUP, which is where it was first put.
 * runMatchmakerForUser returns 'needs_verification' for anyone without an ACTIVE
 * pool entry, and a man who just installed the app off the landing page has no
 * liveness and no photos. Fired at claim time it is a guaranteed no-op that looks
 * like it ran. The moment that actually means "he can be matched now" is
 * enrollInPoolIfVerified, so that is where this hangs — beside the beta-invite
 * redeem and the referral reward, which are there for the same reason.
 *
 * The runs are SYSTEM runs. He never pressed anything, so they must not charge
 * his quota or be refused when his quota is spent — the same exemption the
 * hand-off-timeout replacement uses.
 *
 * SEQUENTIAL, NOT PARALLEL. Each run re-reads his existing matches to exclude
 * women he already has. Firing them concurrently would let two runs pick the same
 * woman, and the second would collide on the guard in runMatchmakerForUser and
 * silently produce one match instead of two.
 */

import { env } from '$env/dynamic/private';
import { getSupabase } from './supabase';
import { provisionalMembersEnabled } from './member-state';

/** How many matches to hand him. Two is enough to make the app feel populated
 *  without spending ON_DEMAND_CANDIDATE_CAP Claude calls per extra match. */
const DEFAULT_WELCOME_MATCHES = 2;
const MAX_WELCOME_MATCHES = 5;

export interface WelcomeMatchOutcome {
	/** Did a claimed landing-page conversation exist for this member? */
	eligible: boolean;
	/** Matches actually created. */
	created: number;
	/** Why it stopped, when it stopped early. */
	stoppedBecause?: 'no_match' | 'needs_verification' | 'limit_reached' | 'complete';
}

function welcomeMatchCount(raw: string | undefined): number {
	const n = Number.parseInt(`${raw ?? ''}`, 10);
	if (!Number.isFinite(n)) return DEFAULT_WELCOME_MATCHES;
	return Math.max(0, Math.min(MAX_WELCOME_MATCHES, n));
}

/**
 * Give a man who claimed a landing-page conversation his first few matches.
 *
 * No-op unless he actually claimed one — this is not a general "welcome every new
 * member" hook, and turning it into one would be a product decision about every
 * signup rather than about ad traffic.
 *
 * Idempotent by `welcome_matched_at`, which is stamped BEFORE the runs rather than
 * after. That ordering is deliberate and it trades one failure for another: a run
 * that crashes half-way is never retried, but two enrolments racing — or one
 * retried by a caller — cannot spend a second round of Claude calls and hand him
 * duplicate matches. The stamp is a claim on the work, not a record of success.
 */
export async function runWelcomeMatchesIfClaimed(userId: string): Promise<WelcomeMatchOutcome> {
	// The whole feature is behind one flag, and this reads a column added by
	// 20260808100000. PostgREST fails the entire query on a filter against a column
	// that does not exist, so the name must not appear until the migration has run.
	if (!provisionalMembersEnabled()) return { eligible: false, created: 0 };

	const target = welcomeMatchCount(env.AIBESTIE_WELCOME_MATCHES);
	if (target === 0) return { eligible: false, created: 0 };

	const db = getSupabase() as any;

	// A SUCCESSFUL claim only. `claimed_by_user_id` is also stamped when he typed a
	// code for a conversation that never existed ('nothing_to_claim'), and that man
	// bounced off the page without speaking — requiring match_id is what separates
	// "had a conversation with her Bestie" from "spent a code".
	const { data: session } = await db
		.from('aibestie_lp_sessions')
		.select('id, match_id, welcome_matched_at')
		.eq('claimed_by_user_id', userId)
		.not('match_id', 'is', null)
		.is('welcome_matched_at', null)
		.limit(1)
		.maybeSingle();
	if (!session) return { eligible: false, created: 0 };

	// Compare-and-set. Two enrolments can land at once — verify-step and the photo
	// rescreen both call enrollInPoolIfVerified — so the winner is whoever's UPDATE
	// still sees a null, not whoever read first.
	const { data: claimed } = await db
		.from('aibestie_lp_sessions')
		.update({ welcome_matched_at: new Date().toISOString() })
		.eq('id', session.id)
		.is('welcome_matched_at', null)
		.select('id');
	if (!claimed || claimed.length === 0) return { eligible: false, created: 0 };

	const { runMatchmakerForUser } = await import('./matchmaker-service');

	let created = 0;
	let stoppedBecause: WelcomeMatchOutcome['stoppedBecause'] = 'complete';
	for (let i = 0; i < target; i++) {
		const result = await runMatchmakerForUser(userId, { system: true });
		if (result.status !== 'matched') {
			// An empty or exhausted pool will not fill on the next iteration, and each
			// attempt costs a soft-score call per candidate. Stop rather than grind.
			stoppedBecause = result.status;
			break;
		}
		created++;
	}

	console.log(
		`[aibestie] welcome matches for ${userId}: ${created}/${target} (${stoppedBecause})`
	);
	return { eligible: true, created, stoppedBecause };
}
