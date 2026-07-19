/**
 * Vector builder — the ONLY LLM step in the redesigned scoring flow (Design
 * Appendix B). For one user it produces the three vectors over the fixed
 * dimension taxonomy and writes them to vv_user_vectors:
 *
 *   v[d]  attribute level 0–100   — "how much of this they bring" (the CLAIM)
 *   c[d]  confidence    0–1        — "how proven it is"          (deterministic)
 *   w[d]  preference weight (Σ=1)  — "how much THEY care about it in others"
 *
 * Hard separation (Design §3, §6b): the claimed level v and its proven-ness c are
 * distinct. An unproven claim still raises v, but carries low c, so the confidence
 * multiplier in appeal/PS discounts it. Verifying raises c toward 1 — that is the
 * coachable upside. We therefore let the LLM set the claimed level v freely and
 * derive c DETERMINISTICALLY from the verified proof record (never from the LLM).
 *
 * PHASE 0: this is shadow-only. Nothing on the live scoring/matching/advisor path
 * calls it; it runs via the admin backfill endpoint. Mapping constants below are
 * the tunable product judgement — change them here without touching the schema.
 *
 * Keep cheap: one Claude call per user, on profile change — never per pair.
 */

import { getSupabase } from './supabase';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import {
	ALL_DIMENSIONS,
	ALL_DIMENSION_IDS,
	CONFIDENCE_MIN,
	type DimensionId,
} from '$lib/verified-vibe/dimensions';
import { incomeToV, parseIncomeToLPA } from '$lib/verified-vibe/valuation';

export const VECTOR_BUILDER_VERSION = 1;

// ── Proof → dimension confidence map (TUNABLE) ──────────────────────────────────
// Each verified proof category contributes "proof strength" (0..1 before clamp) to
// one or more dimensions. Strength accumulates across a user's proofs, is clamped
// to 1, then becomes confidence:  c[d] = c_min + (1 - c_min) * strength[d].
// Categories mirror the proof-upload taxonomy (mobile/lib/proof_upload_screen.dart)
// and the verification steps (id/liveness/photos/spending_or_qa).
const PROOF_CONFIDENCE: Record<string, Partial<Record<DimensionId, number>>> = {
	// Money tier
	wealth:        { financial: 0.7 },
	spending:      { financial: 0.5 },
	assets:        { financial: 0.6 },
	// Lifestyle / experiences
	lifestyle:     { lifestyle: 0.6, presentation: 0.15 },
	hosting:       { lifestyle: 0.4, warmth: 0.2 },
	// Health / discipline
	discipline:    { presentation: 0.6 },
	habit_tracker: { presentation: 0.3 },
	// Warmth / self-expression
	intro:         { warmth: 0.4, presentation: 0.2 },
	// Social & professional legitimacy
	social_proof:  { social_legitimacy: 0.4, warmth: 0.1 },
	linkedin:      { social_legitimacy: 0.7, ambition: 0.4 },
	instagram:     { social_legitimacy: 0.3, lifestyle: 0.1 },
	twitter:       { social_legitimacy: 0.2, intellect: 0.1 },
	// Base verification steps
	photos:        { presentation: 0.5, looks: 0.3 }, // recent, consistent photos = real, recent presentation
};

// 📎 chat-artifact claim_tag → dimension confidence (mirrors trust-recompute's map).
const ARTIFACT_CONFIDENCE: Record<string, Partial<Record<DimensionId, number>>> = {
	wealthy:       { financial: 0.4 },
	well_traveled: { lifestyle: 0.4 },
	fitness:       { presentation: 0.4 },
	general:       { social_legitimacy: 0.2 },
};

// ── Inputs gathered for one user ────────────────────────────────────────────────

interface BuilderInput {
	userId: string;
	gender: string | null;
	age: number | null;
	city: string | null;
	profileText: string;        // generated profile + identity blurbs
	onboardingText: string;     // flattened onboarding answers (who they are + what they want)
	proofCategories: string[];  // verified proof categories present
	photoCount: number;
	strength: Record<string, number>; // per-dim accumulated proof strength (pre-clamp)
	incomeLPA: number | null;   // parsed annual income (LPA), if the user stated one
}

