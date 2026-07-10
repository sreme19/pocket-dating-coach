import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { getTrustScoreBand } from '$lib/server/pool-registry';

/**
 * Hand-off timeout sweep (spec §K).
 *
 * When AI Bestie wraps up her checklist she hands off to the woman and the man's
 * chat freezes, waiting for her to step in. If she never does, a MATCHMAKER match
 * is auto-unmatched after HANDOFF_TIMEOUT_HOURS. This is Matchmaker-only: notice_me
 * matches (and legacy/unknown source) are never auto-unmatched, because there the
 * woman already chose to engage.
 *
 * "She stepped in" = she sent her own reply, which flips ai_bestie_active=false. So
 * a match still `ai_bestie_active=true` with a `wrapped` checklist older than the
 * cutoff is one she never answered.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. Vercel Cron sends a GET with this
 * header automatically when CRON_SECRET is set. See vercel.json for the schedule.
 */

const HANDOFF_TIMEOUT_HOURS = 24;

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

async function sweep() {
	const supabase = getSupabase() as any;
	const cutoff = new Date(Date.now() - HANDOFF_TIMEOUT_HOURS * 3_600_000).toISOString();

	// Matchmaker matches where Bestie wrapped up but the woman never stepped in
	// (ai_bestie_active still true) and the wrap-up is older than the cutoff.
	// wrapped_at is an ISO-8601 UTC string, so a lexicographic < is a real time <.
	const { data: expired, error } = await supabase
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id')
		.eq('source', 'matchmaker')
		.eq('status', 'mutual')
		.eq('ai_bestie_active', true)
		.eq('bestie_checklist->>status', 'wrapped')
		.lt('bestie_checklist->>wrapped_at', cutoff);

	if (error) throw error;
	if (!expired?.length) return { unmatched: 0 };

	const ids = expired.map((m: any) => m.id);

	// Soft-delete: mark 'unmatched' and turn Bestie off. Row + messages are kept.
	await supabase
		.from('verified_vibe_matches')
		.update({ status: 'unmatched', ai_bestie_active: false })
		.in('id', ids);

	await recordOutcomes(supabase, expired);

	return { unmatched: ids.length };
}

/**
 * Best-effort analytics: one system-initiated 'unmatched' outcome signal per match,
 * so the Matchmaker feedback loop learns that these pairings stalled at hand-off.
 * Non-fatal — never let signal recording undo the unmatch.
 */
async function recordOutcomes(
	supabase: any,
	matches: Array<{ id: string; user1_id: string; user2_id: string }>
): Promise<void> {
	try {
		const userIds = Array.from(new Set(matches.flatMap((m) => [m.user1_id, m.user2_id])));
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender, archetype, trust_score')
			.in('id', userIds);
		const byId = new Map<string, any>((users ?? []).map((u: any) => [u.id, u]));

		const rows: any[] = [];
		const at = new Date().toISOString();
		for (const m of matches) {
			const a = byId.get(m.user1_id);
			const b = byId.get(m.user2_id);
			if (!a || !b) continue;
			const male = a.gender === 'man' ? a : b.gender === 'man' ? b : null;
			const female = a.gender === 'woman' ? a : b.gender === 'woman' ? b : null;
			if (!male || !female) continue; // same-gender pairs aren't tracked in v1
			rows.push({
				match_id: m.id,
				male_user_id: male.id,
				female_user_id: female.id,
				outcome: 'unmatched',
				initiated_by_gender: 'system',
				male_archetype: male.archetype,
				female_archetype: female.archetype,
				male_trust_band: getTrustScoreBand(male.trust_score ?? 0),
				outcome_at: at
			});
		}
		if (rows.length) await supabase.from('vv_match_outcome_signals').insert(rows);
	} catch (e) {
		console.error('[handoff-timeout] outcome recording failed (non-fatal):', e);
	}
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const result = await sweep();
		return json({ success: true, ...result });
	} catch (err) {
		console.error('[cron/handoff-timeout] failed:', err);
		return json(
			{ error: 'sweep failed', details: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};

export const GET = handle;
export const POST = handle;
