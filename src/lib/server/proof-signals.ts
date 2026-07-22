/**
 * proof-signals.ts — single read-side for "what has this user verifiably proven?"
 * plus the Bestie-driven in-chat proof-request state machine (spec §3 Step 3).
 *
 * READ SIDE
 * Verified proofs live in TWO places, written by different eras of the product:
 *   - user_master_profile.data.verifiedProofs — the full /proof-upload pipeline
 *     (Vision insights, face-match, anti-forgery, ID gate). Canonical.
 *   - user_artifacts — the legacy in-chat 📎 upload (claim_tag + points only).
 *     Read-only now; no new writers.
 * Every Bestie/Wingman context loader should read proofs through
 * loadProofSignals() so both sources stay visible and can never drift.
 *
 * PROOF-REQUEST STATE (verified_vibe_matches.proof_request, jsonb)
 * Bestie asks the man for a proof to close a gap; the category comes from HER
 * question, never a picker. Product rules (decided 2026-07-06):
 *   - pending / failed_attempt → request is ACTIVE: his 📎 button is visible.
 *   - failed_attempt is NOT a refusal — Bestie may warmly encourage a retry.
 *   - refused → he declined; drop it, never re-ask. Conversational context
 *     ONLY — must never feed trust or match scoring.
 *   - fulfilled → verified proof landed; Bestie acknowledges once → closed.
 */

export const PROOF_REQUEST_CATEGORIES = [
	'linkedin',
	'travel',
	'discipline',
	'lifestyle',
	'social_proof',
	'assets',
	'wealth',
	'spending',
] as const;
export type ProofRequestCategory = (typeof PROOF_REQUEST_CATEGORIES)[number];

/**
 * Priority order for what to invite first when several gaps are open — highest-
 * leverage and lowest-friction categories lead. Career (linkedin) and the photo
 * categories need no ID gate; wealth/spending/assets do, so they trail.
 */
export const PROOF_CATEGORY_PRIORITY: ProofRequestCategory[] = [
	'linkedin',
	'discipline',
	'travel',
	'lifestyle',
	'social_proof',
	'assets',
	'wealth',
	'spending',
];

/**
 * Document / ID-gated categories: proving these needs a name-bearing DOCUMENT
 * (income statement, payslip, receipts, vehicle/property ownership papers) matched
 * against a verified government ID — NOT a picture the man can just snap and upload.
 *
 * The in-chat 📎 "Verify" surface is deliberately picture-upload only (bootstrap
 * decision 2026-07-22: keep it frictionless — pictures only in chat), so the Bestie
 * NEVER requests these categories there. They remain fully available on the dedicated
 * /proof-upload screen, which has the ID-gate flow they need. See
 * `IN_CHAT_PROOF_CATEGORIES` for the set the chat surface may ask for.
 */
export const DOCUMENT_PROOF_CATEGORIES = ['wealth', 'assets', 'spending'] as const;

/** True when a category needs a document + ID gate rather than a picture upload. */
export function isDocumentProofCategory(c: string): boolean {
	return (DOCUMENT_PROOF_CATEGORIES as readonly string[]).includes(c);
}

/** Picture-uploadable categories the in-chat 📎 Verify surface may request. */
export const IN_CHAT_PROOF_CATEGORIES: ProofRequestCategory[] =
	PROOF_REQUEST_CATEGORIES.filter((c) => !isDocumentProofCategory(c));

/** Friendly labels for prompts + UI copy. */
export const PROOF_CATEGORY_LABELS: Record<ProofRequestCategory, string> = {
	linkedin: 'career (a LinkedIn screenshot, or your résumé)',
	travel: 'travel (passport stamps, boarding passes, trip photos with you in them)',
	discipline: 'fitness / discipline (you at the gym, training, sport)',
	lifestyle: 'lifestyle (photos of you living it — dining, events, experiences)',
	social_proof: 'social life (you with friends, at events)',
	assets: 'assets (ownership papers for your car or other big things — needs verified ID)',
	wealth: 'wealth (bank statement, payslip — needs verified ID)',
	spending: 'spending (receipts, bills — needs verified ID)',
};

export type ProofRequestStatus =
	| 'pending'
	| 'failed_attempt'
	| 'refused'
	| 'fulfilled'
	| 'closed';

export interface ProofRequestState {
	category: ProofRequestCategory;
	status: ProofRequestStatus;
	asked_at: string;
	attempts: number;
	resolved_at?: string | null;
	history?: Array<{ category: string; outcome: 'refused' | 'fulfilled'; at: string }>;
}

