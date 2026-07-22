import type { SupabaseClient } from '@supabase/supabase-js';
import type { Archetype, Message, VerifiedVibeUser } from '$lib/verified-vibe/types';

/**
 * Shared, auth-agnostic chat read logic.
 *
 * These builders take an already-resolved `userId` and a service-role Supabase
 * client, and produce the exact payloads the member chat endpoints return. They
 * are consumed by:
 *  - the member endpoints (`/api/verified-vibe/chat/*`), which resolve `userId`
 *    from the caller's Bearer token; and
 *  - the admin impersonation endpoints (`/admin/verified-vibe/impersonate/*`),
 *    which resolve `userId` from an admin-cookie-gated `?userId=` param.
 *
 * Keeping the query logic here guarantees the admin "view-as-user" screen shows
 * byte-for-byte what the member would see.
 */

export interface Conversation {
  id: string;
  matchId: string;
  matchedUser: VerifiedVibeUser;
  lastMessage: string;
  lastMessageSenderId: string | null;
  lastMessageTime: Date;
  unreadCount: number;
  hasMessages: boolean;
  matchedAt: Date;
  /** True when AI Bestie wrapped up and is waiting for THIS user (the woman) to step in. */
  handoffPending: boolean;
  /** True for the MAN's view when her Bestie wrapped up and she hasn't stepped in yet — drives
   *  a countdown-only tile on his side (no step-in / no Reactivate; he can't act on it). */
  awaitingReply: boolean;
  /** 'mutual' (active) or 'expired' (hand-off window elapsed — Inactive section). */
  status: string;
  /** When Bestie handed off (checklist wrapped_at, ISO). Deadline = this + 48h.
   *  Populated for BOTH sides whenever the hand-off window is open (woman: handoffPending; man: awaitingReply). */
  handoffAt: string | null;
  /** When the match expired (ISO). Null unless status='expired'. */
  expiredAt: string | null;
  /** True only for the WOMAN on an expired match — she alone gets the Reactivate control. */
  canReactivate: boolean;
}

export interface ConversationDetailData {
  matchedUser: VerifiedVibeUser;
  messages: Message[];
  aiBestieActive: boolean;
  /** Bestie-driven in-chat proof request state (null when none). */
  proofRequest: Record<string, unknown> | null;
  /** AI Bestie CHECKLIST — drives the man's "she joins in" counter + wrap-up (null when none). */
  bestieChecklist: Record<string, unknown> | null;
  /** Gender of the viewing (self) user — lets the client gate his-side UI without a separate query. */
  selfGender: string | null;
}

export type ConversationDetailResult =
  | { ok: true; data: ConversationDetailData }
  | { ok: false; status: 401 | 404 | 500 };

