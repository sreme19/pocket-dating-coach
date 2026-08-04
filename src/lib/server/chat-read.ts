import type { SupabaseClient } from '@supabase/supabase-js';
import type { Archetype, Message, VerifiedVibeUser } from '$lib/verified-vibe/types';
import { networkingEnforcementEnabled } from './networking-season';
import {
  countAdvisorUnread,
  latestAdvisorHeadline,
  resolveAssistantType
} from './advisor-thread';
import { buildHerInbox } from './her-inbox';
import { gapBarEnabled, loadMatchGapBar, persistGapBar, gapBarMode } from './gap-bar-service';
import type { Vec } from './vector-scoring';
import {
  canAskMore,
  buildTopicSuggestions,
  roundsRemaining,
  isFinalRound
} from './question-rounds';

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
  /** Networking Season (Phase 4): true when this match was de-ranked (he kept pushing
   *  romance after she went networking). Sinks him to the bottom of HER inbox. */
  deranked: boolean;
  /**
   * HER ranked inbox. Null for the man's view, and null for her too when the gap-bar
   * flag is off or she has no distilled preferences yet — there is no honest ordering
   * to show in either case, and a fabricated one is worse than none.
   *
   * Ranked by APPEAL (how much of what she weights he has proven), never by his gap
   * bar. She never sees his percentage; rank and `unprovenNote` are all she gets.
   */
  rank: number | null;
  /** Which section he belongs in. Null when unranked. */
  section: 'ready' | 'vetting' | 'waiting' | null;
  /** Neutral one-liner on what is not backed up. Never a warning. */
  unprovenNote: string | null;
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
  /**
   * HIS four-stage progress toward the hand-off. Sent to the MAN only — it is his
   * number, and her side gets rank and an unproven note instead (see Conversation).
   * Null when the gate is off, when he has no vectors, or on the woman's view.
   *
   * `mode` is 'passive' in a networking season: the bar still accrues from proofs and
   * whatever he volunteers, but Bestie stops driving toward it with dating-framed
   * questions, so a contact who later flips to Date arrives already vetted.
   */
  gapBar: (Record<string, unknown> & { mode: 'active' | 'passive' }) | null;
  /**
   * "Ask him more" (G-27), HER side only. Null for the man, and null when she cannot
   * ask right now — the reason is carried inside so the button can explain itself
   * rather than just being absent.
   */
  askMore: {
    allowed: boolean;
    reason: string | null;
    roundsUsed: number;
    roundsRemaining: number;
    /** The next round would be her last, and he will be told so. */
    finalRound: boolean;
    suggestions: Array<{ id: string; label: string; topic: string | null; group: string; answered: boolean }>;
  } | null;
}

export type ConversationDetailResult =
  | { ok: true; data: ConversationDetailData }
  | { ok: false; status: 401 | 404 | 500 };

/** Build the chat-list conversations for `userId`. Throws on a matches-query DB error. */
export async function buildConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<Conversation[]> {
  // 1. Fetch all mutual/expired matches (single query). The de-rank column is
  //    only selected when Phase 4 enforcement is on, so with the flag off this
  //    query has no dependency on the Phase 4 migration.
  const enforce = networkingEnforcementEnabled();
  const matchCols =
    'id, user1_id, user2_id, status, created_at, user1_last_read_at, user2_last_read_at, ai_bestie_active, bestie_checklist, expired_at, fit_mismatch' +
    (enforce ? ', deranked_at' : '') +
    // Same reasoning as deranked_at: only read behind its flag, so this query has no
    // dependency on the gap-bar migration until the gate is switched on.
    (gapBarEnabled() ? ', gap_bar_percent' : '');
  const { data: matches, error: matchesError } = await supabase
    .from('verified_vibe_matches')
    .select(matchCols)
    .in('status', ['mutual', 'expired'])
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  if (matchesError) {
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }

  if (!matches || matches.length === 0) return [];

  // 2. Collect other user IDs and fetch all profiles in ONE batch query.
  // The VIEWER is fetched alongside them (same query, no extra round trip) because
  // the hand-off side below is inferred from gender, and that inference is only
  // valid on an opposite-gender pair.
  const otherUserIds = matches.map((m) => (m.user1_id === userId ? m.user2_id : m.user1_id));
  const { data: users } = await supabase
    .from('verified_vibe_users')
    .select('id, first_name, age, city, avatar_url, gender, archetype, trust_score, about, looking, created_at, updated_at')
    .in('id', [...otherUserIds, userId]);

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));
  const selfGender = userMap.get(userId)?.gender ?? null;

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
    // That inference only holds on an opposite-gender pair. On a same-gender
    // networking connection there is no Bestie and no hand-off, and "other is a
    // woman" would otherwise tell one woman she's waiting on the other.
    const sameGender = !!selfGender && selfGender === otherUser.gender;
    const windowOpen =
      !isExpired &&
      !sameGender &&
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
      canReactivate,
      // De-rank applies only in HER inbox (partner is a man). Local-only signal.
      deranked: enforce && !!(match as any).deranked_at && otherUser.gender === 'man',
      rank: null,
      section: null,
      unprovenNote: null
    });
  }

  await annotateHerInbox(supabase, userId, selfGender, matches, conversations);

  return conversations.sort((a, b) => {
    // Her ranked inbox wins when it is present: waiting-on-him sinks, then rank.
    if (a.rank !== null && b.rank !== null) {
      const weight = (c: Conversation) => (c.section === 'waiting' ? 1 : 0);
      if (weight(a) !== weight(b)) return weight(a) - weight(b);
      return a.rank - b.rank;
    }
    // De-ranked matches (networking pushers) sink to the bottom of her inbox,
    // still time-ordered among themselves.
    if (a.deranked !== b.deranked) return a.deranked ? 1 : -1;
    return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
  });
}

