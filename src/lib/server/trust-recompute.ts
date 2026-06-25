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
 * plus the identity/proof layer breakdown the AI and the normalization pass need.
 *
 * The CG model is universal (not archetype-specific). Weights:
 *   Identity 20% · Lifestyle 25% · Generosity 30% · Safety 15% · Social 10%
 */

import { getSupabase } from './supabase';
import { calculateCGTotal, type CGTrustSubscores } from '$lib/verified-vibe/server/trustScore';
import { refreshPoolEntry } from './pool-registry';

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

// Cross-section signals (master_profile.data.crossSignals) are insights inferred
// from a DIFFERENT upload than the section they enrich. They award REDUCED trust
// — a fraction of the equivalent direct-proof boost — and ONLY for a CG dimension
// the user hasn't already proved directly, so one upload can't "spray" points or
// double-credit a dimension. target section → CG dimension + full-strength boost.
const CROSS_SIGNAL_FACTOR = 0.25;
const CROSS_SECTION_BOOST_MAP: Record<string, { key: keyof CGTrustSubscores; boost: number }> = {
	travel:    { key: 'lifestyleDepth',    boost: 30 },
	lifestyle: { key: 'lifestyleDepth',    boost: 30 },
	hosting:   { key: 'lifestyleDepth',    boost: 20 },
	health:    { key: 'emotionalSafety',   boost: 35 },
	social:    { key: 'socialLegitimacy',  boost: 30 },
	career:    { key: 'socialLegitimacy',  boost: 50 },
	money:     { key: 'generositySignals', boost: 30 },
	garage:    { key: 'generositySignals', boost: 35 },
};

