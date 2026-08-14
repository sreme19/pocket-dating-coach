/**
 * Where each member came from, resolved per user for the admin Users table.
 *
 * There is no single column that answers this, and there was never going to be:
 * the three ways a person reaches this product are recorded by three different
 * systems that do not know about each other.
 *
 *   · A PAID INSTALL is stamped on the device — the Play install referrer read at
 *     first launch, landed in `user_acquisition` (first touch wins, enforced
 *     there). This is the only evidence that survives the store round-trip.
 *   · A PAID LANDING-PAGE ARRIVAL is stamped on the web session — `/aibestie`
 *     mints a provisional user on the visitor's first message, so the utm that
 *     brought them is on `aibestie_lp_sessions`, joined by `user_id` (the
 *     provisional row) or `claimed_by_user_id` (once a claim code turns that
 *     visitor into a real account).
 *   · A REFERRAL is stamped on the invite — `verified_vibe_beta_signups` is
 *     shaped around a referral link (`link_id` is NOT NULL there), so a row for
 *     this person IS a member vouching for them. `vv_referral_rewards` is the
 *     same fact after money was attached to it.
 *
 * PRECEDENCE IS NOT ARBITRARY — it goes strongest first-touch evidence first.
 * Paid network evidence outranks referral because a referred member who installs
 * from a plain Play button carries the store's own `google-play / organic`
 * referrer, and letting `user_acquisition` win outright would relabel every
 * referral as organic — turning the referral programme invisible while the ads
 * tab reported traffic nobody bought. Ranking a real snap/meta utm above the
 * referral row, and the referral row above the organic fallback, is the ordering
 * where no channel can be silently swallowed by another.
 *
 * `unknown` IS A REAL ANSWER AND IS LABELLED AS ONE. Install attribution needs a
 * Flutter build carrying the referrer read, so most existing members predate any
 * of these records. Reporting them as "organic" would invent a channel; they are
 * members whose origin was never written down, and the column says so.
 */

import { networkOf } from '$lib/server/traffic-quality';

export type LeadSource = 'snap' | 'meta' | 'referral' | 'organic' | 'unknown';

export type LeadSourceEvidence =
	| 'install_referrer'
	| 'landing_session'
	| 'referral_reward'
	| 'referral_invite'
	| 'none';

export interface LeadSourceVerdict {
	source: LeadSource;
	/** Campaign, store or referrer name — shown on hover, never grouped on. */
	detail: string | null;
	/** Which record decided it, so a surprising label can be traced back. */
	evidence: LeadSourceEvidence;
}

type Utm = Record<string, string> | null | undefined;

export interface AcquisitionRow {
	user_id: string;
	network?: string | null;
	campaign?: string | null;
	utm?: Utm;
}

export interface LandingSessionRow {
	user_id?: string | null;
	claimed_by_user_id?: string | null;
	utm?: Utm;
}

export interface ReferralInviteRow {
	email?: string | null;
	referrer_id?: string | null;
	matched_user_id?: string | null;
}

export interface ReferralRewardRow {
	referred_user_id?: string | null;
	referrer_id?: string | null;
}

export interface LeadSourceInputs {
	acquisition: AcquisitionRow[];
	landingSessions: LandingSessionRow[];
	referralInvites: ReferralInviteRow[];
	referralRewards: ReferralRewardRow[];
	/** id → auth email. Referral invites are keyed by email, not by user id. */
	emailById: Map<string, string>;
	/** id → first name, so the detail can name who referred them. */
	nameById: Map<string, string | null>;
}

const UNKNOWN: LeadSourceVerdict = { source: 'unknown', detail: null, evidence: 'none' };

/** The paid network on a utm bag, or null when it is not a network we buy. */
function paidNetwork(utm: Utm): 'snap' | 'meta' | null {
	const net = networkOf(utm ?? undefined);
	return net === 'other' ? null : net;
}

function clean(v: string | null | undefined): string | null {
	const s = (v ?? '').trim();
	return s.length ? s : null;
}

export function buildLeadSources(input: LeadSourceInputs): Map<string, LeadSourceVerdict> {
	const out = new Map<string, LeadSourceVerdict>();

	// ── 4. Organic / other floor, from the install referrer ───────────────────
	// Written first so every stronger signal below simply overwrites it. The
	// store's own `google-play / organic` referrer lands here rather than being
	// dropped: "we know they installed and no campaign was attached" is a
	// different statement from "we have no idea", and only one of the two is
	// worth chasing.
	for (const row of input.acquisition) {
		if (!row.user_id) continue;
		const net = paidNetwork(row.utm ?? { utm_source: row.network ?? '' });
		if (net) continue; // handled in step 1
		out.set(row.user_id, {
			source: 'organic',
			detail: clean(row.network) ?? 'no campaign attached',
			evidence: 'install_referrer'
		});
	}

	// ── 3. Referral, from the invite a member sent ────────────────────────────
	// Two keys on purpose. `matched_user_id` is the invite already tied to the
	// account it produced; email is the fallback and is the ONLY attribution key
	// for invites that were never matched, which is most of them.
	const referrerLabel = (referrerId: string | null | undefined): string => {
		const name = referrerId ? clean(input.nameById.get(referrerId) ?? null) : null;
		return name ? `referred by ${name}` : 'referred by a member';
	};

	const userIdByEmail = new Map<string, string>();
	for (const [id, email] of input.emailById) {
		const key = email.trim().toLowerCase();
		if (key) userIdByEmail.set(key, id);
	}

	for (const invite of input.referralInvites) {
		const byId = clean(invite.matched_user_id);
		const byEmail = userIdByEmail.get((invite.email ?? '').trim().toLowerCase());
		const userId = byId ?? byEmail;
		if (!userId) continue;
		out.set(userId, {
			source: 'referral',
			detail: referrerLabel(invite.referrer_id),
			evidence: 'referral_invite'
		});
	}

	// A paid reward is the same fact with money behind it, so it outranks the
	// bare invite as the evidence cited.
	for (const reward of input.referralRewards) {
		const userId = clean(reward.referred_user_id);
		if (!userId) continue;
		out.set(userId, {
			source: 'referral',
			detail: referrerLabel(reward.referrer_id),
			evidence: 'referral_reward'
		});
	}

	// ── 2. Paid landing-page arrival ──────────────────────────────────────────
	// `claimed_by_user_id` written after `user_id` within the same pass: when a
	// provisional visitor later claims a real account, the claim is the more
	// specific tie of the two.
	for (const session of input.landingSessions) {
		const net = paidNetwork(session.utm);
		if (!net) continue;
		const detail = clean(session.utm?.utm_campaign) ?? clean(session.utm?.utm_source);
		for (const userId of [clean(session.user_id), clean(session.claimed_by_user_id)]) {
			if (!userId) continue;
			out.set(userId, { source: net, detail, evidence: 'landing_session' });
		}
	}

	// ── 1. Paid install, the strongest tie there is ───────────────────────────
	for (const row of input.acquisition) {
		if (!row.user_id) continue;
		const net = paidNetwork(row.utm ?? { utm_source: row.network ?? '' });
		if (!net) continue;
		out.set(row.user_id, {
			source: net,
			detail: clean(row.campaign) ?? clean(row.utm?.utm_campaign),
			evidence: 'install_referrer'
		});
	}

	return out;
}

export function leadSourceOf(
	map: Map<string, LeadSourceVerdict>,
	userId: string
): LeadSourceVerdict {
	return map.get(userId) ?? UNKNOWN;
}
