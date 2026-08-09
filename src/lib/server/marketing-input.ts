/**
 * Shape-based validation shared by the two landing-page beacons.
 *
 * Both endpoints are deliberately unauthenticated: they are fired by anonymous
 * ad traffic on pages that have no login and no form, so there is no identity to
 * check and the defences have to be about shape instead — small bodies, hard
 * length caps, a closed set of names, and a unique key so a flood writes bounded
 * garbage rather than unbounded rows.
 *
 * The caps live here rather than in each endpoint because the two tables JOIN on
 * visit_id. If the click endpoint truncated a campaign at 120 characters and the
 * view endpoint at 200, the same visit would carry two different campaign
 * strings and every per-campaign rate would quietly disagree with itself
 * depending on which table it was counted from.
 */

export const MAX_BODY_BYTES = 2_000;
export const MAX_CAMPAIGN = 120;
export const MAX_UA = 500;
export const MAX_REFERRER = 500;
export const MAX_UTM_KEYS = 12;
export const MAX_UTM_VALUE = 120;

/** Browser-generated ids: our own uuids, plus the fallback used where crypto.randomUUID is unavailable. */
export const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

export function clamp(value: unknown, max: number): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null;
}

/**
 * Keep the utm_* keys and nothing else, within fixed bounds.
 *
 * Anything not matching `utm_[a-z_]` is dropped rather than stored: this object
 * goes into a jsonb column that admin tooling reads, and an attacker-chosen key
 * is not something to hand to a dashboard.
 */
export function sanitizeUtm(raw: unknown): Record<string, string> {
  const utm: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return utm;

  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_UTM_KEYS)) {
    if (typeof v === 'string' && /^utm_[a-z_]{1,24}$/.test(k)) utm[k] = v.slice(0, MAX_UTM_VALUE);
  }
  return utm;
}
