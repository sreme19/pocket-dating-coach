/**
 * Networking Season — AI grounding helpers (Phase 3).
 *
 * When a user is in a "networking" season (see discovery_mode on
 * verified_vibe_users), their AI companion must behave differently:
 *   - ADVISOR side (their own Bestie/Wingman coaching them): frame everything as
 *     platonic networking, be a "networking buddy", and only lightly remind them
 *     they can switch back to Date.
 *   - PROXY side (the Bestie messaging a MAN on the woman's behalf): keep the
 *     thread platonic and, if the woman is networking, warmly disclose it to him.
 *
 * A connection is "networking" if EITHER participant is in a networking season.
 *
 * Everything is gated behind NETWORKING_SEASON_GATE (default OFF): when the flag
 * is off, every block-builder returns '' and the AI behaves exactly as before.
 * See docs/requirements/Networking_Mode_Design.md.
 */

import { env } from '$env/dynamic/private';

export type DiscoveryMode = 'date' | 'networking';

/** Opt-in flag (default OFF), matching the PHOTO_SIGNAL_GATE precedent. */
export function networkingSeasonEnabled(): boolean {
  return env.NETWORKING_SEASON_GATE === 'true';
}

export function normalizeMode(v: unknown): DiscoveryMode {
  return v === 'networking' ? 'networking' : 'date';
}

/** A connection is networking if EITHER side is in a networking season. */
export function resolveConnectionMode(owner: unknown, partner: unknown): DiscoveryMode {
  return normalizeMode(owner) === 'networking' || normalizeMode(partner) === 'networking'
    ? 'networking'
    : 'date';
}

/**
 * ADVISOR grounding for the owner's OWN companion (Bestie or Wingman). Prepend
 * to an existing context block. Returns '' when the flag is off or the owner is
 * in a date season (no behaviour change).
 */
export function seasonAdvisorBlock(ownerModeRaw: unknown): string {
  if (!networkingSeasonEnabled() || normalizeMode(ownerModeRaw) !== 'networking') return '';
  return `\n\nNETWORKING SEASON (ACTIVE — this changes how you advise):
- They have switched Discover to "Networking" — a deliberate pause on dating. They're here to meet people, network, and make friends with zero romantic pressure.
- Frame EVERYTHING as platonic networking, never dating. No flirting, no romance coaching, no "landing a date" or "winning her/him over" talk. Be their upbeat networking buddy — help them connect over shared interests, work, and goals.
- Their matches include people of any gender who are also networking; treat all of them as potential friends/contacts, not romantic prospects.
- At most ONCE, and only lightly, you may note they can switch back to "Date" anytime from Discover. Never push it, and drop it entirely if they don't bite.`;
}

/**
 * PROXY grounding for the Bestie when it messages a MAN on the woman's behalf.
 * Append to the Bestie reply prompt's context block. Returns '' when the flag is
 * off or neither side is networking.
 *
 * The disclosure ("she's networking right now") keys off the OWNER's own mode —
 * the Bestie represents the woman and must only assert HER status. If only the
 * man is networking, the thread still stays platonic but no claim is made about
 * the woman.
 */
export function seasonProxyBlock(ownerModeRaw: unknown, partnerModeRaw: unknown): string {
  if (!networkingSeasonEnabled()) return '';
  if (resolveConnectionMode(ownerModeRaw, partnerModeRaw) !== 'networking') return '';

  const ownerNetworking = normalizeMode(ownerModeRaw) === 'networking';
  const disclosure = ownerNetworking
    ? `- If he gets romantic, flirts, or asks her out, warmly and briefly let him know she's in a NETWORKING SEASON right now — here to meet people rather than date — and that if that ever changes, he'll be the first to know. Say it ONCE, kindly and without apology; never scold, never repeat it, never make him feel rejected.`
    : `- Keep things friendly and platonic; do not push this toward romance or a date.`;

  return `\n\nNETWORKING SEASON — this connection is currently networking-only, NOT romantic:
- Keep every message warm but strictly platonic. No flirting, no romantic framing, no setting up a date. Steer toward shared interests, work, and genuine friendly connection.
${disclosure}`;
}
