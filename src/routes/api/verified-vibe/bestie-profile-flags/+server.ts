/**
 * POST /api/verified-vibe/bestie-profile-flags
 *
 * AI Bestie profile analysis — only for authenticated female users viewing a male profile.
 * Returns orange/red flags based on inconsistencies between what the profile claims and
 * what was actually verified (e.g., "globe-trotter" label but only 1 travel location uploaded).
 *
 * Body: { profileId: string }
 * Response: { flags: Array<{ level: 'orange' | 'red', title: string, detail: string }> }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { askClaude } from '$lib/claude';
import { ARCHETYPES } from '$lib/verified-vibe/constants';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Auth — only logged-in female users
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.replace('Bearer ', '');
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const sb = getSupabase();
		const { data: { user: viewer }, error: authErr } = await sb.auth.getUser(token);
		if (authErr || !viewer) return json({ error: 'Unauthorized' }, { status: 401 });

		// Check viewer is female
		const { data: viewerProfile } = await (sb as any)
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', viewer.id)
			.single();
		if (viewerProfile?.gender !== 'woman') {
			return json({ flags: [] });
		}

		const body = await request.json() as { profileId?: string };
		const profileId = body.profileId;
		if (!profileId) return json({ error: 'profileId required' }, { status: 400 });

		// Load the male profile
		const { data: profile } = await (sb as any)
			.from('verified_vibe_users')
			.select('id, first_name, gender, archetype, trust_score, about')
			.eq('id', profileId)
			.single();

		if (!profile || profile.gender !== 'man') return json({ flags: [] });

		// Load verified proof uploads
		const { data: proofs } = await (sb as any)
			.from('verified_vibe_proof_uploads')
			.select('category, aggregated, insights, locations, assets')
			.eq('user_id', profileId);

		const proofList: Array<Record<string, unknown>> = proofs ?? [];

		// Load onboarding answers (travel, lifestyle claims)
		const { data: onboarding } = await (sb as any)
			.from('vv_onboarding_answers')
			.select('answers')
			.eq('user_id', profileId)
			.single();
		const onboardingAnswers: Record<string, unknown> = (onboarding?.answers as Record<string, unknown>) ?? {};

		// Gather archetype description
		const archetypeDef = ARCHETYPES[profile.archetype as keyof typeof ARCHETYPES];
		const archetypeName = archetypeDef?.name ?? profile.archetype ?? 'Unknown';

		// Summarise what was actually verified
		const careerProof = proofList.find(p => p.category === 'linkedin');
		const lifestyleProof = proofList.find(p => p.category === 'lifestyle');
		const disciplineProof = proofList.find(p => p.category === 'discipline');
		const socialProof = proofList.find(p => p.category === 'social_proof');
		const assetsProof = proofList.find(p => p.category === 'assets');
		const wealthProof = proofList.find(p => p.category === 'wealth');

		const travelLocations: string[] = Array.from(new Set(
			proofList.flatMap(p => Array.isArray(p.locations) ? p.locations as string[] : [])
		)).filter(Boolean);

		const verifiedSummary = {
			archetypeName,
			trustScore: profile.trust_score ?? 0,
			about: profile.about ?? '',
			career: careerProof ? {
				aggregated: careerProof.aggregated ?? '',
				insights: (careerProof.insights as Array<{ label: string }> ?? []).map(i => i.label),
			} : null,
			lifestyle: lifestyleProof ? {
				aggregated: lifestyleProof.aggregated ?? '',
				insights: (lifestyleProof.insights as Array<{ label: string }> ?? []).map(i => i.label),
			} : null,
			health: disciplineProof ? {
				aggregated: disciplineProof.aggregated ?? '',
			} : null,
			social: socialProof ? {
				aggregated: socialProof.aggregated ?? '',
			} : null,
			assets: assetsProof ? {
				aggregated: assetsProof.aggregated ?? '',
			} : null,
			wealth: wealthProof ? {
				aggregated: wealthProof.aggregated ?? '',
			} : null,
			travelLocations,
			travelLocationCount: travelLocations.length,
			onboardingHighlights: Object.entries(onboardingAnswers)
				.filter(([k]) => k.includes('travel') || k.includes('lifestyle') || k.includes('career') || k.includes('income'))
				.slice(0, 10)
				.map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
		};

		const systemPrompt = `You are "Bestie", a sharp, caring AI advisor for women on Verified Vibe — a dating app that verifies men's lifestyles.

Your job: given a man's profile summary, identify 2–4 specific orange or red flags — potential inconsistencies or gaps between what the profile implies and what was actually verified.

Be specific and grounded in the data. Don't invent problems — only flag things that have concrete evidence in the numbers or missing verifications.

Examples of good flags:
- Archetype is "Multi-continent globe-trotter" but only 1 travel location was verified from uploads → orange flag
- Claims "successful entrepreneur" in bio but no LinkedIn/career proof was uploaded → red flag
- Trust score is very low (under 30) for someone claiming a high-status lifestyle → orange flag
- No health/fitness proof but archetype implies active lifestyle → orange flag

Return ONLY valid JSON — no markdown, no explanation outside the JSON.
Format:
{"flags":[{"level":"orange","title":"Short title","detail":"One specific sentence explaining what was claimed vs what was verified."}]}

Use "orange" for unverified claims / gaps. Use "red" for clear contradictions or missing critical proof for a major lifestyle claim.
Keep each detail under 25 words. Max 4 flags. If no real flags exist, return {"flags":[]}.`;

		const userMessage = `Analyse this profile for inconsistencies:\n${JSON.stringify(verifiedSummary, null, 2)}`;

		const raw = await askClaude(systemPrompt, userMessage);

		// Strip possible markdown fences (Claude 4.x wraps JSON in ```json blocks)
		const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
		let flags: Array<{ level: 'orange' | 'red'; title: string; detail: string }> = [];
		try {
			const parsed = JSON.parse(cleaned) as { flags: typeof flags };
			flags = parsed.flags ?? [];
		} catch {
			flags = [];
		}

		return json({ flags });
	} catch (err) {
		console.error('bestie-profile-flags error:', err);
		return json({ flags: [] });
	}
};
