/**
 * Photo-signals policy (leaf module — no DB/LLM imports so both the vector builder
 * and the trust recompute can share ONE gameability-safe contribution policy).
 *
 * Onboarding photos are evidence, not decoration. A vision pass (photo-signal-capture.ts)
 * distils each user's REAL uploads into a bounded `data.photoSignals` record; this
 * module defines the fixed taxonomy, the kill switch, a stable hash (to skip
 * re-analysing unchanged photo sets), and the DETERMINISTIC maps that turn those
 * signals into a confidence (c) contribution for the vector builder and a trust
 * boost for the CG recompute.
 *
 * Safety posture (why this is not gameable):
 *  - Photos are self-uploaded and — for men — the DISPLAYED set is AI-generated, so
 *    photo CONTENT never awards trust on its own. Trust/confidence credit is GATED on
 *    the `authenticity` verdict (a single consistent real person, artifact-free) and
 *    is CAPPED and modest, on the same footing as a "cross-signal" — well below a
 *    directly-verified proof. Rich scenes add a little lifestyle/social credit only
 *    once authenticity holds.
 *  - Content (scene/dimension) signals feed the CLAIM level v, which is always
 *    discounted by confidence downstream — exactly how chat self-claims are treated.
 *  - Everything here is behind PHOTO_SIGNAL_GATE and off by default (shadow rollout).
 */

import { env } from '$env/dynamic/private';
import type { DimensionId } from '$lib/verified-vibe/dimensions';

/** Content signal for one dimension read off the photos: claimed level + short why. */
export interface PhotoDimSignal {
	/** Claimed level 0–100 this dimension is supported by the photos. */
	level: number;
	/** <=16-word human-readable justification (for provenance + coaching). */
	evidence: string;
}

/** Authenticity / quality verdict — the ONLY part that may touch trust/confidence. */
export interface PhotoAuthenticity {
	/** Same person across all photos (or a lone clear solo shot). */
	identityConsistent: boolean;
	/**
	 * A REAL human captured by a camera. Beauty filters, makeup, retouching, studio
	 * lighting and posed shots ALL still count as real — false ONLY for AI-generated /
	 * CGI / cartoon / stock / celebrity images or a different person. (Renamed intent:
	 * this is "is a real person", NOT "is unedited" — filtering is captured separately
	 * by heavilyEdited so it never blocks a genuine person's trust.)
	 */
	realNotAi: boolean;
	/**
	 * Free of AI-GENERATION defects only: warped/melted faces, broken or extra fingers,
	 * impossible geometry, garbled text/watermarks. Ordinary retouching / smoothing /
	 * filters are NOT artifacts and must not set this false.
	 */
	artifactFree: boolean;
	/** At least one clear, front-facing face. */
	faceClear: boolean;
	/** Noticeably filtered / retouched / beautified. INFORMATIONAL — does not gate. */
	heavilyEdited?: boolean;
	/** Overall photo-set quality 1–5. */
	quality: number;
}

/** The distilled record persisted on user_master_profile.data.photoSignals. */
export interface PhotoSignals {
	/** Per-dimension content claims read from the photos (open dims only). */
	dims: Partial<Record<DimensionId, PhotoDimSignal>>;
	/** Free scene tags (e.g. "coffee shop", "travel", "gym", "group/social"). */
	scenes: string[];
	authenticity: PhotoAuthenticity;
	/** How many photos were analysed. */
	photoCount: number;
	/** Stable hash of the analysed photo set — skip re-analysis when unchanged. */
	photoHash: string;
	/** ISO timestamp of the last successful vision pass. */
	analyzedAt: string;
	/** When we last scheduled a vector/trust rebuild off these — used to debounce. */
	lastRebuildAt?: string;
	/** Builder version so a policy change can invalidate stale records. */
	version: number;
}

// v2: authenticity gate distinguishes "real but filtered" (passes) from "fake/AI"
// (blocked) — filtering no longer withholds photo-trust. Bumping invalidates any v1
// records so they are re-analysed under the fairer gate.
export const PHOTO_SIGNAL_VERSION = 2;

/**
 * Kill switch (shadow rollout). OFF unless PHOTO_SIGNAL_GATE === 'true'. When off,
 * we neither analyse new photos NOR read any existing photoSignals into scoring, so
 * flipping the flag is a true no-redeploy on/off for the whole feature.
 */
export function photoSignalsEnabled(): boolean {
	return env.PHOTO_SIGNAL_GATE === 'true';
}

/**
 * Stable, order-insensitive hash of a user's photo set. Uses each photo's label +
 * a short fingerprint of its url/dataUrl (length + head + tail) so re-uploading the
 * same set is a no-op but any change re-triggers analysis. Not cryptographic.
 */
