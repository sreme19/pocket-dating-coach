import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/ai-bestie/reactivate  { conversationId }
 *
 * Bring an EXPIRED match back (spec B2). Only the WOMAN can reactivate — the man
 * has no such control. Flips status 'expired' → 'mutual' so it leaves both users'
 * Inactive sections and returns to their active chats, thread history intact. He
 * KEEPS the replacement he was given (over-cap is allowed) — we never touch it.
 *
 * Re-engagement (his answer: "re-vet only if her preferences changed"):
 *   · prefs changed since wrap-up  → Bestie re-engages: ai_bestie_active=true and
 *     the checklist is cleared so the next turn re-vets against her CURRENT prefs;
 *     a warm reconnect line is posted to him.
 *   · prefs unchanged              → straight to a direct woman↔man chat
 *     (ai_bestie_active=false); a warm "she's back" line is posted.
 * Either way handoff_nudge_stage resets to 0 so a later re-handoff nudges again.
 *
 * Graceful failure: if he has since blocked her, returns "He's no longer available".
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { conversationId } = await request.json();
		if (!conversationId) return json({ error: 'Missing conversationId' }, { status: 400 });

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

		const { data: match } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, status, bestie_checklist')
			.eq('id', conversationId)
			.single();
		if (!match) return json({ error: 'Conversation not found' }, { status: 404 });
		if (match.user1_id !== user.id && match.user2_id !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		if (match.status !== 'expired') {
			return json({ error: 'This match is not expired' }, { status: 409 });
		}

		// Resolve sides; only the woman may reactivate.
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender, first_name')
			.in('id', [match.user1_id, match.user2_id]);
		const woman = (users ?? []).find((u: any) => u.gender === 'woman');
		const man = (users ?? []).find((u: any) => u.gender === 'man');
		if (!woman || !man) return json({ error: 'Conversation not found' }, { status: 404 });
		if (user.id !== woman.id) {
			return json({ error: 'Only she can reactivate this match' }, { status: 403 });
		}

		// Graceful fail: he blocked her in the interim → no longer available.
		const { data: block } = await supabase
			.from('verified_vibe_passes')
			.select('id')
			.eq('user_id', man.id)
			.eq('passed_user_id', woman.id)
			.like('reason', 'blocked%')
			.maybeSingle();
		if (block) return json({ error: 'He’s no longer available' }, { status: 410 });

		// Did her preferences change since Bestie wrapped up?
		const wrappedAt: string | null = match.bestie_checklist?.wrapped_at ?? null;
		let prefsChanged = false;
		if (wrappedAt) {
			const { data: latestPref } = await supabase
				.from('ai_assistant_profiles')
				.select('created_at')
				.eq('user_id', woman.id)
				.eq('profile_type', 'preferences')
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();
			if (latestPref?.created_at && Date.parse(latestPref.created_at) > Date.parse(wrappedAt)) {
				prefsChanged = true;
			}
		}

		// Restore the match. He keeps his replacement; we only touch this row.
		const update: Record<string, unknown> = {
			status: 'mutual',
			expired_at: null,
			handoff_nudge_stage: 0,
			ai_bestie_active: prefsChanged
		};
		// Re-vet path: clear the checklist so the next turn regenerates fresh gaps
		// against her current preferences (the reply path rebuilds it when null).
		if (prefsChanged) update.bestie_checklist = null;
		await supabase.from('verified_vibe_matches').update(update).eq('id', conversationId);

		// Post a warm reconnect line in her voice (is_ai) so he sees what happened.
		const reconnect = prefsChanged
			? `Hey ${man.first_name ?? 'there'} — ${woman.first_name ?? 'she'} had a couple more things she wanted me to run through. Good to be chatting again!`
			: `Good news — ${woman.first_name ?? 'she'} is back and wants to take it from here herself. Over to you two!`;
		try {
			await supabase
				.from('verified_vibe_messages')
				.insert({ match_id: conversationId, sender_id: woman.id, content: reconnect, is_ai: true });
		} catch { /* non-fatal — reactivation already succeeded */ }

		return json({ success: true, reengaged: prefsChanged ? 'revet' : 'direct' });
	} catch (error) {
		console.error('AI Bestie reactivate error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
