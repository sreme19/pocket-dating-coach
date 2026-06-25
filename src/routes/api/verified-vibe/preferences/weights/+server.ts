/**
 * GET  /api/verified-vibe/preferences/weights
 *   Returns the dimension taxonomy + this user's current importance ratings
 *   (0–5 per dimension) for the explicit preference-weighting step to prefill.
 *
 * POST /api/verified-vibe/preferences/weights   { importance: { <dimId>: 0..5 } }
 *   Normalises importance → preference weights w (Σ over dims = 1) and stores them
 *   on vv_user_vectors with weights_source='explicit'. The explicit step is
 *   AUTHORITATIVE over LLM-extracted weights (the vector builder preserves an
 *   explicit weight vector). Phase 0b of the two-sided weighted-value redesign.
 *
 * Auth: Bearer token (mobile + web both send the Supabase access token).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { ALL_DIMENSIONS, ALL_DIMENSION_IDS } from '$lib/verified-vibe/dimensions';

const DEFAULT_IMPORTANCE = 2; // neutral (0–5 scale) — balanced cold-start (§13b)
const MAX_IMPORTANCE = 5;

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

/** importance (0–5 per dim) → normalised weights summing to 1 over all dims. */
function importanceToWeights(importance: Record<string, number>): Record<string, number> {
	const clamped: Record<string, number> = {};
	for (const id of ALL_DIMENSION_IDS) {
		const raw = Number(importance[id]);
		clamped[id] = isFinite(raw) ? Math.max(0, Math.min(MAX_IMPORTANCE, raw)) : DEFAULT_IMPORTANCE;
	}
	const total = ALL_DIMENSION_IDS.reduce((s, id) => s + clamped[id], 0);
	if (total <= 0) {
		const eq = 1 / ALL_DIMENSION_IDS.length;
		return Object.fromEntries(ALL_DIMENSION_IDS.map((id) => [id, Number(eq.toFixed(4))]));
	}
	return Object.fromEntries(ALL_DIMENSION_IDS.map((id) => [id, Number((clamped[id] / total).toFixed(4))]));
}

export const GET: RequestHandler = async ({ request }) => {
	const userId = await getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		const db = getSupabase() as any;
		const { data } = await db
			.from('vv_user_vectors')
			.select('weights, weights_source, provenance')
			.eq('user_id', userId)
			.maybeSingle();
		const stored = (data?.provenance?.explicitImportance ?? {}) as Record<string, number>;
		const importance = Object.fromEntries(
			ALL_DIMENSION_IDS.map((id) => [id, stored[id] ?? DEFAULT_IMPORTANCE]),
		);
		return json({
			dimensions: ALL_DIMENSIONS.map((d) => ({ id: d.id, label: d.label, cls: d.cls, blurb: d.blurb })),
			importance,
			weightsSource: data?.weights_source ?? null,
			maxImportance: MAX_IMPORTANCE,
		});
	} catch (e) {
		console.error('[preferences/weights GET]', e);
		return json({ error: 'Failed to load preferences' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = await getUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		const body = (await request.json()) as { importance?: Record<string, number> };
		if (!body.importance || typeof body.importance !== 'object') {
			return json({ error: 'importance map required' }, { status: 400 });
		}
		const weights = importanceToWeights(body.importance);
		const importanceClean: Record<string, number> = {};
		for (const id of ALL_DIMENSION_IDS) {
			const raw = Number(body.importance[id]);
			importanceClean[id] = isFinite(raw) ? Math.max(0, Math.min(MAX_IMPORTANCE, raw)) : DEFAULT_IMPORTANCE;
		}

		const db = getSupabase() as any;
		// Read-modify-write provenance so we don't clobber the builder's provenance.
		const { data: existing } = await db
			.from('vv_user_vectors')
			.select('provenance')
			.eq('user_id', userId)
			.maybeSingle();
		const provenance = { ...(existing?.provenance ?? {}), explicitImportance: importanceClean };

		await db.from('vv_user_vectors').upsert({
			user_id: userId,
			weights,
			weights_source: 'explicit',
			provenance,
		}, { onConflict: 'user_id' });

		return json({ ok: true, weights, weightsSource: 'explicit' });
	} catch (e) {
		console.error('[preferences/weights POST]', e);
		return json({ error: 'Failed to save preferences' }, { status: 500 });
	}
};