/** How long he can be silent before he sinks into "waiting on them". */
const WAITING_ON_HIM_HOURS = 72;

/**
 * Rank HER suitors and annotate the conversations in place.
 *
 * Two thirds of Bestie's completed hand-offs expired with no reply from her, and the
 * median woman has fourteen suitors in one undifferentiated list. This is the ordering
 * that gives her somewhere to start. No-ops entirely for men, and for her whenever
 * there is nothing honest to order by.
 */
async function annotateHerInbox(
  supabase: SupabaseClient,
  userId: string,
  selfGender: string | null,
  matchRows: any[],
  conversations: Conversation[]
): Promise<void> {
  if (selfGender !== 'woman' || !gapBarEnabled() || conversations.length === 0) return;

  try {
    const men = conversations.filter((c) => c.matchedUser.gender === 'man' && c.status === 'mutual');
    if (men.length === 0) return;

    const byId = new Map(matchRows.map((m: any) => [m.id, m]));
    const [herVec, hisVecs] = await Promise.all([
      supabase.from('vv_user_vectors').select('weights').eq('user_id', userId).maybeSingle().then((r: any) => r.data),
      supabase.from('vv_user_vectors').select('user_id, attributes, confidence')
        .in('user_id', men.map((c) => c.matchedUser.id)).then((r: any) => r.data ?? [])
    ]);
    const vecById = new Map((hisVecs as any[]).map((v) => [v.user_id, v]));
    const staleBefore = Date.now() - WAITING_ON_HIM_HOURS * 3_600_000;

    const inbox = buildHerInbox(
      (herVec?.weights ?? null) as Vec | null,
      men.map((c) => {
        const row = byId.get(c.matchId);
        const v = vecById.get(c.matchedUser.id);
        return {
          matchId: c.matchId,
          manId: c.matchedUser.id,
          firstName: c.matchedUser.firstName,
          attrs: (v?.attributes ?? null) as Vec | null,
          conf: (v?.confidence ?? null) as Vec | null,
          gapBarPercent: typeof row?.gap_bar_percent === 'number' ? row.gap_bar_percent : null,
          wrapped: (row?.bestie_checklist as any)?.status === 'wrapped',
          fitMismatch: (row?.fit_mismatch as any)?.reason ?? null,
          // Literally what it says: the last word in the thread is not his, and it has
          // been days. No new state needed to know he owes her an answer.
          waitingOnHim:
            c.deranked ||
            (c.hasMessages &&
              c.lastMessageSenderId !== c.matchedUser.id &&
              c.lastMessageTime.getTime() < staleBefore)
        };
      })
    );

    const place = (rows: typeof inbox.ready, section: Conversation['section']) => {
      for (const r of rows) {
        const convo = conversations.find((c) => c.matchId === r.matchId);
        if (!convo) continue;
        convo.rank = r.rank;
        convo.section = section;
        convo.unprovenNote = r.unprovenNote;
      }
    };
    place(inbox.ready, 'ready');
    place(inbox.vetting, 'vetting');
    place(inbox.waiting, 'waiting');
  } catch (e) {
    // Her chat list must never fail because the ranking could not be built.
    console.warn('[her-inbox] ranking skipped (non-fatal):', e);
  }
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

  // Same-gender connections (Networking Season) are person-to-person: no Bestie on
  // either side (§B/§U). Deciding it HERE rather than per-creation-site is what makes
  // it true for every match that already exists and every one added later — and the
  // three surfaces that key off this flag (the woman's "AI Bestie is replying for you"
  // status bar, the man's transparency card, the Call Bestie button) all go away with
  // it. The `?? true` default is why it has to be positive suppression: an unset flag
  // would otherwise render the full Bestie UI on a thread she can't speak in.
  const selfGender = (selfUser as any)?.gender ?? null;
  const sameGender = !!selfGender && selfGender === matchedUser.gender;

  // HIS bar, computed for the man only. Never sent to her: she gets rank and one
  // neutral line about what is unproven, and his percentage stays his. Wrapped so a
  // scoring failure can never stop him reading his own chat.
  let gapBar: ConversationDetailData['gapBar'] = null;
  if (gapBarEnabled() && selfGender === 'man' && !sameGender) {
    try {
      const computed = await loadMatchGapBar(supabase, conversationId);
      if (computed) {
        // Persist the value as the monotonic floor for next time.
        await persistGapBar(supabase, conversationId, computed.bar.percent);
        gapBar = {
          ...computed.bar,
          mode: gapBarMode((selfUser as any)?.discovery_mode, (matchedUser as any)?.discovery_mode)
        };
      }
    } catch (e) {
      console.warn('[gap-bar] detail computation skipped (non-fatal):', e);
    }
  }

  const askMore = await buildAskMoreState(supabase, conversationId, match, selfGender, sameGender);

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
      aiBestieActive: sameGender ? false : (match.ai_bestie_active ?? true),
      proofRequest: (match as any).proof_request ?? null,
      bestieChecklist: (match as any).bestie_checklist ?? null,
      selfGender,
      gapBar,
      askMore
    }
  };
}

