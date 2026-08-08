/**
 * aibestie-session.ts — an ad visitor, written lazily.
 *
 * TWO THINGS THIS FILE IS CAREFUL ABOUT.
 *
 * 1. NOTHING IS WRITTEN UNTIL HE SPEAKS. Opening the page costs one narrow
 *    session row. The profile, the match and the messages appear on his FIRST
 *    MESSAGE and not before, because most paid traffic bounces at the gate or
 *    after reading one line, and the first cut was permanently recording all of
 *    it.
 *
 *    It cannot be lazier than that. generateBestieReply reads the pair, the last
 *    twelve messages, her weights, his vectors, the proof signals and the ledger
 *    — all by id, all from the normal tables. She cannot answer someone who does
 *    not exist. Deferring to signup would mean a stateless fork of the most
 *    safety-critical prompt path in the product (contact scrub, PII compliance,
 *    the hand-off rules), and two copies of a safety rule drift apart.
 *
 * 2. NO AUTH USER UNTIL SIGNUP. The visitor carries an opaque token rather than a
 *    Supabase JWT, which works because /api/aibestie/* is the only thing he ever
 *    calls. Previously every click minted an auth user on a placeholder @lp.vv
 *    address, so the identity table filled with fake addresses belonging to people
 *    who never engaged. It also removes the email-collision problem entirely: at
 *    signup he registers normally and the thread is RE-POINTED at his real id,
 *    instead of us trying to convert a placeholder address into one he may
 *    already own.
 *
 * Both are possible only because verified_vibe_users.id has no foreign key to
 * auth.users — verified against the live database, not assumed from the schema
 * file.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getSupabase } from './supabase';
import { lpConfigured, pickOwner, terminusMode, type TerminusMode } from './aibestie-owner';
import { provisionalMembersEnabled } from './member-state';
import { buildLpOpener } from './aibestie-opener';

/** Match rows created here, so Bestie's opener can know how he arrived. */
export const LP_MATCH_SOURCE = 'aibestie_lp';