export function photoSetHash(photos: Array<{ label?: string; url?: string; dataUrl?: string }>): string {
	const parts = photos
		.map((p) => {
			const src = String(p.url ?? p.dataUrl ?? '');
			const fp = `${src.length}:${src.slice(0, 24)}:${src.slice(-16)}`;
			return `${String(p.label ?? '')}|${fp}`;
		})
		.sort();
	let h = 5381;
	const s = parts.join('~');
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
	return (h >>> 0).toString(36);
}

/** Authenticity is the pre-condition for ANY trust/confidence credit from photos. */
export function photoAuthenticityPasses(a: PhotoAuthenticity | undefined | null): boolean {
	return !!a && a.identityConsistent && a.realNotAi && a.artifactFree && a.faceClear;
}

// ── Confidence (c) contribution for the vector builder (TUNABLE) ────────────────
// Only credited when authenticity passes. Values are "proof strength" added to the
// per-dimension accumulator (same units as PROOF_CONFIDENCE), deliberately modest —
// a clear, real, consistent photo set is soft evidence of presentation/looks, NOT a
// verified proof. Scene richness nudges lifestyle a touch.
const PHOTO_BASE_CONFIDENCE: Partial<Record<DimensionId, number>> = {
	presentation: 0.35,
	looks: 0.30,
	warmth: 0.10,
};

/** Scenes that legitimately hint at a lived-in, active lifestyle. */
const LIFESTYLE_SCENE_HINTS = ['travel', 'outdoors', 'nature', 'hosting', 'restaurant', 'luxury', 'gym', 'fitness', 'adventure'];
const SOCIAL_SCENE_HINTS = ['group', 'social', 'friends', 'party', 'event'];

function countHits(scenes: string[], hints: string[]): number {
	const lc = scenes.map((s) => s.toLowerCase());
	return hints.filter((h) => lc.some((s) => s.includes(h))).length;
}

/**
 * Deterministic per-dimension confidence strength from photo signals. Returns {} when
 * authenticity fails so unverifiable/AI-looking photos never move confidence.
 */
export function photoConfidenceContribution(sig: PhotoSignals | undefined | null): Partial<Record<DimensionId, number>> {
	if (!sig || !photoAuthenticityPasses(sig.authenticity)) return {};
	const out: Partial<Record<DimensionId, number>> = { ...PHOTO_BASE_CONFIDENCE };
	// Higher-quality sets get slightly more presentation credit (cap the base).
	const qBonus = Math.max(0, (sig.authenticity.quality - 3)) * 0.05; // 0…0.1
	out.presentation = Math.min(0.5, (out.presentation ?? 0) + qBonus);
	// Lifestyle scenes add a small, capped confidence.
	const lifeHits = countHits(sig.scenes, LIFESTYLE_SCENE_HINTS);
	if (lifeHits > 0) out.lifestyle = Math.min(0.3, 0.1 * lifeHits);
	return out;
}

// ── Trust (CG subscore) contribution for trust-recompute (TUNABLE) ──────────────
// Photos are treated like a "cross-signal": reduced, capped, and only credited when
// authenticity passes. This lets a genuine, consistent, real photo set raise the
// identity/authenticity floor a little (the same thing humans tag by hand in
// /admin/photos) without letting photo content substitute for real proofs.
import type { CGTrustSubscores } from '$lib/verified-vibe/server/trustScore';

export interface PhotoTrustBoost {
	key: keyof CGTrustSubscores;
	boost: number;
	/** If true, only apply when the dimension has NO direct proof yet (cross-signal rule). */
	crossOnly: boolean;
}

/**
 * Deterministic list of CG-subscore boosts from photo signals. Empty when authenticity
 * fails. Caller enforces the crossOnly rule and the per-subscore 0–100 clamp.
 */
export function photoTrustContribution(sig: PhotoSignals | undefined | null): PhotoTrustBoost[] {
	if (!sig || !photoAuthenticityPasses(sig.authenticity)) return [];
	const boosts: PhotoTrustBoost[] = [];
	// Authenticity itself: a verified-looking, consistent real face is identity evidence.
	// Scaled by quality (3→~12, 5→20). Applied unconditionally (identity has its own base).
	boosts.push({ key: 'identity', boost: Math.round(4 * sig.authenticity.quality), crossOnly: false });
	// Rich lifestyle scenes → lifestyleDepth, cross-signal only (don't inflate a proven dim).
	const lifeHits = countHits(sig.scenes, LIFESTYLE_SCENE_HINTS);
	if (lifeHits > 0) boosts.push({ key: 'lifestyleDepth', boost: Math.min(25, 8 * lifeHits), crossOnly: true });
	// Social/group scenes → socialLegitimacy, cross-signal only, modest.
	const socialHits = countHits(sig.scenes, SOCIAL_SCENE_HINTS);
	if (socialHits > 0) boosts.push({ key: 'socialLegitimacy', boost: Math.min(15, 8 * socialHits), crossOnly: true });
	return boosts;
}
