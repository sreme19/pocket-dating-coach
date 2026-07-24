/**
 * Networking Season — Phase 4, "return to Date" consent notify.
 *
 * When a woman flips back to Date after a networking season, she may (with her
 * explicit consent) let the people she networked with know she's open to dating
 * again. We only message OPPOSITE-gender contacts on active threads — telling a
 * same-gender networking contact "she's open to dating again" makes no sense in
 * the straight-only MVP.
 *
 * The message is a templated Bestie (is_ai) line, sent on her behalf — the same
 * mechanism as the Bestie hand-off messages. Gated by NETWORKING_ENFORCEMENT_GATE
 * at the call sites.
 */

/** Her active, opposite-gender mutual matches (threads with ≥1 message). */
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
      .select('gender')
      .eq('id', partnerId)
      .maybeSingle();
    if (selfGender && p?.gender && p.gender === selfGender) continue;

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

/** Send the "open to dating again" Bestie message to each active contact. */
export async function notifyReturnToDate(db: any, userId: string): Promise<number> {
  const { data: self } = await db
    .from('verified_vibe_users')
    .select('first_name')
    .eq('id', userId)
    .maybeSingle();
  const name: string = self?.first_name || 'She';

  const contacts = await listReturnContacts(db, userId);
  let sent = 0;
  for (const c of contacts) {
    try {
      await db.from('verified_vibe_messages').insert({
        match_id: c.matchId,
        sender_id: userId,
        content: `Quick update — ${name} has come out of her networking season and is open to dating again 🌹 She's loved connecting; if there's a spark here, this is a lovely moment to explore it.`,
        is_ai: true,
      });
      sent++;
    } catch { /* skip this contact, keep going */ }
  }
  return sent;
}
