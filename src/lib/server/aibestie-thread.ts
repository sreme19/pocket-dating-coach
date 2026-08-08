/**
 * aibestie-thread.ts — reading and writing the landing-page conversation.
 *
 * This exists instead of pointing the page at /api/verified-vibe/chat/send, and
 * the reason is what that route does AROUND the message rather than what it does
 * with it:
 *
 *  · it writes a 'converted' row to vv_match_outcome_signals at exactly five
 *    messages. A 5-turn LP conversation crosses that every single time, so every
 *    ad visitor would log a fake converted match outcome into the table used to
 *    judge matching quality.
 *  · it runs captureMaleChatIntel on every message — a second Claude call per
 *    turn, doubling the cost of the campaign, and worse: it writes his chat
 *    claims into vv_user_vectors, which drops the REAL bar's corroboration stage
 *    to zero and makes the in-app bar compute 10% against the 20% he was shown
 *    here. Intel capture belongs at signup, once, over the whole transcript.
 *  · it pushes a notification to a device token a provisional user never has.
 *  · it authenticates a Supabase user, and until he signs up there isn't one.
 *
 * What it keeps is the part that matters: the same message table, the same
 * generateAndSendBestieReply, and therefore the same contact scrub, PII
 * compliance and hand-off rules. The safety-critical path is not forked.
 */

import { env } from '$env/dynamic/private';
import { getSupabase } from './supabase';
import { computeLpBar, isSubstantive, type LpBar } from './aibestie-bar';
import { terminusMode, type TerminusMode } from './aibestie-owner';
import { buildLpOpener } from './aibestie-opener';
import { hashToken, materializeSession } from './aibestie-session';
import type { BestieChecklist } from './bestie-checklist';

/**
 * His messages before the conversation closes on a sign-up.
 *
 * Env-overridable so the number can be tuned against real drop-off without a
 * deploy. Five is the decided default: enough for her Bestie to work two or three
 * checklist items, short enough that the campaign's Claude bill stays bounded.
 */
export function lpMaxTurns(): number {
	const n = Number.parseInt(env.AIBESTIE_LP_MAX_TURNS ?? '', 10);
	return Number.isFinite(n) && n > 0 && n <= 20 ? n : 5;
}

/** Same ceiling chat/send enforces, so nothing downstream sees a longer message. */
const MAX_MESSAGE_CHARS = 2000;

export interface LpThreadOwner {
	id: string;
	firstName: string;
	age: number | null;
	avatarUrl: string | null;
}

export interface LpThreadMessage {
	id: string;
	fromOwner: boolean;
	content: string;
	createdAt: string;
}

export interface LpThread {
	owner: LpThreadOwner;
	messages: LpThreadMessage[];
	bar: LpBar;
	turns: number;
	maxTurns: number;
	closed: boolean;
	terminus: TerminusMode;
	claimCode: string | null;
	awaitingReply: boolean;
}

export type ThreadError = 'no_session' | 'closed' | 'invalid' | 'error';

interface SessionRow {
	id: string;
	owner_id: string;
	user_id: string | null;
	match_id: string | null;
	turns: number | null;
	bar_percent: number | null;
	claim_code: string | null;
}

/** Resolve the opaque bearer token to its session. */
export async function sessionForToken(db: any, token: string): Promise<SessionRow | null> {
	if (!token) return null;
	const { data } = await db
		.from('aibestie_lp_sessions')
		.select('id, owner_id, user_id, match_id, turns, bar_percent, claim_code')
		.eq('token_hash', hashToken(token))
		.maybeSingle();
	return (data as SessionRow) ?? null;
}

async function loadOwner(db: any, ownerId: string): Promise<LpThreadOwner> {
	const { data } = await db
		.from('verified_vibe_users')
		.select('id, first_name, age, avatar_url')
		.eq('id', ownerId)
		.maybeSingle();
	return {
		id: ownerId,
		firstName: data?.first_name ?? '',
		age: typeof data?.age === 'number' ? data.age : null,
		avatarUrl: data?.avatar_url ?? null
	};
}

/**
 * The bar, recomputed from current state.
 *
 * Both inputs come from the database rather than the client: the checklist is
 * Bestie's own judgement of what he has genuinely answered, and the turn count is
 * the session row's. A client-supplied number would be a number he can set.
 */
async function computeBar(db: any, matchId: string | null, session: { turns?: number | null; bar_percent?: number | null }): Promise<LpBar> {
	let checklist: BestieChecklist | null = null;
	if (matchId) {
		const { data: match } = await db
			.from('verified_vibe_matches')
			.select('bestie_checklist')
			.eq('id', matchId)
			.maybeSingle();
		checklist = (match?.bestie_checklist ?? null) as BestieChecklist | null;
	}
	return computeLpBar({
		checklist,
		substantiveTurns: session.turns ?? 0,
		previousPercent: Number(session.bar_percent ?? 0)
	});
}

