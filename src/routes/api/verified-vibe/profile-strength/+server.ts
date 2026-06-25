/**
 * GET /api/verified-vibe/profile-strength
 *   Returns the authenticated user's Profile Strength as a BAND + momentum +
 *   verification-upside actions — never a raw worth rank (Design §8, §17, Q21).
 *   Computed live (pure arithmetic) from the user's stored vectors in
 *   vv_user_vectors; no LLM. Phase 2 of the two-sided weighted-value redesign.
 *
 * Auth: Bearer token (mobile + web).
 *
 * NOTE: this endpoint must be deployed to PRODUCTION (main), because the Flutter
 * tester app calls the prod backend — a development-only route 404s in the app.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import {
	profileStrength,
	profileStrengthBand,
	bandProgress,
	upsidePreview,
	upsideByDimension,
	type Vec,
} from '$lib/server/vector-scoring';

async function getUserId(request: Request): Promise<string | null> {
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) return null;
	try {
		const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } },
		});
		const { data: { user } } = await client.auth.getUser();
		return user?.id ?? null;
	} catch { return null; }
}

export const GET: RequestHandler = async ({ request }) => {
	const userId = await getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		const db = getSupabase() as any;
		const { data } = await db
			.from('vv_user_vectors')
			.select('attributes, confidence')
			.eq('user_id', userId)
			.maybeSingle();

		// No vectors built yet — gentle "not ready" state, not an error.
		if (!data || !data.attributes || Object.keys(data.attributes).length === 0) {
			return json({ hasVectors: false });
		}

		const attrs = data.attributes as Vec;
		const conf = (data.confidence ?? {}) as Vec;

		const ps = profileStrength(attrs, conf);
		const progress = bandProgress(ps);
		const upside = upsidePreview(attrs, conf);
		// Top "verify this → +X standing" actions (open dims, confidence < 1).
		const actions = upsideByDimension(attrs, conf).slice(0, 3).map((a) => ({
			dimension: a.dim,
			label: a.label,
			deltaPS: a.deltaPS,
		}));

		return json({
			hasVectors: true,
			profileStrength: ps,
			band: progress.band,
			nextBand: progress.nextBand,
			pointsToNextBand: progress.pointsToNextBand,
			progressInBand: progress.progressInBand,
			verificationUpside: upside, // { psNow, psVerified, deltaPS }
			verifiedBand: profileStrengthBand(upside.psVerified),
			actions, // ranked verify-to-lift actions
		});
	} catch (e) {
		console.error('[profile-strength GET]', e);
		return json({ error: 'Failed to load profile strength' }, { status: 500 });
	}
};
