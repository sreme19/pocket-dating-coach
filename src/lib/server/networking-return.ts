/**
 * Networking Season — Phase 4, "return to Date" consent notify.
 *
 * When a user flips back to Date after a networking season, they may (with
 * explicit consent) let the people they networked with know they're open to
 * dating again. We only message OPPOSITE-gender contacts on active threads —
 * telling a same-gender networking contact "they're open to dating again"
 * makes no sense in the straight-only MVP.
 *
 * The message is a templated Bestie (is_ai) line, sent on their behalf — the
 * same mechanism as the Bestie hand-off messages. Gated by
 * NETWORKING_ENFORCEMENT_GATE at the call sites.
 */

/** Their active, opposite-gender mutual matches (threads with ≥1 message). */
export async function listReturnContacts(
  db: any,
  userId: string,
): Promise<Array<{ matchId: string; partnerId: string }>> {
  const { data: self } = await db
    .from('verified_vibe_users')
    .select('gender')
    .eq('id', userId)
    .maybeSingle();
  const selfGender: string | null = self?.gender ?? null;

  const { data: matches } = await db
    .from('verified_vibe_matches')
    .select('id, user1_id, user2_id')
    .eq('status', 'mutual')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

  const out: Array<{ matchId: string; partnerId: string }> = [];
  for (const m of matches ?? []) {
    const partnerId: string = m.user1_id === userId ? m.user2_id : m.user1_id;

    // Opposite gender only — skip same-gender networking contacts.
    const { data: p } = await db
      .from('verified_vibe_users')
      .select('gender, discovery_mode')
      .eq('id', partnerId)
      .maybeSingle();
    if (selfGender && p?.gender && p.gender === selfGender) continue;

    // Never announce "open to dating again" into a thread where the CONTACT is
    // themselves in a networking season — they've paused dating, so a "if there's
    // a spark here" nudge is exactly the romantic pressure the season exists to
    // prevent (and their own Bestie may read it as the contact pressuring them).
    if (p?.discovery_mode === 'networking') continue;

    // Active thread only (≥1 message exchanged).
    const { count } = await db
      .from('verified_vibe_messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id);
    if ((count ?? 0) > 0) out.push({ matchId: m.id, partnerId });
  }
  return out;
}

/** How many contacts a return-to-date notify would reach (for the consent prompt). */
export async function countReturnContacts(db: any, userId: string): Promise<number> {
  return (await listReturnContacts(db, userId)).length;
}

/**
 * Stable opening of the return-to-date notice. Used to detect an already-sent
 * notice so a double-submit can't send the same announcement twice.
 */
const RETURN_NOTICE_PREFIX = 'Quick update —';

/** Send the "open to dating again" Bestie message to each active contact. */
export async function notifyReturnToDate(db: any, userId: string): Promise<number> {
  const { data: self } = await db
    .from('verified_vibe_users')
    .select('first_name, gender')
    .eq('id', userId)
    .maybeSingle();
  const name: string = self?.first_name || 'They';
  const possessive = self?.gender === 'man' ? 'his' : self?.gender === 'woman' ? 'her' : 'their';
  const subject = self?.gender === 'man' ? 'He' : self?.gender === 'woman' ? 'She' : 'They';

  const contacts = await listReturnContacts(db, userId);
  let sent = 0;
  for (const c of contacts) {
    try {
      // Idempotent per thread: a retry or double-submit must not re-announce.
      const { count: already } = await db
        .from('verified_vibe_messages')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', c.matchId)
        .eq('sender_id', userId)
        .eq('is_ai', true)
        .like('content', `${RETURN_NOTICE_PREFIX}%networking season%`);
      if ((already ?? 0) > 0) continue;

      await db.from('verified_vibe_messages').insert({
        match_id: c.matchId,
        sender_id: userId,
        content: `${RETURN_NOTICE_PREFIX} ${name} has come out of ${possessive} networking season and is open to dating again 🌹 ${subject}'s loved connecting; if there's a spark here, this is a lovely moment to explore it.`,
        is_ai: true,
      });
      sent++;
    } catch { /* skip this contact, keep going */ }
  }
  return sent;
}
