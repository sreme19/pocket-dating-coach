/**
 * aibestie-prune.ts — the reaper for landing-page traffic.
 *
 * Paid social buys clicks, and every click that turns into a conversation leaves a
 * provisional user, a match and a transcript behind forever. Nothing else in the
 * product creates rows for people who never signed up, so nothing else was ever
 * going to clean them up.
 *
 * TWO THINGS THIS DELETES, AND ONE IT NEVER DOES.
 *
 *   · a conversation nobody claimed, 30 days after he last spoke — the person, the
 *     match and the transcript;
 *   · a bounce, 30 days after the tap — one narrow session row, no identity.
 *
 * It never touches a CLAIMED session. That row's user_id was repointed at a REAL
 * member by claimLpSession, and deleting a verified_vibe_users row cascades their
 * matches and every message on them. Which is the trap this file is mostly written
 * to avoid — see below.
 *
 * ── THE BUG THIS IS SHAPED AROUND ──────────────────────────────────────────────
 * The natural way to write a reaper is "find old sessions, delete their user_id".
 * That deletes real members. After a claim, `aibestie_lp_sessions.user_id` IS the
 * member's real id (step 4 of claimLpSession), so an old claimed row points at
 * somebody's actual account, and the cascade would take their entire history with
 * it — silently, and with no way back.
 *
 * So candidates are resolved by `is_provisional = true`, ALWAYS, and the job
 * ABORTS rather than continues if any candidate fails that test. A magnitude
 * threshold ("stop if more than N") would not have caught this; the invariant does,
 * because a claimed row's user is not provisional and never will be.
 *
 * ── WHY THE SESSION ROW OUTLIVES THE PERSON ────────────────────────────────────
 * aibestie_lp_sessions.user_id is ON DELETE CASCADE, so deleting the man takes the
 * session row with him — and that row is the ad measurement: the utm set, the turn
 * count, the bar he reached, whether he tapped the CTA, when he first spoke. Losing
 * it would mean pruning the data that says whether the campaign worked.
 *
 * So the link is severed FIRST and the person deleted second. What remains is a
 * narrow anonymous funnel row: no name, no transcript, no id pointing at anyone.
 */

import { env } from '$env/dynamic/private';
import { getSupabase } from './supabase';
import { provisionalMembersEnabled } from './member-state';

/** Both windows. One number, because the two classes are the same decision. */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Rows touched per run. Not a safety measure — the invariant below is — but it
 * bounds a cron invocation so a large backlog drains over several nights instead
 * of timing out on the first one and never completing.
 */
const BATCH = 200;

export interface PruneReport {
	dryRun: boolean;
	retentionDays: number;
	/** Provisional people (and their matches + transcripts) removed. */
	conversationsPruned: number;
	/** Session rows for visitors who never spoke. */
	bouncesPruned: number;
	/** AI timing rows, which carry match_id with no foreign key to cascade on. */
	timingsPruned: number;
	/** Candidates that failed the provisional test — always zero, or we aborted. */
	aborted?: 'not_provisional' | 'disabled';
}

function retentionDays(): number {
	const n = Number.parseInt(`${env.AIBESTIE_PRUNE_DAYS ?? ''}`, 10);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
}

/**
 * Deletes only when explicitly armed.
 *
 * Default is a DRY RUN: it reports exactly what it would remove and removes
 * nothing. Arming is `AIBESTIE_PRUNE_DRY_RUN=false`, and setting it back to
 * anything else is the kill switch — no deploy needed either way. A job whose
 * failure mode is irreversible deletion should not be armed by being deployed.
 */
function isDryRun(): boolean {
	return env.AIBESTIE_PRUNE_DRY_RUN !== 'false';
}