function flattenAnswers(obj: unknown, out: string[] = [], depth = 0): string[] {
	if (depth > 6 || obj == null) return out;
	if (typeof obj === 'string') { if (obj.trim()) out.push(obj.trim()); return out; }
	if (typeof obj === 'number' || typeof obj === 'boolean') { out.push(String(obj)); return out; }
	if (Array.isArray(obj)) { for (const x of obj) flattenAnswers(x, out, depth + 1); return out; }
	if (typeof obj === 'object') { for (const v of Object.values(obj as Record<string, unknown>)) flattenAnswers(v, out, depth + 1); }
	return out;
}

async function gatherInput(db: any, userId: string): Promise<BuilderInput | null> {
	const { data: user } = await db
		.from('verified_vibe_users')
		.select('id, gender, age, city')
		.eq('id', userId).maybeSingle();
	if (!user) return null;

	const { data: masterRow } = await db
		.from('user_master_profile')
		.select('data')
		.eq('user_id', userId).maybeSingle();
	const md = masterRow?.data ?? {};

	// Profile text: generated copy + identity blurbs.
	const gen = md.generatedProfile ?? {};
	const profileBits = flattenAnswers({
		headline: gen.headline, publicIntro: gen.publicIntro,
		personality: gen.personalityDescriptors, values: gen.values,
		lifestyle: gen.lifestyleTags, identity: md.identity,
	});

	// Onboarding text (who they are + what they want), all archetypes.
	const onboardingBits = flattenAnswers(md.onboarding ?? {});

	// Stated annual income (Money Matters) → LPA, for the deterministic curve.
	const incomeLPA = parseIncomeToLPA((gen.moneyMatters as any)?.annualIncome);

	// Verified proof categories.
	const { data: proofRows } = await db
		.from('verified_vibe_verification')
		.select('step, status, data')
		.eq('user_id', userId);
	const proofCategories: string[] = [];
	let photoCount = 0;
	const strength: Record<string, number> = {};
	const add = (map: Record<string, Partial<Record<DimensionId, number>>>, cat: string, mult = 1) => {
		const m = map[cat];
		if (!m) return;
		for (const [dim, s] of Object.entries(m)) strength[dim] = (strength[dim] ?? 0) + (s as number) * mult;
	};

	for (const row of proofRows ?? []) {
		if (row.status && row.status !== 'completed') continue;
		const step = row.step as string;
		if (step.startsWith('proof_')) {
			const cat = step.replace('proof_', '');
			proofCategories.push(cat);
			const pc = Number(row.data?.photo_count ?? 0);
			// Show-off categories scale with photo evidence (cap at 1x).
			const mult = pc > 0 ? Math.min(1, 0.4 + pc * 0.1) : 1;
			add(PROOF_CONFIDENCE, cat, mult);
		} else if (step === 'photos') {
			photoCount = Number(row.data?.photo_count ?? 0);
			add(PROOF_CONFIDENCE, 'photos');
			proofCategories.push('photos');
		}
	}

	const { data: artifacts } = await db
		.from('user_artifacts').select('claim_tag').eq('user_id', userId);
	for (const a of artifacts ?? []) add(ARTIFACT_CONFIDENCE, a.claim_tag as string);

	return {
		userId,
		gender: user.gender ?? null,
		age: user.age ?? null,
		city: user.city ?? null,
		profileText: profileBits.join(' · ').slice(0, 4000),
		onboardingText: onboardingBits.join(' · ').slice(0, 4000),
		proofCategories: [...new Set(proofCategories)],
		photoCount,
		strength,
		incomeLPA,
	};
}

// ── Confidence (deterministic) ──────────────────────────────────────────────────

function buildConfidence(strength: Record<string, number>): Record<string, number> {
	const c: Record<string, number> = {};
	for (const id of ALL_DIMENSION_IDS) {
		const s = Math.max(0, Math.min(1, strength[id] ?? 0));
		c[id] = Number((CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * s).toFixed(3));
	}
	return c;
}

