import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { buildConversations } from '$lib/server/chat-read';

// Re-exported for existing importers (e.g. the chat-list page).
export type { Conversation } from '$lib/server/chat-read';

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

    const conversations = await buildConversations(getSupabase(), user.id);
    return json({ data: { conversations } });
  } catch (error) {
    console.error('Conversations fetch error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
