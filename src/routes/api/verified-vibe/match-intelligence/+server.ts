/**
 * GET /api/verified-vibe/match-intelligence?userId=xxx
 *
 * Returns the requesting user's OWN precomputed match intelligence (Standing,
 * appeal, checklist, what-if simulator) from vv_match_scores, for the "Where you
 * stand" panel in the Wingman/Bestie UI. Read-only; the server reads via the
 * service role (vv_match_scores is RLS-locked from the client key).
 *
 * Returns only the rows for this userId's own side — never another user's data.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { loadMatchIntelligence } from '$lib/server/match-intelligence';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('userId')?.trim();
		if (!userId) return json({ error: 'userId is required' }, { status: 400 });

		const matches = await loadMatchIntelligence(getSupabase(), userId);
		return json({ matches });
	} catch (err) {
		console.error('[match-intelligence] GET error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
