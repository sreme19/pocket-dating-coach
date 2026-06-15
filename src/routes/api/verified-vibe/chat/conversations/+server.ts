import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import type { Archetype, VerifiedVibeUser } from '$lib/verified-vibe/types';

export interface Conversation {
  id: string;
  matchId: string;
  matchedUser: VerifiedVibeUser;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  hasMessages: boolean;
  matchedAt: Date;
}

interface ConversationsResponse {
  data: {
    conversations: Conversation[];
  };
}

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

    const userId = user.id;
    const supabase = getSupabase();

    // 1. Fetch all mutual matches (single query)
    const { data: matches, error: matchesError } = await supabase
      .from('verified_vibe_matches')
      .select('id, user1_id, user2_id, status, created_at, user1_last_read_at, user2_last_read_at')
      .eq('status', 'mutual')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return json({ error: 'Failed to fetch matches' }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return json({ data: { conversations: [] } });
    }

    // 2. Collect other user IDs and fetch all profiles in ONE batch query
    const otherUserIds = matches.map(m => m.user1_id === userId ? m.user2_id : m.user1_id);
    const { data: users } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, age, city, avatar_url, gender, archetype, trust_score, about, looking, created_at, updated_at')
      .in('id', otherUserIds);

    const userMap = new Map((users ?? []).map(u => [u.id, u]));

    // 3. Fetch last messages for ALL matches in parallel
    // Use nullsFirst: false so rows with NULL created_at (edge-case old messages)
    // are pushed to the bottom and don't shadow newer messages in DESC order.
    const lastMessageResults = await Promise.all(
      matches.map(async (match) => {
        const { data } = await supabase
          .from('verified_vibe_messages')
          .select('content, created_at, sender_id')
          .eq('match_id', match.id)
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(1);
        return { matchId: match.id, data: data ?? [] };
      })
    );
    const lastMessageMap = new Map(lastMessageResults.map(r => [r.matchId, r.data?.[0]]));

    // 4. Fetch unread counts for ALL matches in parallel
    const unreadResults = await Promise.all(
      matches.map(match => {
        const isUser1 = match.user1_id === userId;
        const myLastReadAt: string | null = isUser1
          ? (match.user1_last_read_at ?? null)
          : (match.user2_last_read_at ?? null);

        if (!myLastReadAt) return Promise.resolve({ matchId: match.id, count: 0 });

        return supabase
          .from('verified_vibe_messages')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .neq('sender_id', userId)
          .gt('created_at', myLastReadAt)
          .then(r => ({ matchId: match.id, count: r.count ?? 0 }));
      })
    );
    const unreadMap = new Map(unreadResults.map(r => [r.matchId, r.count]));

    // 5. Build conversations
    const conversations: Conversation[] = [];
    for (const match of matches) {
      const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
      const otherUser = userMap.get(otherUserId);
      if (!otherUser) continue;

      const lastMsg = lastMessageMap.get(match.id);
      conversations.push({
        id: match.id,
        matchId: match.id,
        matchedUser: {
          id: otherUser.id,
          gender: otherUser.gender,
          archetype: otherUser.archetype as Archetype,
          firstName: otherUser.first_name,
          age: otherUser.age,
          city: otherUser.city,
          avatar: otherUser.avatar_url,
          about: otherUser.about,
          looking: otherUser.looking,
          trustScore: otherUser.trust_score,
          createdAt: new Date(otherUser.created_at),
          updatedAt: new Date(otherUser.updated_at)
        },
        lastMessage: lastMsg?.content ?? 'No messages yet',
        lastMessageSenderId: lastMsg?.sender_id ?? null,
        lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at) : new Date(match.created_at),
        unreadCount: unreadMap.get(match.id) ?? 0,
        hasMessages: !!lastMsg,
        matchedAt: new Date(match.created_at)
      });
    }

    const sorted = conversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
    return json({ data: { conversations: sorted } });

  } catch (error) {
    console.error('Conversations fetch error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