// ── Attribute level v + preference weights w (one LLM call) ─────────────────────

interface LLMVectors {
	attributes: Record<string, number>;
	weights: Record<string, number>;
}

function buildVectorPrompt(input: BuilderInput): string {
	const dimList = ALL_DIMENSIONS
		.map((d) => `- ${d.id} (${d.cls}): ${d.label} — ${d.blurb}`)
		.join('\n');
	return `You build two vectors for ONE dating-app user over a FIXED set of value dimensions. Use ONLY the evidence below. Do not invent facts.

DIMENSIONS:
${dimList}

USER (gender: ${input.gender ?? 'unknown'}, age: ${input.age ?? 'unknown'}, city: ${input.city ?? 'unknown'}):
Profile: ${input.profileText || '(sparse)'}
Onboarding answers (who they are AND what they want in a partner): ${input.onboardingText || '(sparse)'}
Verified proof categories on file: ${input.proofCategories.join(', ') || 'none'}

Produce:
1. attributes — for EACH dimension id, the CLAIMED level 0–100 of how much of that quality THIS USER brings, judged from their own profile/answers. This is the claim; do NOT discount for lack of proof (proof is handled separately). Be calibrated: 50 is average, 80+ is a clear standout, use the full range. If there is no evidence for a dimension, give a neutral 40–55, not 0.
2. weights — for EACH dimension id, how much THIS USER cares about that quality WHEN EVALUATING A PARTNER, inferred from what they say they're looking for / their dealbreakers. Raw non-negative numbers (they will be normalised to sum to 1). Sensitive dimensions (faith, nationality, ethnicity, looks) are allowed here as personal preferences.

Respond with ONLY valid JSON (no markdown, no code fences):
{"attributes":{${ALL_DIMENSION_IDS.map((d) => `"${d}":<int>`).join(',')}},"weights":{${ALL_DIMENSION_IDS.map((d) => `"${d}":<number>`).join(',')}}}`;
}

function clampLevel(n: unknown): number {
	const x = Number(n);
	if (!isFinite(x)) return 50;
	return Math.max(0, Math.min(100, Math.round(x)));
}

async function buildLLMVectors(input: BuilderInput): Promise<LLMVectors> {
	// Neutral fallback so the builder never throws.
	const fallback: LLMVectors = {
		attributes: Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, 50])),
		weights: Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, 1])),
	};
	try {
		const client = getClaudeClient();
		const res = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 600,
			messages: [{ role: 'user', content: buildVectorPrompt(input) }],
		});
		const block = res.content[0];
		const raw = block.type === 'text' ? block.text.trim() : '{}';
		const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
		const p = JSON.parse(cleaned);
		const attributes: Record<string, number> = {};
		const weights: Record<string, number> = {};
		for (const d of ALL_DIMENSION_IDS) {
			attributes[d] = clampLevel(p.attributes?.[d]);
			const w = Number(p.weights?.[d]);
			weights[d] = isFinite(w) && w >= 0 ? w : 0;
		}
		return { attributes, weights };
	} catch (e) {
		console.warn('buildLLMVectors failed (non-fatal):', e);
		return fallback;
	}
}

/** Normalise a raw weight map to sum to 1 over all dims. Falls back to balanced. */
export function normaliseWeights(raw: Record<string, number>): Record<string, number> {
	const total = ALL_DIMENSION_IDS.reduce((s, d) => s + Math.max(0, raw[d] ?? 0), 0);
	if (total <= 0) {
		const eq = 1 / ALL_DIMENSION_IDS.length;
		return Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, Number(eq.toFixed(4))]));
	}
	return Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, Number((Math.max(0, raw[d] ?? 0) / total).toFixed(4))]));
}

// ── Public API ──────────────────────────────────────────────────────────────────

export interface UserVectors {
	userId: string;
	attributes: Record<string, number>;
	confidence: Record<string, number>;
	weights: Record<string, number>;
	weightsSource: 'explicit' | 'extracted' | 'balanced';
	provenance: Record<string, unknown>;
	city: string | null;
}