export async function runAibestiePrune(): Promise<PruneReport> {
	const dryRun = isDryRun();
	const days = retentionDays();
	const report: PruneReport = {
		dryRun,
		retentionDays: days,
		conversationsPruned: 0,
		bouncesPruned: 0,
		timingsPruned: 0
	};

	// Same gate as every other read of these columns: PostgREST fails the whole
	// query on a filter against a column that does not exist.
	if (!provisionalMembersEnabled()) {
		report.aborted = 'disabled';
		return report;
	}

	const db = getSupabase() as any;
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	// ── 1. Conversations nobody claimed ──────────────────────────────────────────
	// Dated from materialized_at — when he FIRST SPOKE — not created_at. They are
	// usually minutes apart, but the row that matters is the one with a transcript
	// on it, and that clock should start when the transcript does.
	const { data: stale } = await db
		.from('aibestie_lp_sessions')
		.select('id, user_id, match_id')
		.is('claimed_at', null)
		.not('materialized_at', 'is', null)
		.not('user_id', 'is', null)
		.lt('materialized_at', cutoff)
		.limit(BATCH);

	const candidates = (stale ?? []) as Array<{ id: string; user_id: string; match_id: string | null }>;

	if (candidates.length > 0) {
		// THE INVARIANT. Every candidate must be provisional. Ask the users table
		// directly rather than trusting the session filter, because the failure this
		// guards against is precisely a session row whose user_id is a real member.
		const ids = candidates.map((c) => c.user_id);
		const { data: provisional } = await db
			.from('verified_vibe_users')
			.select('id')
			.in('id', ids)
			.eq('is_provisional', true);

		const safe = new Set((provisional ?? []).map((r: any) => r.id as string));

		// A candidate that is not provisional means the predicate above is wrong, and
		// the next thing this function would do is delete a real member and cascade
		// their history. Stop the whole run — including the harmless bounce sweep —
		// and say so loudly. Deleting "just the safe ones" would hide the fault.
		const rogue = ids.filter((id) => !safe.has(id));
		if (rogue.length > 0) {
			console.error(
				`[aibestie-prune] ABORT: ${rogue.length} candidate(s) are not provisional. ` +
					`Refusing to delete anything. First: ${rogue[0]}`
			);
			report.aborted = 'not_provisional';
			return report;
		}

		if (!dryRun) {
			for (const c of candidates) {
				try {
					// a. Timing rows first. vv_ai_response_timings.match_id is a bare uuid
					//    with no foreign key, so nothing cascades and they would orphan.
					if (c.match_id) {
						const { data: timings } = await db
							.from('vv_ai_response_timings')
							.delete()
							.eq('match_id', c.match_id)
							.select('id');
						report.timingsPruned += (timings ?? []).length;
					}

					// b. Sever the session from the person BEFORE deleting him, or the
					//    cascade takes the funnel row too. materialized_at stays, so the
					//    row still reads as "he spoke" and never looks like a bounce.
					await db
						.from('aibestie_lp_sessions')
						.update({ user_id: null, match_id: null })
						.eq('id', c.id);

					// c. Now the person. Cascades the match, the messages, his vectors and
					//    everything else keyed to him.
					await db.from('verified_vibe_users').delete().eq('id', c.user_id);
					report.conversationsPruned++;
				} catch (err) {
					// One bad row must not strand the rest of the batch, and the next run
					// picks it up again — the predicate is unchanged by a failure.
					console.error(`[aibestie-prune] failed on session ${c.id}:`, err);
				}
			}
		} else {
			report.conversationsPruned = candidates.length;
		}
	}

	// ── 2. Bounces ───────────────────────────────────────────────────────────────
	// Opened the page, never spoke: one narrow row, no identity, nothing to cascade.
	// Dated from created_at because that is the only timestamp such a row has.
	// claimed_at is still checked — a spent code from a bounce is a claim attempt,
	// and this job never deletes a row that says someone acted on it.
	if (dryRun) {
		const { count } = await db
			.from('aibestie_lp_sessions')
			.select('id', { count: 'exact', head: true })
			.is('claimed_at', null)
			.is('materialized_at', null)
			.lt('created_at', cutoff);
		report.bouncesPruned = count ?? 0;
	} else {
		const { data: bounced } = await db
			.from('aibestie_lp_sessions')
			.delete()
			.is('claimed_at', null)
			.is('materialized_at', null)
			.lt('created_at', cutoff)
			.select('id');
		report.bouncesPruned = (bounced ?? []).length;
	}

	console.log(
		`[aibestie-prune] ${dryRun ? 'DRY RUN — would remove' : 'removed'} ` +
			`${report.conversationsPruned} conversation(s), ${report.bouncesPruned} bounce(s), ` +
			`${report.timingsPruned} timing row(s); retention ${days}d`
	);
	return report;
}