/** Request is active = the man's proof-upload button should be visible. */
export function isProofRequestActive(state: ProofRequestState | null | undefined): boolean {
	return state?.status === 'pending' || state?.status === 'failed_attempt';
}

/** Categories Bestie must never ask for again on this match (refused ones). */
export function refusedCategories(state: ProofRequestState | null | undefined): string[] {
	const fromHistory = (state?.history ?? [])
		.filter((h) => h.outcome === 'refused')
		.map((h) => h.category);
	if (state?.status === 'refused') fromHistory.push(state.category);
	return Array.from(new Set(fromHistory));
}

/** Every category already asked on this match (any outcome) — one ask per gap. */
export function askedCategories(state: ProofRequestState | null | undefined): string[] {
	const cats = (state?.history ?? []).map((h) => h.category);
	if (state?.category) cats.push(state.category);
	return Array.from(new Set(cats));
}

// ── Read side ────────────────────────────────────────────────────────────────

/** Legacy user_artifacts claim tags → pipeline categories. */
const LEGACY_TAG_TO_CATEGORY: Record<string, ProofRequestCategory> = {
	wealthy: 'wealth',
	well_traveled: 'travel',
	fitness: 'discipline',
	general: 'lifestyle',
};

export interface ProofSignals {
	/** Pipeline categories with at least one verified proof (legacy tags mapped). */
	categories: string[];
	/** Human-readable per-proof lines for prompt context. */
	lines: string[];
	/** Most recent verified_at across pipeline proofs (ISO), or null. */
	latestVerifiedAt: string | null;
}

/**
 * Merge both proof sources into one signals view. Read-only, never throws —
 * a failure on either source degrades to whatever the other one had.
 */
export async function loadProofSignals(supabase: any, userId: string): Promise<ProofSignals> {
	const [masterRes, artifactsRes] = await Promise.all([
		supabase
			.from('user_master_profile')
			.select('data')
			.eq('user_id', userId)
			.maybeSingle()
			.then((r: any) => r.data)
			.catch(() => null),
		supabase
			.from('user_artifacts')
			.select('claim_tag, trust_points')
			.eq('user_id', userId)
			.then((r: any) => r.data)
			.catch(() => null),
	]);

	const categories = new Set<string>();
	const lines: string[] = [];
	let latestVerifiedAt: string | null = null;

	// Pipeline proofs (rich): category + aggregated line + insight labels.
	const verifiedProofs: any[] = Array.isArray(masterRes?.data?.verifiedProofs)
		? masterRes.data.verifiedProofs
		: [];
	for (const p of verifiedProofs) {
		if (!p?.category) continue;
		categories.add(String(p.category));
		const labels = (Array.isArray(p.insights) ? p.insights : [])
			.map((i: any) => i?.label)
			.filter(Boolean)
			.slice(0, 4);
		const detail = p.aggregated
			? `"${p.aggregated}"`
			: labels.length
				? labels.join(', ')
				: 'verified';
		lines.push(`${p.category}: ${detail}${p.aggregated && labels.length ? ` (${labels.join(', ')})` : ''}`);
		if (typeof p.verified_at === 'string' && (!latestVerifiedAt || p.verified_at > latestVerifiedAt)) {
			latestVerifiedAt = p.verified_at;
		}
	}

	// Legacy artifacts (coarse): tag counts, mapped to pipeline categories.
	const tagCounts: Record<string, number> = {};
	for (const a of artifactsRes ?? []) {
		if (a?.claim_tag) tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
	}
	for (const [tag, count] of Object.entries(tagCounts)) {
		const mapped = LEGACY_TAG_TO_CATEGORY[tag] ?? tag;
		// Don't duplicate a category the pipeline already covers with richer detail.
		if (categories.has(mapped)) continue;
		categories.add(mapped);
		lines.push(`${mapped}: proof uploaded${count > 1 ? ` (×${count})` : ''}`);
	}

	return { categories: Array.from(categories), lines, latestVerifiedAt };
}

/**
 * One prompt-ready sentence block about the man's verified proofs, or '' when
 * he has none. Shared phrasing for the text Bestie, voice Bestie and advisor.
 */
export function formatProofContext(matchName: string, signals: ProofSignals): string {
	if (signals.lines.length === 0) return '';
	return `\n\n${matchName} has VERIFIED proofs on his profile (real, checked evidence — acknowledge positively when relevant, never re-ask for these):\n${signals.lines.map((l) => `- ${l}`).join('\n')}`;
}
