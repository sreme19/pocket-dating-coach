/**
 * aibestie-session.ts — minting an ad visitor.
 *
 * THE DESIGN IN ONE LINE: the visitor gets a REAL user, a REAL match and a REAL
 * session, so nothing downstream needs to know he arrived from an ad.
 *
 * The alternative was sandbox tables plus a stateless Bestie. It looks cheaper
 * until you price it: generateBestieReply reads the pair, the last twelve
 * messages, her weights, his vectors, the proof signals and the ledger — all by
 * id, all from the normal tables. A stateless variant is a second implementation
 * of the most safety-critical prompt path in the product (contact scrub, PII
 * compliance, the hand-off rules), and two copies of a safety rule drift. Reusing
 * the real path costs exactly one boolean column (see member-state.ts) and buys
 * requirement 8 — the conversation continuing in the app — almost for free,
 * because the account he signs up with is the account he was already using.
 *
 * The login mechanism is lifted wholesale from the seed-login endpoint: the admin
 * API generates a magic link, which hands back a raw OTP, and the CLIENT verifies
 * it to obtain a session. No email is sent and no password exists. That path is
 * already proven in production here, which is why this does not invent one.
 */

import { createHash, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getSupabase } from './supabase';
import { lpConfigured, pickOwner, terminusMode } from './aibestie-owner';
import { provisionalMembersEnabled } from './member-state';
import { buildLpOpener } from './aibestie-opener';

/**
 * Placeholder address for a visitor who has not given us one. Mirrors the
 * @seed.vv convention so an operator reading the auth table can tell instantly
 * what a row is. Never receives mail — the account is converted to his real
 * address at signup, keeping the same user id.
 */
const LP_EMAIL_DOMAIN = 'lp.vv';

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

export type StartFailure =
	| 'disabled'        // gate off, or no roster configured
	| 'rate_limited'    // this origin has started too many sessions
	| 'owner_invalid'   // configured owner is missing, deleted, or not a woman
	| 'error';

export interface StartedSession {
	sessionId: string;
	userId: string;
	ownerId: string;
	matchId: string;
	claimCode: string;
	/** Credentials the browser exchanges for a session via supabase.auth.verifyOtp. */
	email: string;
	otp: string;
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
 * every visitor would be counted as a real member the moment they loaded the
 * page, so serving traffic before the flag is on would corrupt the trust cohort
 * and email the team on every click. Refusing to start is the correct failure.
 */
export function lpEnabled(): boolean {
	return provisionalMembersEnabled() && lpConfigured();
}

/** How many sessions this origin has started inside the window. */
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
 * Create a provisional visitor, their thread, and the credentials to log in as
 * them.
 *
 * Ordering matters and is not arbitrary: the owner is validated BEFORE anything
 * is written. A misconfigured owner id — deleted, or male — produces a pair that
 * resolveProxyPair refuses to speak in, which renders as a landing page where
 * nobody ever replies. Failing before the first insert keeps that from becoming
 * an orphaned user row for every click of a broken campaign.
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
			.select('id, gender, deleted_at, first_name, looking')
			.eq('id', ownerId)
			.maybeSingle();
		if (!owner || owner.deleted_at || owner.gender !== 'woman') {
			console.error('[aibestie] configured owner is unusable:', ownerId);
			return { ok: false, reason: 'owner_invalid' };
		}

		// 1. Auth user. email_confirm skips the verification mail — there is no
		//    inbox behind this address, and he has given us nothing to verify yet.
		const email = `lp-${randomUUID()}@${LP_EMAIL_DOMAIN}`;
		const { data: created, error: authError } = await db.auth.admin.createUser({
			email,
			email_confirm: true
		});
		const userId = created?.user?.id;
		if (authError || !userId) {
			console.error('[aibestie] createUser failed:', authError);
			return { ok: false, reason: 'error' };
		}

		// 2. Profile row. Gender is hardcoded because the campaign targets men and
		//    Bestie is a woman→man proxy: inferring it would let a same-gender pair
		//    through, and resolveProxyPair answers those with silence, which reads
		//    as a broken page rather than a wrong assumption.
		//    is_seed:false + is_provisional:true is the exact pair realMembersOnly
		//    excludes — he is real enough to hold a conversation, never real enough
		//    to count.
		//    archetype/age/city are NOT NULL on this table but we genuinely know none
		//    of them — he has typed nothing yet. They are seeded EMPTY rather than
		//    guessed: an empty archetype makes getProfileCompleteness return
		//    'no_archetype', which routes him to actually choose one after signup,
		//    whereas a plausible-looking guess would silently stand in as his answer
		//    forever and feed the matcher a preference he never expressed.
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
			await db.auth.admin.deleteUser(userId).catch(() => {});
			return { ok: false, reason: 'error' };
		}

		// 3. The thread. status 'mutual' and ai_bestie_active true are what make
		//    chat/send route his message to her Bestie at all.
		const { data: match, error: matchError } = await db
			.from('verified_vibe_matches')
			.insert({
				user1_id: ownerId,
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
			await db.auth.admin.deleteUser(userId).catch(() => {});
			return { ok: false, reason: 'error' };
		}

		// 4. Her opening message, written NOW rather than generated.
		//    The in-app opener is a ~9s Claude call. A member in an installed app
		//    waits it out; a cold ad click does not — the page would paint an empty
		//    thread and lose most visitors before her first line landed. It is also
		//    built from his profile and artifacts, which an ad visitor does not have.
		//    Non-fatal: a thread that starts empty is poor, not broken, and Bestie
		//    still answers his first message.
		const { error: openerError } = await db.from('verified_vibe_messages').insert({
			match_id: match.id,
			sender_id: ownerId,
			content: buildLpOpener({
				firstName: (owner as any).first_name ?? '',
				terminus: terminusMode(ownerId)
			}),
			is_ai: true,
			created_at: new Date().toISOString()
		});
		if (openerError) {
			console.error('[aibestie] opener insert failed (degraded):', openerError);
		}

		// 5. Session bookkeeping.
		const claimCode = generateClaimCode();
		const { data: sessionRow, error: sessionError } = await db
			.from('aibestie_lp_sessions')
			.insert({
				user_id: userId,
				owner_id: ownerId,
				match_id: match.id,
				ip_hash: ipHash,
				user_agent: (opts.userAgent ?? '').slice(0, 400) || null,
				claim_code: claimCode,
				utm: opts.utm ?? null
			})
			.select('id')
			.single();
		if (sessionError) {
			// Non-fatal on purpose: the conversation works without this row, and
			// throwing away a paid click over bookkeeping is the worse trade. What is
			// lost is the turn cap and the claim code, so it is logged loudly.
			console.error('[aibestie] session insert failed (degraded):', sessionError);
		}

		// 6. Credentials. generateLink returns the raw OTP and sends nothing; the
		//    client verifies it to obtain a session (same path as seed-login).
		const { data: link, error: linkError } = await db.auth.admin.generateLink({
			type: 'magiclink',
			email
		});
		const otp = link?.properties?.email_otp;
		if (linkError || !otp) {
			console.error('[aibestie] generateLink failed:', linkError);
			return { ok: false, reason: 'error' };
		}

		return {
			ok: true,
			session: {
				sessionId: sessionRow?.id ?? '',
				userId,
				ownerId,
				matchId: match.id,
				claimCode,
				email,
				otp
			}
		};
	} catch (err) {
		console.error('[aibestie] startLpSession threw:', err);
		return { ok: false, reason: 'error' };
	}
}
