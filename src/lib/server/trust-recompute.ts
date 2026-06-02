/**
 * Unified raw-trust recompute — the SINGLE source of truth for a user's
 * absolute (pre-normalization) trust score.
 *
 * Background / why this exists (Phase 0 of the trust + compatibility redesign):
 * trust_score used to be written by two paths that fought each other —
 *   1. proof-upload/+server.ts ran a CG (casual-generous) dimension recompute
 *      from verified_vibe_verification ONLY, and
 *   2. artifacts/+server.ts (the 📎 chat upload) added flat CLAIM_TRUST_POINTS
 *      that the next CG recompute silently overwrote, while the CG recompute
 *      never even read user_artifacts.
 * So 📎 uploads either vanished or were ignored. This module collapses both
 * into one recompute that reads ALL proof sources (verification records,
 * proof_% records, AND user_artifacts) and produces one coherent raw score,
 * plus the identity/proof layer breakdown the AI and the (later) normalization
 * pass need.
 *
 * The CG model is universal (not archetype-specific). Weights:
 *   Identity 20% · Lifestyle 25% · Generosity 30% · Safety 15% · Social 10%
 */

import { getSupabase } from './supabase';
import { calculateCGTotal, type CGTrustSubscores } from '$lib/verified-vibe/server/trustScore';
import { refreshWingmanPoolEntry, refreshBestiePoolEntry } from './pool-registry';

// Proof-category → CG dimension boost (mirrors CasualGenerousBoostTab / the old
// inline map in proof-upload). Show-off categories get a photo-count multiplier.
const PROOF_BOOST_MAP: Record<string, { key: keyof CGTrustSubscores; boost: number }> = {
	lifestyle:    { key: 'lifestyleDepth',    boost: 30 },
	hosting:      { key: 'lifestyleDepth',    boost: 20 },
	discipline:   { key: 'emotionalSafety',   boost: 35 },
	social_proof: { key: 'socialLegitimacy',  boost: 30 },
	linkedin:     { key: 'socialLegitimacy',  boost: 50 },
	instagram:    { key: 'socialLegitimacy',  boost: 25 },
	twitter:      { key: 'socialLegitimacy',  boost: 15 },
	habit_tracker:{ key: 'socialLegitimacy',  boost: 20 },
	intro:        { key: 'emotionalSafety',   boost: 45 },
	spending:     { key: 'generositySignals', boost: 30 },
	assets:       { key: 'generositySignals', boost: 35 },
};

const SHOW_OFF_CATS = new Set(['lifestyle', 'hosting', 'discipline', 'social_proof']);

// 📎 artifact claim_tag → CG dimension. Mirrors the closest proof category so
// chat-uploaded evidence finally contributes on the same footing as onboarding
// proofs. Each artifact is a single item, so no photo multiplier is applied.
const ARTIFACT_BOOST_MAP: Record<string, { key: keyof CGTrustSubscores; boost: number }> = {
	wealthy:       { key: 'generositySignals', boost: 30 }, // like spending/assets
	well_traveled: { key: 'lifestyleDepth',    boost: 30 }, // like lifestyle
	fitness:       { key: 'emotionalSafety',   boost: 35 }, // like discipline
	general:       { key: 'socialLegitimacy',  boost: 20 },
};

function photoMultiplier(count: number): number {
	if (count <= 4)  return 0.40;
	if (count <= 9)  return 0.65;
	if (count <= 14) return 0.85;
	return 1.0;
}

export interface RawTrustResult {
	rawTrust: number;        // 0–100, absolute (pre-normalization) — what trust_score is set to today
	identityScore: number;   // CG identity subscore (ID + liveness avg), 0–100
	proofScore: number;      // composite of the four non-identity dimensions, 0–100
	identityVerified: boolean; // both ID and liveness completed
	subscores: CGTrustSubscores;
}

/**
 * Recompute a user's raw trust from every proof source, persist it to
 * verified_vibe_users.trust_score, refresh their pool band if they're already
 * enrolled, and return the score plus its layer breakdown.
 *
 * Never throws — logs and returns a zeroed result on failure so upload handlers
 * don't 500 on a scoring hiccup.
 */