/**
 * Compute (without persisting) a user's three vectors. Confidence is deterministic
 * from the proof record; attributes + weights come from the single LLM call.
 * If the user already has an EXPLICIT weight vector stored, that is preserved
 * (the explicit onboarding step is authoritative over LLM extraction).
 */
export async function computeUserVectors(userId: string): Promise<UserVectors | null> {
	const db = getSupabase() as any;
	const input = await gatherInput(db, userId);
	if (!input) return null;

	const confidence = buildConfidence(input.strength);
	const llm = await buildLLMVectors(input);

	// §6c/§6d: when the user stated an income, the financial attribute is set by the
	// DETERMINISTIC city-calibrated curve — never the LLM's eyeballed guess. This is
	// reproducible, auditable, and not gameable. Confidence still comes from proof.
	let financialFromCurve = false;
	if (input.incomeLPA != null) {
		llm.attributes.financial = incomeToV(input.incomeLPA, input.city);
		financialFromCurve = true;
	}

	// Preserve an explicit weight vector if the user set one.
	const { data: existing } = await db
		.from('vv_user_vectors')
		.select('weights, weights_source')
		.eq('user_id', userId).maybeSingle();

	let weights: Record<string, number>;
	let weightsSource: UserVectors['weightsSource'];
	if (existing?.weights_source === 'explicit' && existing.weights && Object.keys(existing.weights).length) {
		weights = existing.weights;
		weightsSource = 'explicit';
	} else {
		weights = normaliseWeights(llm.weights);
		weightsSource = 'extracted';
	}

	return {
		userId,
		attributes: llm.attributes,
		confidence,
		weights,
		weightsSource,
		provenance: {
			proofCategories: input.proofCategories,
			photoCount: input.photoCount,
			proofStrength: input.strength,
			builtFrom: input.profileText ? 'profile+onboarding' : 'sparse',
			incomeLPA: input.incomeLPA,
			financialFromCurve,
		},
		city: input.city,
	};
}

/** Compute + PERSIST a user's vectors to vv_user_vectors. Never throws. */
export async function buildAndStoreUserVectors(userId: string): Promise<UserVectors | null> {
	try {
		const v = await computeUserVectors(userId);
		if (!v) return null;
		const db = getSupabase() as any;
		await db.from('vv_user_vectors').upsert({
			user_id: v.userId,
			attributes: v.attributes,
			confidence: v.confidence,
			weights: v.weights,
			weights_source: v.weightsSource,
			provenance: v.provenance,
			builder_version: VECTOR_BUILDER_VERSION,
			city: v.city,
			built_at: new Date().toISOString(),
		}, { onConflict: 'user_id' });
		return v;
	} catch (e) {
		console.warn('buildAndStoreUserVectors failed (non-fatal):', e);
		return null;
	}
}

/**
 * Backfill vectors for all real (non-seed) users, or a supplied id list. One LLM
 * call per user, run sequentially to stay well under rate limits. Shadow-only;
 * safe to re-run. Returns per-user status for the admin diff.
 */
export async function runVectorBackfill(opts: { userIds?: string[]; includeSeed?: boolean } = {}): Promise<{
	built: number;
	failed: number;
	results: Array<{ userId: string; ok: boolean; weightsSource?: string }>;
}> {
	const db = getSupabase() as any;
	let ids = opts.userIds;
	if (!ids) {
		let q = db.from('verified_vibe_users').select('id').is('deleted_at', null);
		if (!opts.includeSeed) q = q.eq('is_seed', false);
		const { data } = await q;
		ids = (data ?? []).map((r: any) => r.id);
	}
	const results: Array<{ userId: string; ok: boolean; weightsSource?: string }> = [];
	let built = 0, failed = 0;
	for (const id of ids ?? []) {
		const v = await buildAndStoreUserVectors(id);
		if (v) { built++; results.push({ userId: id, ok: true, weightsSource: v.weightsSource }); }
		else { failed++; results.push({ userId: id, ok: false }); }
	}
	return { built, failed, results };
}
