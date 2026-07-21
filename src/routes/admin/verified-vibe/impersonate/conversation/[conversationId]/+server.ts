/**
 * GET /admin/verified-vibe/impersonate/conversation/[conversationId]?userId=<id>
 *
 * Admin "view-as-user" conversation detail. Returns the same payload the member
 * endpoint (/api/verified-vibe/chat/[conversationId]) returns for `userId` — plus
 * `selfGender` so the client can gate his-side UI without a member session — so
 * the admin preview renders the conversation exactly as that user sees it.
 *
 * Auth: admin session cookie (pdc_admin), path-scoped to /admin. READ-ONLY.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { getSupabase } from '$lib/server/supabase';
import { buildConversationDetail } from '$lib/server/chat-read';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
  if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conversationId = params.conversationId;
  if (!conversationId) return json({ error: 'Conversation ID is required' }, { status: 400 });

  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId is required' }, { status: 400 });

  try {
    const result = await buildConversationDetail(getSupabase(), userId, conversationId);
    if (!result.ok) {
      const msg = result.status === 401 ? 'Not a participant' : result.status === 404 ? 'Conversation not found' : 'Failed to fetch messages';
      return json({ error: msg }, { status: result.status });
    }
    return json({ data: result.data });
  } catch (error) {
    console.error('Admin impersonate conversation error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
