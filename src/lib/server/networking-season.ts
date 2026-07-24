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

/**
 * Phase 4 ENFORCEMENT flag (de-rank, return-to-date consent, nudge cadence).
 * Separate from the season gate and default OFF, so Phase 4 deploys inert — and
 * every new-column read is guarded by this, so the code has no dependency on the
 * Phase 4 migration until the flag is turned on.
 */
export function networkingEnforcementEnabled(): boolean {
  return env.NETWORKING_ENFORCEMENT_GATE === 'true';
}

/** Post-disclosure romantic pushes that sink a man in HER inbox (local only). */
export const DERANK_PRESSURE_THRESHOLD = 2;

/** Minimum gap between switch-back nudges (~2 weeks). */
export const NUDGE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Whether to include the "you can switch back to Date" nudge line this turn.
 * Enforcement OFF → always true (Phase 3 behaviour, unchanged). ON → suppressed
 * by a permanent opt-out and throttled to ~once / 2 weeks.
 */
export function shouldShowSwitchBackNudge(lastAtRaw: unknown, optedOut: unknown): boolean {
  if (!networkingEnforcementEnabled()) return true;
  if (optedOut === true) return false;
  if (!lastAtRaw) return true;
  const last = new Date(`${lastAtRaw}`).getTime();
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= NUDGE_COOLDOWN_MS;
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
export function seasonAdvisorBlock(
  ownerModeRaw: unknown,
  opts: { includeSwitchBack?: boolean } = {}
): string {
  if (!networkingSeasonEnabled() || normalizeMode(ownerModeRaw) !== 'networking') return '';
  const { includeSwitchBack = true } = opts;
  const bullets = [
    `- They have switched Discover to "Networking" — a deliberate pause on dating. They're here to meet people, network, and make friends with zero romantic pressure.`,
    `- Frame EVERYTHING as platonic networking, never dating. No flirting, no romance coaching, no "landing a date" or "winning her/him over" talk. Be their upbeat networking buddy — help them connect over shared interests, work, and goals.`,
    `- Their matches include people of any gender who are also networking; treat all of them as potential friends/contacts, not romantic prospects.`,
  ];
  if (includeSwitchBack) {
    bullets.push(
      `- At most ONCE, and only lightly, you may note they can switch back to "Date" anytime from Discover. Never push it, and drop it entirely if they don't bite.`,
    );
  }
  return `\n\nNETWORKING SEASON (ACTIVE — this changes how you advise):\n${bullets.join('\n')}`;
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