/** Build the chat-list conversations for `userId`. Throws on a matches-query DB error. */
export async function buildConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<Conversation[]> {
  // 1. Fetch all mutual/expired matches (single query)
  const { data: matches, error: matchesError } = await supabase
    .from('verified_vibe_matches')
    .select('id, user1_id, user2_id, status, created_at, user1_last_read_at, user2_last_read_at, ai_bestie_active, bestie_checklist, expired_at')
    .in('status', ['mutual', 'expired'])
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  if (matchesError) {
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }

  if (!matches || matches.length === 0) return [];

  // 2. Collect other user IDs and fetch all profiles in ONE batch query
  const otherUserIds = matches.map((m) => (m.user1_id === userId ? m.user2_id : m.user1_id));
  const { data: users } = await supabase
    .from('verified_vibe_users')
    .select('id, first_name, age, city, avatar_url, gender, archetype, trust_score, about, looking, created_at, updated_at')
    .in('id', otherUserIds);

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  // 3. Fetch last messages for ALL matches in parallel.
  // nullsFirst: false so NULL created_at rows don't shadow newer messages in DESC order.
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
  const lastMessageMap = new Map(lastMessageResults.map((r) => [r.matchId, r.data?.[0]]));

  // 4. Fetch unread counts for ALL matches in parallel
  const unreadResults = await Promise.all(
    matches.map((match) => {
      const isUser1 = match.user1_id === userId;
      const myLastReadAt: string | null = isUser1
        ? (match.user1_last_read_at ?? null)
        : (match.user2_last_read_at ?? null);

      const query = supabase
        .from('verified_vibe_messages')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .neq('sender_id', userId);

      if (myLastReadAt) query.gt('created_at', myLastReadAt);

      return query.then((r) => ({ matchId: match.id, count: r.count ?? 0 }));
    })
  );
  const unreadMap = new Map(unreadResults.map((r) => [r.matchId, r.count]));

  // 5. Build conversations
  const conversations: Conversation[] = [];
  for (const match of matches) {
    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const otherUser = userMap.get(otherUserId);
    if (!otherUser) continue;

    const lastMsg = lastMessageMap.get(match.id);
    const checklist = (match as any).bestie_checklist as { status?: string; wrapped_at?: string } | null;
    const isExpired = (match as any).status === 'expired';
    // Bestie wrapped up and is still the proxy → the hand-off window is open.
    // Which SIDE this is depends on the other user's gender:
    //   · other is a man  → THIS viewer is the woman → her "step in" (handoffPending)
    //   · other is a woman → THIS viewer is the man → he's waiting on her (awaitingReply)
    const windowOpen =
      !isExpired &&
      (match as any).ai_bestie_active === true &&
      checklist?.status === 'wrapped';
    const handoffPending = windowOpen && otherUser.gender === 'man';
    const awaitingReply = windowOpen && otherUser.gender === 'woman';
    const canReactivate = isExpired && otherUser.gender === 'man';
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
      matchedAt: new Date(match.created_at),
      handoffPending,
      awaitingReply,
      status: (match as any).status,
      handoffAt: windowOpen ? (checklist?.wrapped_at ?? null) : null,
      expiredAt: isExpired ? ((match as any).expired_at ?? null) : null,
      canReactivate
    });
  }

  return conversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
}

/**
 * Build a single conversation's detail for `userId` (who must be a participant).
 * Returns a discriminated result so HTTP callers can map to the right status.
 */
export async function buildConversationDetail(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<ConversationDetailResult> {
  const { data: match, error: matchError } = await supabase
    .from('verified_vibe_matches')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (matchError || !match) return { ok: false, status: 404 };

  // Viewer must be a participant.
  if (match.user1_id !== userId && match.user2_id !== userId) {
    return { ok: false, status: 401 };
  }

  // Ended (unmatched/blocked) matches are no longer live conversations.
  if ((match as any).status === 'unmatched' || (match as any).status === 'blocked') {
    return { ok: false, status: 404 };
  }

  const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

  // Fetch both profiles in one query so we get `selfGender` for free.
  const { data: profiles } = await supabase
    .from('verified_vibe_users')
    .select('*')
    .in('id', [otherUserId, userId]);

  const matchedUser = (profiles ?? []).find((u) => u.id === otherUserId);
  const selfUser = (profiles ?? []).find((u) => u.id === userId);
  if (!matchedUser) return { ok: false, status: 404 };

  const { data: dbMessages, error: messagesError } = await supabase
    .from('verified_vibe_messages')
    .select('*')
    .eq('match_id', conversationId)
    .order('created_at', { ascending: true });

  if (messagesError) return { ok: false, status: 500 };

  const messages: Message[] = (dbMessages || []).map((msg) => ({
    id: msg.id,
    matchId: msg.match_id,
    senderId: msg.sender_id,
    content: msg.content,
    isAi: (msg as any).is_ai ?? false,
    aiSignal: (msg as any).ai_signal ?? undefined,
    aiRead: (msg as any).ai_read ?? undefined,
    createdAt: new Date(msg.created_at)
  }));

  return {
    ok: true,
    data: {
      matchedUser: {
        id: matchedUser.id,
        gender: matchedUser.gender,
        archetype: matchedUser.archetype as Archetype,
        firstName: matchedUser.first_name,
        age: matchedUser.age,
        city: matchedUser.city,
        avatar: matchedUser.avatar_url,
        about: matchedUser.about,
        looking: matchedUser.looking,
        trustScore: matchedUser.trust_score,
        createdAt: new Date(matchedUser.created_at),
        updatedAt: new Date(matchedUser.updated_at)
      },
      messages,
      aiBestieActive: match.ai_bestie_active ?? true,
      proofRequest: (match as any).proof_request ?? null,
      bestieChecklist: (match as any).bestie_checklist ?? null,
      selfGender: (selfUser as any)?.gender ?? null
    }
  };
}