// ── Advisor row summary ──────────────────────────────────────────────────────

/**
 * What the chat list needs to render the pinned "AI Bestie / AI Wingman
 * (advisor)" row: an unread count for its red badge, and the newest coaching
 * line for its subtitle.
 *
 * Folded in here so the chat list learns about waiting advice in the round trip
 * it already makes — the advisor row is the only entry point to that thread, so
 * a badge it can't see is a message nobody reads.
 */
export interface AdvisorSummary {
  assistantType: 'wingman' | 'bestie';
  unreadCount: number;
  /** Newest assistant turn, for the row subtitle. Null when the thread is empty. */
  headline: string | null;
  headlineAt: string | null;
}

export async function buildAdvisorSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<AdvisorSummary> {
  // chat-read is deliberately generic over the client so admin impersonation can
  // reuse it; the advisor helpers are typed against the service-role client.
  const sb = supabase as unknown as Parameters<typeof countAdvisorUnread>[0];

  const assistantType = await resolveAssistantType(sb, userId);
  const [unreadCount, latest] = await Promise.all([
    countAdvisorUnread(sb, userId, assistantType),
    latestAdvisorHeadline(sb, userId, assistantType)
  ]);

  return {
    assistantType,
    unreadCount,
    headline: latest?.content ?? null,
    headlineAt: latest?.createdAt ?? null
  };
}

/**
 * Her "ask him more" state (G-27).
 *
 * Returns the gate's REASON alongside the flag, so the button can say why it is
 * unavailable instead of silently vanishing — "you're talking to him yourself" and
 * "that's everything I can ask without it turning into an interview" are both more
 * use to her than an absent control.
 *
 * Everything is wrapped and degrades to null: her chat must not fail because a topic
 * taxonomy could not be read, and the whole feature is inert before its migration.
 */
async function buildAskMoreState(
  supabase: SupabaseClient,
  conversationId: string,
  match: any,
  selfGender: string | null,
  sameGender: boolean
): Promise<ConversationDetailData['askMore']> {
  if (selfGender !== 'woman' || sameGender) return null;
  try {
    // Own lenient read: the columns may not exist yet, and a failure here must not
    // reach the main select (which falls back to a legacy column set on error).
    const { data: rounds } = await supabase
      .from('verified_vibe_matches')
      .select('bestie_question_rounds')
      .eq('id', conversationId)
      .maybeSingle();
    const roundsUsed = Number((rounds as any)?.bestie_question_rounds ?? 0);

    const checklist = (match as any).bestie_checklist as
      | { status?: string; items?: Array<{ topic?: string | null; label?: string }> }
      | null;
    const gate = canAskMore({
      bestieActive: (match as any).ai_bestie_active !== false,
      checklistStatus: checklist?.status,
      roundsUsed,
      status: (match as any).status
    });

    let suggestions: ReturnType<typeof buildTopicSuggestions> = [];
    if (gate.allowed) {
      const { data: taxonomy } = await supabase.from('vv_ledger_topics').select('key, label');
      suggestions = buildTopicSuggestions({
        taxonomy: (taxonomy ?? []) as Array<{ key: string; label: string }>,
        askedTopics: (checklist?.items ?? []).map((i) => i.topic ?? '').filter(Boolean),
        askedLabels: (checklist?.items ?? []).map((i) => i.label ?? '').filter(Boolean)
      });
    }

    return {
      allowed: gate.allowed,
      reason: gate.reason,
      roundsUsed,
      roundsRemaining: roundsRemaining(roundsUsed),
      finalRound: isFinalRound(roundsUsed),
      suggestions
    };
  } catch (e) {
    console.warn('[ask-more] state unavailable (non-fatal):', e);
    return null;
  }
}
