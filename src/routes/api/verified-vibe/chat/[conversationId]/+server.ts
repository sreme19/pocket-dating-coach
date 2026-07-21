import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { buildConversationDetail } from '$lib/server/chat-read';

/**
 * GET /api/verified-vibe/chat/[conversationId]
 *
 * Retrieves a specific conversation with message history for the authenticated
 * caller (who must be a participant).
 *
 * Error responses:
 * - 400: Conversation ID missing
 * - 401: Unauthorized (not authenticated / not a participant)
 * - 404: Conversation not found
 * - 500: Internal server error
 */
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const conversationId = params.conversationId;
    if (!conversationId) {
      return json({ error: 'Conversation ID is required' }, { status: 400 });
    }

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

    const result = await buildConversationDetail(getSupabase(), user.id, conversationId);
    if (!result.ok) {
      const msg = result.status === 401 ? 'Unauthorized' : result.status === 404 ? 'Conversation not found' : 'Failed to fetch messages';
      return json({ error: msg }, { status: result.status });
    }

    return json({ data: result.data });
  } catch (error) {
    console.error('Conversation fetch error:', error);
    return json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