/** Sessions one origin may create per window before it is treated as a bot. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Claim-code alphabet. No 0/O/1/I/L — the code is read off a screen and typed
 * into a phone, and a transcription error means a lost conversation.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateClaimCode(): string {
	let out = '';
	for (let i = 0; i < 6; i++) {
		out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
	}
	return `RA-${out}`;
}

/** Opaque bearer token. Only the hash is stored. */
function issueToken(): { token: string; hash: string } {
	const token = randomBytes(32).toString('base64url');
	return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Salted hash of the client IP.
 *
 * Unsalted, a SHA-256 of an IPv4 address is reversible by brute force in seconds
 * — the whole space is 2^32 — so the salt is what makes this a one-way value
 * rather than an obfuscated address. An unset salt still hashes (rate limiting
 * keeps working) but is logged as a weakness rather than silently accepted.
 */
export function hashIp(ip: string | null): string | null {
	if (!ip) return null;
	const salt = env.AIBESTIE_IP_SALT;
	if (!salt) {
		console.warn('[aibestie] AIBESTIE_IP_SALT unset — ip_hash is brute-forceable');
	}
	return createHash('sha256').update(`${salt ?? ''}:${ip}`).digest('hex');
}

export type StartFailure = 'disabled' | 'rate_limited' | 'owner_invalid' | 'error';

export interface StartedSession {
	sessionId: string;
	/** Opaque bearer token for /api/aibestie/*. Not a Supabase JWT. */
	token: string;
	ownerId: string;
	claimCode: string;
	/** Display data + her opening line, so the page paints with no further calls. */
	owner: { firstName: string; age: number | null; avatarUrl: string | null };
	opener: string;
}

export interface StartOptions {
	ip?: string | null;
	userAgent?: string | null;
	utm?: Record<string, string> | null;
}

/**
 * Is the landing page servable at all?
 *
 * The provisional gate is part of the answer, not a separate concern: without it
 * realMembersOnly cannot exclude anyone, so every visitor who spoke would be
 * counted as a real member — corrupting the trust cohort and emailing the team on
 * every conversation. Refusing to start is the correct failure.
 */
export function lpEnabled(): boolean {
	return provisionalMembersEnabled() && lpConfigured();
}

/** Everything the gate needs to describe her before any session exists. */
export interface GateState {
	enabled: boolean;
	terminus: TerminusMode;
	owner: { firstName: string; avatarUrl: string | null } | null;
}

/**
 * Who the page is about to introduce, and what it is allowed to claim about her.
 *
 * ONE function for two callers — the server-side page load and the GET readiness
 * probe — and that is the point rather than tidiness. The gate makes a claim about
 * a person before a session exists, so it cannot read `thread.terminus` and has to
 * ask. Two surfaces asking the same question through two code paths is how one of
 * them ends up answering differently, which is the exact failure terminusMode()
 * exists to prevent.
 *
 * Her name and photo are not sensitive here: the page renders her whole profile on
 * a photo tap, and the advert that brought him already showed her.
 */
export async function readGateState(): Promise<GateState> {
	const ownerId = pickOwner();
	if (!ownerId) return { enabled: false, terminus: 'artifact', owner: null };

	let owner: GateState['owner'] = null;
	try {
		const { data } = await (getSupabase() as any)
			.from('verified_vibe_users')
			.select('first_name, avatar_url')
			.eq('id', ownerId)
			.maybeSingle();
		if (data) owner = { firstName: data.first_name ?? '', avatarUrl: data.avatar_url ?? null };
	} catch {
		// Degrade to the nameless copy rather than failing to render. A landing page
		// that 500s on a database blip costs the whole click.
	}

	return { enabled: lpEnabled(), terminus: terminusMode(ownerId), owner };
}

async function recentSessionCount(db: any, ipHash: string | null): Promise<number> {
	if (!ipHash) return 0;
	const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
	const { count } = await db
		.from('aibestie_lp_sessions')
		.select('id', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.gte('created_at', since);
	return count ?? 0;
}

/**
 * Open a landing-page session.
 *
 * Writes exactly ONE row and creates no identity. The owner is still validated
 * first — a deleted or male owner produces a pair resolveProxyPair refuses to
 * speak in, which renders as a page where nobody ever replies, and it is better
 * to find that out before serving anyone than once per click of a live campaign.
 */
export async function startLpSession(
	opts: StartOptions = {}
): Promise<{ ok: true; session: StartedSession } | { ok: false; reason: StartFailure }> {
	if (!lpEnabled()) return { ok: false, reason: 'disabled' };

	const db = getSupabase() as any;
	const ipHash = hashIp(opts.ip ?? null);

	try {
		if ((await recentSessionCount(db, ipHash)) >= RATE_LIMIT_MAX) {
			return { ok: false, reason: 'rate_limited' };
		}

		const ownerId = pickOwner();
		if (!ownerId) return { ok: false, reason: 'disabled' };

		const { data: owner } = await db
			.from('verified_vibe_users')
			.select('id, gender, deleted_at, first_name, age, avatar_url')
			.eq('id', ownerId)
			.maybeSingle();
		if (!owner || owner.deleted_at || owner.gender !== 'woman') {
			console.error('[aibestie] configured owner is unusable:', ownerId);
			return { ok: false, reason: 'owner_invalid' };
		}

		const { token, hash } = issueToken();
		const claimCode = generateClaimCode();

		const { data: row, error } = await db
			.from('aibestie_lp_sessions')
			.insert({
				owner_id: ownerId,
				token_hash: hash,
				ip_hash: ipHash,
				user_agent: (opts.userAgent ?? '').slice(0, 400) || null,
				claim_code: claimCode,
				utm: opts.utm ?? null
			})
			.select('id')
			.single();
		if (error || !row) {
			console.error('[aibestie] session insert failed:', error);
			return { ok: false, reason: 'error' };
		}

		return {
			ok: true,
			session: {
				sessionId: row.id,
				token,
				ownerId,
				claimCode,
				owner: {
					firstName: owner.first_name ?? '',
					age: typeof owner.age === 'number' ? owner.age : null,
					avatarUrl: owner.avatar_url ?? null
				},
				// Rendered client-side until he speaks. It is only PERSISTED when the
				// thread is materialised, so a visitor who reads it and leaves writes
				// nothing — and it is built from the same function either way, so what
				// he read and what lands in the thread cannot differ.
				opener: buildLpOpener({
					firstName: owner.first_name ?? '',
					terminus: terminusMode(ownerId)
				})
			}
		};
	} catch (err) {
		console.error('[aibestie] startLpSession threw:', err);
		return { ok: false, reason: 'error' };
	}
}

/**
 * Turn a session that has only been READ into one that exists.
 *
 * Called on his first message and nowhere else. Idempotent by the session's own
 * user_id: two messages sent in the same instant must not create two people.
 *
 * Returns the ids the caller needs to write his message into the thread.
 */
export async function materializeSession(
	db: any,
	session: { id: string; owner_id: string; user_id: string | null; match_id: string | null }
): Promise<{ userId: string; matchId: string } | null> {
	if (session.user_id && session.match_id) {
		return { userId: session.user_id, matchId: session.match_id };
	}

	try {
		const { data: owner } = await db
			.from('verified_vibe_users')
			.select('first_name')
			.eq('id', session.owner_id)
			.maybeSingle();

		// The profile. NO auth user — see the header. archetype/age/city are NOT
		// NULL but genuinely unknown, so they are seeded EMPTY rather than guessed:
		// an empty archetype makes getProfileCompleteness return 'no_archetype' and
		// routes him to choose one after signup, whereas a plausible guess would
		// stand in as his answer forever and feed the matcher a preference he never
		// expressed.
		const userId = randomUUID();
		const { error: profileError } = await db.from('verified_vibe_users').insert({
			id: userId,
			gender: 'man',
			archetype: '',
			first_name: '',
			age: 18,
			city: '',
			is_seed: false,
			is_provisional: true,
			discovery_mode: 'date',
			last_active_at: new Date().toISOString()
		});
		if (profileError) {
			console.error('[aibestie] profile insert failed:', profileError);
			return null;
		}

		const { data: match, error: matchError } = await db
			.from('verified_vibe_matches')
			.insert({
				user1_id: session.owner_id,
				user2_id: userId,
				status: 'mutual',
				source: LP_MATCH_SOURCE,
				ai_bestie_active: true,
				created_at: new Date().toISOString()
			})
			.select('id')
			.single();
		if (matchError || !match?.id) {
			console.error('[aibestie] match insert failed:', matchError);
			await db.from('verified_vibe_users').delete().eq('id', userId);
			return null;
		}

		// Her opener is persisted NOW, backdated a second, so it precedes his first
		// message in the thread. He has already read it — it was rendered from the
		// same builder at page load — this is the copy the responder will see.
		await db.from('verified_vibe_messages').insert({
			match_id: match.id,
			sender_id: session.owner_id,
			content: buildLpOpener({
				firstName: (owner as any)?.first_name ?? '',
				terminus: terminusMode(session.owner_id)
			}),
			is_ai: true,
			created_at: new Date(Date.now() - 1000).toISOString()
		});

		// Guarded on user_id still being null so two concurrent first messages
		// cannot both claim the session. The loser's rows are cleaned up below.
		const { data: won } = await db
			.from('aibestie_lp_sessions')
			.update({
				user_id: userId,
				match_id: match.id,
				materialized_at: new Date().toISOString()
			})
			.eq('id', session.id)
			.is('user_id', null)
			.select('user_id, match_id')
			.maybeSingle();

		if (!won) {
			// Someone else got there first. Discard ours and use theirs.
			await db.from('verified_vibe_messages').delete().eq('match_id', match.id);
			await db.from('verified_vibe_matches').delete().eq('id', match.id);
			await db.from('verified_vibe_users').delete().eq('id', userId);
			const { data: current } = await db
				.from('aibestie_lp_sessions')
				.select('user_id, match_id')
				.eq('id', session.id)
				.maybeSingle();
			return current?.user_id && current?.match_id
				? { userId: current.user_id, matchId: current.match_id }
				: null;
		}

		return { userId, matchId: match.id };
	} catch (err) {
		console.error('[aibestie] materializeSession threw:', err);
		return null;
	}
}
