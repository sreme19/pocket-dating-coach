/**
 * POST /api/verified-vibe/advisor/mark-read
 *
 * Clears the advisor tab's unread badge by stamping the thread's last_read_at.
 * Mirrors how match chats already work (chat/mark-read stamps the match row)
 * rather than introducing a second notion of "read".
 *
 * The client calls this on open and again when new turns arrive while the screen
 * is in the foreground. Merely fetching history does NOT mark the thread read —
 * the same distinction the hand-off spec draws for a woman opening a chat without
 * engaging.
 *
 * Auth: Bearer token (required)
 * Body: {} — the assistant is derived from the caller's own profile
 * Response: { ok: true, lastReadAt }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { markAdvisorRead, resolveAssistantType } from '$lib/server/advisor-thread';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization') ?? '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const { createClient } = await import('@supabase/supabase-js');
		const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});

		const {
			data: { user },
			error: userError
		} = await userClient.auth.getUser();
		if (userError || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

		const sb = getSupabase();
		const assistantType = await resolveAssistantType(sb, user.id);
		const lastReadAt = new Date().toISOString();

		await markAdvisorRead(sb, user.id, assistantType, lastReadAt);

		return json({ ok: true, lastReadAt });
	} catch (error) {
		console.error('[advisor mark-read]', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
