/**
 * aibestie-claim.ts — reuniting a new member with the conversation he already had.
 *
 * He talked to her Bestie on the landing page as a provisional visitor with no
 * identity, installed the app, and signed up properly. This is the step that makes
 * those the same person.
 *
 * IT MOVES THE THREAD, IT DOES NOT MOVE HIM. The obvious design — convert his
 * placeholder account into a real one — dies on the case where he signs up with an
 * email he already has an account for. So the provisional row is discarded and the
 * MATCH and MESSAGES are re-pointed at whoever he actually signed up as. That works
 * whether he is brand new or returning, and it never touches the identity table.
 *
 * ORDER IS LOAD-BEARING, and not for tidiness. Verified against the live database:
 * deleting a verified_vibe_users row CASCADE-DELETES both the match and every
 * message on it. So the provisional user must be the last thing to go, after
 * everything pointing at it has been moved. Deleting first — the natural way to
 * write this — would silently destroy the exact conversation the feature exists to
 * preserve, and it would look like it worked.
 */

import { getSupabase } from './supabase';
import { LP_BAR_MAX } from './aibestie-bar';

export type ClaimFailure =
	| 'not_found'      // no session carries this code
	| 'already_claimed'
	| 'nothing_to_claim' // he opened the page but never spoke — no thread exists
	| 'wrong_gender'   // the thread is the man's side; a woman cannot inherit it
	| 'conflict'       // he already has a thread with this owner
	| 'error';

export interface ClaimResult {
	matchId: string;
	ownerId: string;
	/** Messages moved onto his real identity. */
	messagesMoved: number;
	/** The LP bar value carried into the app as a floor. */
	barPercent: number;
}

/** Codes are shown uppercase and typed by hand; accept whatever shape he types. */
export function normalizeClaimCode(raw: string): string {
	return `${raw ?? ''}`.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Hand a landing-page conversation to the account he just created.
 *
 * Idempotent by `claimed_at`: a second attempt with the same code is refused
 * rather than re-running, because the install referrer and the visible code are
 * two routes to the same claim and both may fire.
 */
export async function claimLpSession(
	claimCode: string,
	realUserId: string
): Promise<{ ok: true; result: ClaimResult } | { ok: false; reason: ClaimFailure }> {
	const code = normalizeClaimCode(claimCode);
	if (!code) return { ok: false, reason: 'not_found' };

	try {
		const db = getSupabase() as any;

		const { data: session } = await db
			.from('aibestie_lp_sessions')
			.select('id, user_id, owner_id, match_id, bar_percent, claimed_at')
			.eq('claim_code', code)
			.maybeSingle();
		if (!session) return { ok: false, reason: 'not_found' };
		if (session.claimed_at) return { ok: false, reason: 'already_claimed' };
		if (!session.match_id || !session.user_id) {
			// He read her opener and left. There is no thread to hand over, but the
			// code is spent so a stale one cannot be tried forever.
			await db
				.from('aibestie_lp_sessions')
				.update({ claimed_at: new Date().toISOString(), claimed_by_user_id: realUserId })
				.eq('id', session.id);
			return { ok: false, reason: 'nothing_to_claim' };
		}

		// The thread is the man's side of a woman→man proxy. Handing it to a woman
		// would produce a pair resolveProxyPair refuses to speak in — a thread that
		// exists and is permanently silent.
		const { data: claimer } = await db
			.from('verified_vibe_users')
			.select('id, gender')
			.eq('id', realUserId)
			.maybeSingle();
		if (!claimer || claimer.gender !== 'man') return { ok: false, reason: 'wrong_gender' };

		// He may already be matched with her through the app. Merging two threads
		// between the same pair is a product decision, not a data fix, so this stops
		// and says so rather than guessing.
		const { data: existing } = await db
			.from('verified_vibe_matches')
			.select('id')
			.or(
				`and(user1_id.eq.${session.owner_id},user2_id.eq.${realUserId}),and(user1_id.eq.${realUserId},user2_id.eq.${session.owner_id})`
			)
			.neq('id', session.match_id)
			.limit(1);
		if (existing && existing.length > 0) return { ok: false, reason: 'conflict' };

		// ── The re-point, in the only safe order. ────────────────────────────────
		// 1. His messages.
		const { data: moved } = await db
			.from('verified_vibe_messages')
			.update({ sender_id: realUserId })
			.eq('match_id', session.match_id)
			.eq('sender_id', session.user_id)
			.select('id');

		// 2. The match itself.
		await db
			.from('verified_vibe_matches')
			.update({ user2_id: realUserId })
			.eq('id', session.match_id);

		// 3. The bar floor. He was shown a number on the landing page; the in-app bar
		//    is monotonic by design, so writing it here means the app can only ever
		//    show him MORE. Clamped to the LP ceiling so a corrupt row cannot hand him
		//    a percentage he never earned.
		const barPercent = Math.min(LP_BAR_MAX, Number(session.bar_percent ?? 0));
		try {
			await db
				.from('verified_vibe_matches')
				.update({ gap_bar_percent: barPercent })
				.eq('id', session.match_id)
				.or(`gap_bar_percent.is.null,gap_bar_percent.lte.${barPercent}`);
		} catch {
			// Column may not exist if GAP_BAR_GATE was never migrated. The thread still
			// transfers; he just starts from the app's own computation.
		}

		// 4. The session row — BEFORE the delete. It has an ON DELETE CASCADE on
		//    user_id, so removing the provisional user while this still points at it
		//    would take the claim record with it.
		await db
			.from('aibestie_lp_sessions')
			.update({
				user_id: realUserId,
				claimed_by_user_id: realUserId,
				claimed_at: new Date().toISOString()
			})
			.eq('id', session.id);

		// 5. Only now is the provisional row safe to remove.
		await db.from('verified_vibe_users').delete().eq('id', session.user_id);

		return {
			ok: true,
			result: {
				matchId: session.match_id,
				ownerId: session.owner_id,
				messagesMoved: (moved ?? []).length,
				barPercent
			}
		};
	} catch (err) {
		console.error('[aibestie] claimLpSession threw:', err);
		return { ok: false, reason: 'error' };
	}
}

/**
 * Fold everything he said on the landing page into his profile vectors — ONCE,
 * over the whole transcript, after the claim.
 *
 * captureMaleChatIntel is deliberately not run per-message during the landing-page
 * conversation: it is a second Claude call per turn, and it writes his claims into
 * vv_user_vectors, which drops the real bar's corroboration stage to zero and would
 * make the app compute a LOWER number than the one he was just shown. Running it
 * here instead costs one call rather than five, and happens after the floor in step
 * 3 is already written.
 *
 * Fire-and-forget: it enriches his profile, it does not gate the claim.
 */
export async function foldTranscriptIntoProfile(matchId: string, userId: string): Promise<void> {
	try {
		const db = getSupabase() as any;
		const { data: rows } = await db
			.from('verified_vibe_messages')
			.select('content')
			.eq('match_id', matchId)
			.eq('sender_id', userId)
			.order('created_at', { ascending: true, nullsFirst: false });

		const transcript = (rows ?? [])
			.map((r: any) => `${r.content}`.trim())
			.filter(Boolean)
			.join('\n');
		if (!transcript) return;

		const { captureMaleChatIntel } = await import('./chat-intel-capture');
		await captureMaleChatIntel(userId, transcript);
	} catch (err) {
		console.error('[aibestie] foldTranscriptIntoProfile failed (non-critical):', err);
	}
}