export async function loadLpThread(
	token: string
): Promise<{ ok: true; thread: LpThread } | { ok: false; reason: ThreadError }> {
	try {
		const db = getSupabase() as any;
		const session = await sessionForToken(db, token);
		if (!session) return { ok: false, reason: 'no_session' };

		const owner = await loadOwner(db, session.owner_id);
		const terminus = terminusMode(session.owner_id);
		const turns = session.turns ?? 0;

		// Not materialised: he has read her opener and not replied, so there is no
		// thread in the database yet. Serve the same opener the start call handed
		// him, built from the same function so what he is reading cannot drift from
		// what gets persisted the moment he speaks.
		if (!session.match_id) {
			return {
				ok: true,
				thread: {
					owner,
					messages: [
						{
							id: 'opener',
							fromOwner: true,
							content: buildLpOpener({ firstName: owner.firstName, terminus }),
							createdAt: new Date().toISOString()
						}
					],
					bar: await computeBar(db, null, session),
					turns,
					maxTurns: lpMaxTurns(),
					closed: false,
					terminus,
					claimCode: session.claim_code ?? null,
					awaitingReply: false
				}
			};
		}

		const [{ data: rows }, bar] = await Promise.all([
			db
				.from('verified_vibe_messages')
				.select('id, sender_id, content, created_at')
				// nullsFirst:false for the same reason bestie-responder uses it — a NULL
				// created_at sorts FIRST in Postgres and would pull an old message to the
				// top of the thread.
				.order('created_at', { ascending: true, nullsFirst: false })
				.eq('match_id', session.match_id),
			computeBar(db, session.match_id, session)
		]);

		const messages: LpThreadMessage[] = (rows ?? []).map((m: any) => ({
			id: m.id,
			fromOwner: m.sender_id === session.owner_id,
			content: m.content,
			createdAt: m.created_at
		}));

		return {
			ok: true,
			thread: {
				owner,
				messages,
				bar,
				turns,
				maxTurns: lpMaxTurns(),
				closed: turns >= lpMaxTurns(),
				terminus,
				claimCode: session.claim_code ?? null,
				// He is owed a reply whenever the last message is his. Derived rather
				// than stored so a generation that died mid-flight still shows as
				// pending and the page can offer a retry instead of hanging silently.
				awaitingReply: messages.length > 0 && !messages[messages.length - 1].fromOwner
			}
		};
	} catch (err) {
		console.error('[aibestie] loadLpThread threw:', err);
		return { ok: false, reason: 'error' };
	}
}

export interface SentMessage {
	messageId: string;
	bar: LpBar;
	turns: number;
	closed: boolean;
}

/**
 * Record his message, advance the bar, and hand the turn to her Bestie.
 *
 * This is where a visitor becomes rows. Everything before it — the gate, her
 * opener, however long he spent reading — costs one session row and no identity.
 *
 * The Bestie call is returned as a thunk rather than awaited: the caller decides
 * whether to run it in the background (Vercel waitUntil, so the page gets its
 * response immediately and polls) or inline. Generation measures ~9s, which is a
 * long time to hold a landing page's fetch open.
 */
export async function sendLpMessage(
	token: string,
	content: string
): Promise<
	| { ok: true; sent: SentMessage; generateReply: () => Promise<void> }
	| { ok: false; reason: ThreadError }
> {
	const trimmed = `${content ?? ''}`.trim();
	if (!trimmed || trimmed.length > MAX_MESSAGE_CHARS) return { ok: false, reason: 'invalid' };

	try {
		const db = getSupabase() as any;
		const session = await sessionForToken(db, token);
		if (!session) return { ok: false, reason: 'no_session' };

		// The cap is enforced HERE, against the session row, not against a message
		// count and never against anything the client sends.
		const maxTurns = lpMaxTurns();
		if ((session.turns ?? 0) >= maxTurns) return { ok: false, reason: 'closed' };

		const ids = await materializeSession(db, session);
		if (!ids) return { ok: false, reason: 'error' };

		const { data: saved, error: saveError } = await db
			.from('verified_vibe_messages')
			.insert({
				match_id: ids.matchId,
				sender_id: ids.userId,
				content: trimmed,
				created_at: new Date().toISOString()
			})
			.select('id, created_at')
			.single();
		if (saveError || !saved) {
			console.error('[aibestie] message insert failed:', saveError);
			return { ok: false, reason: 'error' };
		}

		// A turn is a message that says something. "k" costs him nothing and earns
		// nothing; the judgement of whether it truly answered her belongs to Bestie,
		// who marks the checklist item.
		const turns = (session.turns ?? 0) + (isSubstantive(trimmed) ? 1 : 0);
		const bar = await computeBar(db, ids.matchId, { ...session, turns });

		await db
			.from('aibestie_lp_sessions')
			.update({
				turns,
				bar_percent: bar.percent,
				last_active_at: new Date().toISOString(),
				...((session.turns ?? 0) === 0 ? { first_message_at: new Date().toISOString() } : {})
			})
			.eq('id', session.id);

		return {
			ok: true,
			sent: { messageId: saved.id, bar, turns, closed: turns >= maxTurns },
			generateReply: async () => {
				try {
					const { generateAndSendBestieReply } = await import('./bestie-responder');
					await generateAndSendBestieReply(
						session.owner_id,
						ids.matchId,
						saved.id,
						trimmed,
						saved.created_at
					);
				} catch (err) {
					// Never fatal to the send. The page derives awaitingReply from the
					// thread itself, so a failed generation surfaces as a still-pending
					// reply the visitor can retry rather than a silently dead chat.
					console.error('[aibestie] Bestie generation failed:', err);
				}
			}
		};
	} catch (err) {
		console.error('[aibestie] sendLpMessage threw:', err);
		return { ok: false, reason: 'error' };
	}
}
