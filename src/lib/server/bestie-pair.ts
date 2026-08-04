/**
 * bestie-pair.ts — who a Bestie may speak for on a given match.
 *
 * Extracted so there is exactly ONE definition of the rule. It started life inside
 * bestie-responder, and the moment a second caller needed it (the gap bar) the
 * choice was to duplicate the same-gender check or to share it. Duplicating a
 * safety rule is how the two copies drift, and this one decides whether Bestie
 * speaks in a thread she has no business in at all.
 */

/**
 * Resolve the (woman, man) pair a Bestie may proxy for on this match, or null when
 * she may not speak in it.
 *
 * Bestie is a woman→man proxy and nothing else. Networking Season ADDS same-gender
 * connections, and those are person-to-person by design: no Bestie on either side,
 * no transparency card, no checklist, no gap bar. The original shape —
 * `find((u) => u.gender === 'woman')` with only a `!woman` guard — silently picked
 * an arbitrary owner on a woman↔woman pair and treated the other woman as "the man".
 * So the test is the presence of a valid OPPOSITE-GENDER pair, not the presence of
 * one woman. A missing or unknown gender fails the same way, deliberately: we do not
 * guess who the owner is.
 */
export async function resolveProxyPair(
	supabase: any,
	matchId: string
): Promise<{ woman: { id: string }; man: { id: string } } | null> {
	const { data: matchRow } = await supabase
		.from('verified_vibe_matches')
		.select('user1_id, user2_id')
		.eq('id', matchId)
		.maybeSingle();
	if (!matchRow) return null;

	const { data: users } = await supabase
		.from('verified_vibe_users')
		.select('id, gender')
		.in('id', [matchRow.user1_id, matchRow.user2_id]);

	return pickPair(users ?? []);
}

/**
 * The pure half, so the rule is testable without a database.
 * Exactly one woman and exactly one man, or nothing.
 */
export function pickPair(
	users: Array<{ id: string; gender?: string | null }>
): { woman: { id: string }; man: { id: string } } | null {
	const women = users.filter((u) => u.gender === 'woman');
	const men = users.filter((u) => u.gender === 'man');
	if (women.length !== 1 || men.length !== 1) return null;
	return { woman: women[0], man: men[0] };
}