export async function recomputeRawTrust(userId: string): Promise<RawTrustResult> {
	const zero: RawTrustResult = {
		rawTrust: 0, identityScore: 0, proofScore: 0, identityVerified: false,
		subscores: { identity: 0, lifestyleDepth: 0, generositySignals: 0, emotionalSafety: 0, socialLegitimacy: 0 },
	};

	try {
		const db = getSupabase() as any;

		// Base verification records (id, liveness, photos, spending_or_qa)
		const { data: baseRows } = await db
			.from('verified_vibe_verification')
			.select('step, status, data')
			.eq('user_id', userId)
			.not('step', 'like', 'proof_%');

		// Proof records (onboarding "show-offs")
		const { data: proofRows } = await db
			.from('verified_vibe_verification')
			.select('step, data')
			.eq('user_id', userId)
			.like('step', 'proof_%');

		// 📎 chat-uploaded artifacts
		const { data: artifacts } = await db
			.from('user_artifacts')
			.select('claim_tag')
			.eq('user_id', userId);

		const subscores: CGTrustSubscores = {
			identity: 0, lifestyleDepth: 0, generositySignals: 0, emotionalSafety: 0, socialLegitimacy: 0,
		};

		// ── Base dimensions from verification records (faithful to the old recalc) ──
		let idDone = false, livDone = false;
		if (Array.isArray(baseRows)) {
			const idRec    = baseRows.find((r: any) => r.step === 'id');
			const livRec   = baseRows.find((r: any) => r.step === 'liveness');
			const photoRec = baseRows.find((r: any) => r.step === 'photos');
			const qaRec    = baseRows.find((r: any) => r.step === 'spending_or_qa');
			const idScore  = idRec    ? (idRec.data?.confidenceScore    ?? 100) : 0;
			const livScore = livRec   ? (livRec.data?.confidenceScore   ?? 100) : 0;
			const phScore  = photoRec ? (photoRec.data?.confidenceScore ?? 100) : 0;
			const qaScore  = qaRec    ? 100 : 0;
			idDone  = !!idRec;
			livDone = !!livRec;
			subscores.identity          = Math.round((idScore + livScore) / 2);
			subscores.lifestyleDepth     = phScore;
			subscores.generositySignals  = qaScore;
		}

		// ── Proof boosts ───────────────────────────────────────────────────────────
		if (Array.isArray(proofRows)) {
			for (const row of proofRows) {
				const cat = (row.step as string).replace('proof_', '');
				const b = PROOF_BOOST_MAP[cat];
				if (!b) continue;
				const photoCount = row.data?.photo_count ?? 0;
				const mult = SHOW_OFF_CATS.has(cat) ? photoMultiplier(photoCount) : 1;
				subscores[b.key] = Math.min(100, subscores[b.key] + Math.round(b.boost * mult));
			}
		}

		// ── Artifact boosts (📎 chat uploads — newly counted) ───────────────────────
		if (Array.isArray(artifacts)) {
			for (const a of artifacts) {
				const b = ARTIFACT_BOOST_MAP[a.claim_tag as string];
				if (!b) continue;
				subscores[b.key] = Math.min(100, subscores[b.key] + b.boost);
			}
		}

		const rawTrust = calculateCGTotal(subscores);

		// Layer breakdown: identity vs the proof "show-offs" (the four other dims,
		// weight-normalized to a 0–100 scale within their 80% share).
		const proofScore = Math.min(100, Math.round(
			(subscores.lifestyleDepth    * 0.25 +
			 subscores.generositySignals * 0.30 +
			 subscores.emotionalSafety   * 0.15 +
			 subscores.socialLegitimacy  * 0.10) / 0.80
		));

		// Persist the raw layer + its breakdown. The DISPLAYED value (trust_score)
		// is the NORMALIZED score, owned by normalizeUser (trust-normalize.ts),
		// which runs immediately after via recomputeAndNormalize / the nightly pass.
		// Pool-band refresh happens there too, so the band reflects the normalized
		// score rather than the raw one.
		await db
			.from('verified_vibe_users')
			.update({
				raw_trust: rawTrust,
				identity_score: subscores.identity,
				proof_score: proofScore,
				identity_verified: idDone && livDone,
				trust_updated_at: new Date().toISOString(),
			})
			.eq('id', userId);

		return {
			rawTrust,
			identityScore: subscores.identity,
			proofScore,
			identityVerified: idDone && livDone,
			subscores,
		};
	} catch (e) {
		console.warn('recomputeRawTrust failed (non-fatal):', e);
		return zero;
	}
}

/** Update the cached trust_score_band for an already-enrolled user (no premature enrollment). */
export async function refreshPoolBandIfEnrolled(userId: string): Promise<void> {
	try {
		const db = getSupabase() as any;
		const [{ data: inWingmen }, { data: inBesties }] = await Promise.all([
			db.from('vv_pool_wingmen').select('user_id').eq('user_id', userId).maybeSingle(),
			db.from('vv_pool_besties').select('user_id').eq('user_id', userId).maybeSingle(),
		]);
		if (inWingmen) await refreshWingmanPoolEntry(userId);
		if (inBesties) await refreshBestiePoolEntry(userId);
	} catch (e) {
		console.warn('refreshPoolBandIfEnrolled failed (non-fatal):', e);
	}
}
