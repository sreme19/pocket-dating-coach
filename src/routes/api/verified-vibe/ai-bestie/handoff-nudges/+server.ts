import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * GET /api/verified-vibe/ai-bestie/handoff-nudges
 *
 * Surfaces the AI Bestie's proactive hand-off nudge (spec B2, point 4) in her
 * advisor thread. The timeout cron writes these as ai_assistant_greetings rows
 * tagged 'handoff_nudge'. Here we return the most RECENT one that is still
 * relevant — i.e. the match it refers to is still awaiting her (mutual + Bestie
 * active + checklist wrapped). Once she steps in (Bestie flips off) or it expires,
 * the nudge self-clears, so a stale "act now" never lingers.
 *
 * Auth: Bearer token. Response: { nudge: { id, content, matchId, createdAt } | null }.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization') ?? '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const { createClient } = await import('@supabase/supabase-js');
		const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const { data: { user }, error: userError } = await userClient.auth.getUser();
		if (userError || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

		const supabase = getSupabase() as any;
		const since = new Date(Date.now() - 48 * 3_600_000).toISOString();

		const { data: greetings } = await supabase
			.from('ai_assistant_greetings')
			.select('id, content, topic_tags, created_at')
			.eq('user_id', user.id)
			.eq('assistant_type', 'bestie')
			.contains('topic_tags', ['handoff_nudge'])
			.gt('created_at', since)
			.order('created_at', { ascending: false })
			.limit(5);

		if (!greetings?.length) return json({ nudge: null });

		// Keep only nudges whose match is STILL awaiting her, newest first.
		for (const g of greetings as any[]) {
			const matchId = (g.topic_tags as string[]).find((t) => UUID_RE.test(t));
			if (!matchId) continue;
			const { data: m } = await supabase
				.from('verified_vibe_matches')
				.select('status, ai_bestie_active, bestie_checklist')
				.eq('id', matchId)
				.maybeSingle();
			const stillAwaiting =
				m &&
				m.status === 'mutual' &&
				m.ai_bestie_active === true &&
				(m.bestie_checklist as any)?.status === 'wrapped';
			if (stillAwaiting) {
				return json({ nudge: { id: g.id, content: g.content, matchId, createdAt: g.created_at } });
			}
		}

		return json({ nudge: null });
	} catch (error) {
		console.error('handoff-nudges error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
