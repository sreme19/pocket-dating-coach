import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { generateAndSendBestieReply } from '$lib/server/bestie-responder';

/**
 * Silence re-engage sweep.
 *
 * Covers the gap left when the woman steps in and takes a thread over herself
 * (chat/send flips ai_bestie_active=false on her first direct reply — see
 * that route's comment). From then on nothing auto-replies for him: if she
 * then goes quiet, he can be left waiting indefinitely. This sweep finds
 * exactly that state — status='mutual', ai_bestie_active=false, and the last
 * message is his, sitting unanswered for REENGAGE_HOURS — flips Bestie back
 * on and has her reply to keep the conversation alive.
 *
 * Self-limiting by design: once Bestie (or she) replies, the last message is
 * no longer his, so the next run's `.eq('ai_bestie_active', false)` filter or
 * sender check naturally excludes the match — no separate dedup table needed.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. See vercel.json for the schedule.
 */

const REENGAGE_HOURS = 2;

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

async function sweep() {
	const supabase = getSupabase() as any;
	const cutoff = new Date(Date.now() - REENGAGE_HOURS * 3_600_000).toISOString();

	const { data: candidates, error } = await supabase
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id')
		.eq('status', 'mutual')
		.eq('ai_bestie_active', false);
	if (error) throw error;

	let reengaged = 0;
	for (const m of candidates ?? []) {
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender')
			.in('id', [m.user1_id, m.user2_id]);
		const woman = (users ?? []).find((u: any) => u.gender === 'woman');
		const man = (users ?? []).find((u: any) => u.gender === 'man');
		if (!woman || !man) continue; // only the woman-owned Bestie flow is covered today

		const { data: lastMsg } = await supabase
			.from('verified_vibe_messages')
			.select('id, sender_id, content, created_at')
			.eq('match_id', m.id)
			.order('created_at', { ascending: false, nullsFirst: false })
			.limit(1)
			.maybeSingle();
		if (!lastMsg) continue;
		if (lastMsg.sender_id !== man.id) continue; // she (or Bestie) already has the last word
		if (lastMsg.created_at > cutoff) continue; // not stale enough yet

		await supabase.from('verified_vibe_matches').update({ ai_bestie_active: true }).eq('id', m.id);
		try {
			await generateAndSendBestieReply(woman.id, m.id, lastMsg.id, lastMsg.content, lastMsg.created_at);
			reengaged++;
		} catch (e) {
			console.error('[cron/bestie-reengage] reply generation failed (non-fatal):', e);
		}
	}

	return { checked: candidates?.length ?? 0, reengaged };
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const result = await sweep();
		return json({ success: true, ...result });
	} catch (err) {
		console.error('[cron/bestie-reengage] failed:', err);
		return json(
			{ error: 'sweep failed', details: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};

export const GET = handle;
export const POST = handle;