// 📎 artifact claim_tag → CG dimension. Mirrors the closest proof category so
// chat-uploaded evidence finally contributes on the same footing as onboarding
// proofs. Each artifact is a single item, so no photo multiplier is applied.
// Exported so the what-if simulator can predict the effect of a 📎 upload.
export const ARTIFACT_BOOST_MAP: Record<string, { key: keyof CGTrustSubscores; boost: number }> = {
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

/** Identity + proof layer composite from a set of CG subscores. */
export function proofScoreFromSubscores(s: CGTrustSubscores): number {
	return Math.min(100, Math.round(
		(s.lifestyleDepth    * 0.25 +
		 s.generositySignals * 0.30 +
		 s.emotionalSafety   * 0.15 +
		 s.socialLegitimacy  * 0.10) / 0.80
	));
}

export interface SubscoreResult {
	subscores: CGTrustSubscores;
	rawTrust: number;
	identityScore: number;
	proofScore: number;
	identityVerified: boolean;
}

/**
 * PURE read: compute a user's CG subscores + raw trust from every proof source,
 * WITHOUT writing anything. Used by recomputeRawTrust (which then persists) and
 * by the what-if simulator (which mutates clones of `subscores` to predict the
 * effect of hypothetical uploads).
 */
export async function computeSubscores(userId: string): Promise<SubscoreResult> {
	const subscores: CGTrustSubscores = {
		identity: 0, lifestyleDepth: 0, generositySignals: 0, emotionalSafety: 0, socialLegitimacy: 0,
	};
	let idDone = false, livDone = false;

	try {
		const db = getSupabase() as any;

		const { data: baseRows } = await db
			.from('verified_vibe_verification')
			.select('step, status, data')
			.eq('user_id', userId)
			.not('step', 'like', 'proof_%');

		const { data: proofRows } = await db
			.from('verified_vibe_verification')
			.select('step, data')
			.eq('user_id', userId)
			.like('step', 'proof_%');

		const { data: artifacts } = await db
			.from('user_artifacts')
			.select('claim_tag')
			.eq('user_id', userId);

		const { data: masterRow } = await db
			.from('user_master_profile')
			.select('data')
			.eq('user_id', userId)
			.maybeSingle();

		// Base dimensions from verification records (faithful to the old recalc).
		if (Array.isArray(baseRows)) {
			const idRec    = baseRows.find((r: any) => r.step === 'id');
			const livRec   = baseRows.find((r: any) => r.step === 'liveness');
			const photoRec = baseRows.find((r: any) => r.step === 'photos');
			const qaRec    = baseRows.find((r: any) => r.step === 'spending_or_qa');
			const idScore  = idRec    ? (idRec.data?.confidenceScore    ?? 100) : 0;
			const livScore = livRec   ? (livRec.data?.confidenceScore   ?? 100) : 0;
			const phScore  = photoRec ? (photoRec.data?.confidenceScore ?? 100) : 0;
			idDone  = !!idRec;
			livDone = !!livRec;
			subscores.identity          = Math.round((idScore + livScore) / 2);
			subscores.lifestyleDepth     = phScore;
			subscores.generositySignals  = qaRec ? 100 : 0;
		}

		// Proof boosts. Track which CG dimensions get DIRECT credit so cross-signals
		// below never double-count or inflate an already-proven dimension.
		const directDims = new Set<keyof CGTrustSubscores>();
		if (Array.isArray(proofRows)) {
			for (const row of proofRows) {
				const cat = (row.step as string).replace('proof_', '');
				const b = PROOF_BOOST_MAP[cat];
				if (!b) continue;
				const mult = SHOW_OFF_CATS.has(cat) ? photoMultiplier(row.data?.photo_count ?? 0) : 1;
				subscores[b.key] = Math.min(100, subscores[b.key] + Math.round(b.boost * mult));
				directDims.add(b.key);
			}
		}

		// 📎 artifact boosts (newly counted).
		if (Array.isArray(artifacts)) {
			for (const a of artifacts) {
				const b = ARTIFACT_BOOST_MAP[a.claim_tag as string];
				if (!b) continue;
				subscores[b.key] = Math.min(100, subscores[b.key] + b.boost);
				directDims.add(b.key);
			}
		}

		// Cross-section signal boosts (reduced). Only credit a CG dimension that
		// has NO direct proof yet, and at most once per dimension.
		const crossSignals = (masterRow?.data?.crossSignals && typeof masterRow.data.crossSignals === 'object')
			? masterRow.data.crossSignals as Record<string, unknown[]>
			: {};
		const creditedCrossDims = new Set<keyof CGTrustSubscores>();
		for (const [section, sigs] of Object.entries(crossSignals)) {
			if (!Array.isArray(sigs) || sigs.length === 0) continue;
			const m = CROSS_SECTION_BOOST_MAP[section];
			if (!m || directDims.has(m.key) || creditedCrossDims.has(m.key)) continue;
			subscores[m.key] = Math.min(100, subscores[m.key] + Math.round(m.boost * CROSS_SIGNAL_FACTOR));
			creditedCrossDims.add(m.key);
		}
	} catch (e) {
		console.warn('computeSubscores failed (non-fatal):', e);
	}

	return {
		subscores,
		rawTrust: calculateCGTotal(subscores),
		identityScore: subscores.identity,
		proofScore: proofScoreFromSubscores(subscores),
		identityVerified: idDone && livDone,
	};
}

export interface RawTrustResult {
	rawTrust: number;
	identityScore: number;
	proofScore: number;
	identityVerified: boolean;
	subscores: CGTrustSubscores;
}

/**
 * Recompute a user's raw trust from every proof source and PERSIST the raw layer
 * + components. The DISPLAYED value (trust_score) is the NORMALIZED score, owned
 * by normalizeUser (trust-normalize.ts), which runs right after via
 * recomputeAndNormalize / the nightly pass — pool-band refresh happens there too,
 * so the band reflects the normalized score. Never throws.
 */
export async function recomputeRawTrust(userId: string): Promise<RawTrustResult> {
	const r = await computeSubscores(userId);
	try {
		const db = getSupabase() as any;
		await db
			.from('verified_vibe_users')
			.update({
				raw_trust: r.rawTrust,
				identity_score: r.identityScore,
				proof_score: r.proofScore,
				identity_verified: r.identityVerified,
				trust_updated_at: new Date().toISOString(),
			})
			.eq('id', userId);
	} catch (e) {
		console.warn('recomputeRawTrust persist failed (non-fatal):', e);
	}
	return {
		rawTrust: r.rawTrust,
		identityScore: r.identityScore,
		proofScore: r.proofScore,
		identityVerified: r.identityVerified,
		subscores: r.subscores,
	};
}

/** Update the cached trust_score_band for an already-enrolled user (no premature enrollment). */
export async function refreshPoolBandIfEnrolled(userId: string): Promise<void> {
	try {
		const db = getSupabase() as any;
		const { data: enrolled } = await db
			.from('vv_pool_profiles')
			.select('user_id')
			.eq('user_id', userId)
			.maybeSingle();
		if (enrolled) await refreshPoolEntry(userId);
	} catch (e) {
		console.warn('refreshPoolBandIfEnrolled failed (non-fatal):', e);
	}
}
