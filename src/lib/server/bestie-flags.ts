/**
 * AI Bestie profile-flag generation.
 *
 * Analyses a MAN's profile for orange/red flags — inconsistencies between what
 * the profile claims and what was actually verified. The flags depend ONLY on
 * the man's data (not on who is viewing), so they are generated once per
 * profile-data change and cached inside user_master_profile.data.bestieFlags.
 *
 * Viewer gating (must be a logged-in woman, or an admin previewing) lives in the
 * route handlers that call this — this module is purely the data → flags step,
 * shared by the member API (/api/verified-vibe/bestie-profile-flags) and the
 * admin public-view preview endpoint.
 */
import { createHash } from 'node:crypto';
import { getSupabase } from '$lib/server/supabase';
import { askClaude } from '$lib/claude';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

export type BestieFlag = { level: 'orange' | 'red'; title: string; detail: string };
type BestieFlagsCache = { hash: string; flags: BestieFlag[]; generatedAt: string };

/**
 * Generate (or return cached) AI Bestie flags for a male profile.
 * Returns [] for a missing profile or a non-male profile.
 */
export async function generateBestieFlags(profileId: string): Promise<BestieFlag[]> {
	if (!profileId) return [];
	const sb = getSupabase();

	// Load the male profile + proof data (same source as the public-profile API)
	const [{ data: profile }, { data: masterRow }] = await Promise.all([
		(sb as any)
			.from('verified_vibe_users')
			.select('id, first_name, gender, archetype, trust_score, about')
			.eq('id', profileId)
			.single(),
		(sb as any)
			.from('user_master_profile')
			.select('data')
			.eq('user_id', profileId)
			.maybeSingle(),
	]);

	if (!profile || profile.gender !== 'man') return [];

	const masterData: Record<string, unknown> = (masterRow?.data as Record<string, unknown>) ?? {};
	const verifiedProofs: Array<Record<string, unknown>> = Array.isArray(masterData.verifiedProofs)
		? (masterData.verifiedProofs as Array<Record<string, unknown>>)
		: [];

	const archetypeDef = ARCHETYPES[profile.archetype as keyof typeof ARCHETYPES];
	const archetypeName = archetypeDef?.name ?? profile.archetype ?? 'Unknown';
	const archetypeTag = (archetypeDef as any)?.tag ?? '';

	const proofByCategory = (cat: string) => verifiedProofs.find((p) => p.category === cat) ?? null;

	const careerProof = proofByCategory('linkedin');
	const lifestyleProof = proofByCategory('lifestyle');
	const disciplineProof = proofByCategory('discipline');
	const socialProof = proofByCategory('social_proof');
	const assetsProof = proofByCategory('assets');
	const wealthProof = proofByCategory('wealth');

	const travelLocations: string[] = Array.from(
		new Set(verifiedProofs.flatMap((p) => (Array.isArray(p.locations) ? (p.locations as string[]) : [])))
	).filter(Boolean);

	const verifiedSummary = {
		archetypeName,
		archetypeTag,
		trustScore: profile.trust_score ?? 0,
		about: profile.about ?? '',
		totalVerifiedProofCategories: verifiedProofs.length,
		career: careerProof
			? {
					aggregated: careerProof.aggregated ?? '',
					insights: ((careerProof.insights as Array<{ label: string }>) ?? []).map((i) => i.label),
				}
			: null,
		lifestyle: lifestyleProof
			? {
					aggregated: lifestyleProof.aggregated ?? '',
					insights: ((lifestyleProof.insights as Array<{ label: string }>) ?? []).map((i) => i.label),
				}
			: null,
		health: disciplineProof ? { aggregated: disciplineProof.aggregated ?? '' } : null,
		social: socialProof ? { aggregated: socialProof.aggregated ?? '' } : null,
		assets: assetsProof ? { aggregated: assetsProof.aggregated ?? '' } : null,
		wealth: wealthProof ? { aggregated: wealthProof.aggregated ?? '' } : null,
		travelLocations,
		travelLocationCount: travelLocations.length,
	};

	// Cache key on the exact inputs that feed Claude — regenerate when they change.
	const inputHash = createHash('sha256').update(JSON.stringify(verifiedSummary)).digest('hex');

	const cached = masterData.bestieFlags as BestieFlagsCache | undefined;
	if (cached && cached.hash === inputHash && Array.isArray(cached.flags)) {
		return cached.flags;
	}

	const systemPrompt = `You are "Bestie", a sharp, caring AI advisor for women on Verified Vibe — a dating app that verifies men's lifestyles.

Your job: given a man's profile summary, identify 2–4 specific orange or red flags — potential inconsistencies or gaps between what the profile implies and what was actually verified.

Be specific and grounded in the data. Don't invent problems — only flag things that have concrete evidence in the numbers or missing verifications.

Rules:
- If career/lifestyle/health/social/assets/wealth proof field is null → it was NOT verified at all
- travelLocationCount shows how many distinct destinations were actually verified from uploads
- trust_score under 40 is low for someone claiming a high-status lifestyle
- totalVerifiedProofCategories = 0 means nothing has been verified yet

Examples of good flags:
- Archetype is "Multi-continent globe-trotter" but travelLocationCount is 0 or 1 → orange flag
- Claims senior role in bio but career is null (no LinkedIn uploaded) → red flag
- Trust score under 30 for a high-lifestyle-claim archetype → orange flag
- lifestyle proof is null but archetype implies globe-trotter or active lifestyle → orange flag

CRITICAL — writing rules for the detail field:
- Write in plain English for a female dating app user. NEVER mention raw field names like totalVerifiedProofCategories, travelLocationCount, trust_score, archetype, etc.
- Instead of "totalVerifiedProofCategories is 0" say "no proof has been uploaded yet"
- Instead of "travelLocationCount is 0" say "no trips have been verified"
- Instead of "wealth verification is null" say "wealth hasn't been verified"
- Instead of "trust_score is 75" say "his trust score is 75"
- Keep it conversational, specific, and under 25 words.

Return ONLY valid JSON — no markdown, no explanation outside the JSON.
Format:
{"flags":[{"level":"orange","title":"Short title","detail":"One specific sentence explaining what was claimed vs what was verified."}]}

Use "orange" for unverified claims / gaps. Use "red" for clear contradictions or missing critical proof.
Max 4 flags. If genuinely nothing is suspicious, return {"flags":[]}.`;

	const userMessage = `Analyse this profile for inconsistencies:\n${JSON.stringify(verifiedSummary, null, 2)}`;

	const raw = await askClaude(systemPrompt, userMessage);

	// Strip possible markdown fences (Claude 4.x wraps JSON in ```json blocks)
	const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
	let flags: BestieFlag[] = [];
	let parsedOk = false;
	try {
		const parsed = JSON.parse(cleaned) as { flags: BestieFlag[] };
		flags = parsed.flags ?? [];
		parsedOk = true;
	} catch {
		flags = [];
	}

	// Persist back into the existing master-profile JSONB blob (no migration needed).
	// Only cache successful parses so a transient malformed response isn't frozen in.
	if (parsedOk && masterRow) {
		const nextData = {
			...masterData,
			bestieFlags: { hash: inputHash, flags, generatedAt: new Date().toISOString() },
		};
		const { error: updateErr } = await (sb as any)
			.from('user_master_profile')
			.update({ data: nextData })
			.eq('user_id', profileId);
		if (updateErr) console.error('bestie-flags cache write failed:', updateErr);
	}

	return flags;
}
