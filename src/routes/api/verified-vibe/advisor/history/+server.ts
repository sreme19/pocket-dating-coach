/**
 * GET /api/verified-vibe/advisor/history
 *
 * The owner's AI Wingman / AI Bestie advisor thread, server-side and canonical.
 *
 * Before this existed the advisor tab had no read path at all: history lived only
 * on the device, so a reinstall, a second device, or (on web) a week's silence
 * emptied the thread. Hydrating from here is what lets the coach say "since we
 * last spoke" and hold someone to an action across days.
 *
 * Which assistant you get is derived from your own profile — never taken from the
 * query string — so a man cannot ask for a bestie thread.
 *
 * Auth: Bearer token (required)
 * Query: ?limit=<1..200>  (optional, defaults to the full window)
 * Response: { assistantType, messages[], unreadCount, lastReadAt }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import {
	loadAdvisorThread,
	countAdvisorUnread,
	getLastReadAt,
	resolveAssistantType
} from '$lib/server/advisor-thread';

export const GET: RequestHandler = async ({ request, url }) => {
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

		const rawLimit = Number(url.searchParams.get('limit'));
		const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : undefined;

		const [messages, unreadCount, lastReadAt] = await Promise.all([
			loadAdvisorThread(sb, user.id, assistantType, { limit }),
			countAdvisorUnread(sb, user.id, assistantType),
			getLastReadAt(sb, user.id, assistantType)
		]);

		return json({ assistantType, messages, unreadCount, lastReadAt });
	} catch (error) {
		console.error('[advisor history]', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
