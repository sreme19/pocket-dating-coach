/**
 * The visitor's location, without keeping the address it came from.
 *
 * Both landing-page tables deliberately store no IP — see the note in the
 * marketing_store_clicks migration. That decision is worth keeping, but taken
 * alone it also removes the ability to tell an expensive market from a cheap
 * one, and choosing between markets is most of what paid-social spend
 * allocation actually is. Recruiting runs across India and Indonesia, where CPMs
 * and traffic quality differ by an order of magnitude; blending them into one
 * average number is how you end up scaling the wrong one.
 *
 * The edge has already resolved the address before the request reaches us, so we
 * can read the answer and never touch the input.
 *
 * WHY CITY AND REGION, AND WHY THEY ARE NOT A PRIVACY CHANGE. Country alone
 * cannot answer the question the ad sets are actually asking. Three of the live
 * ad sets target Bangalore by name — WOMEN_18-30_BLR_LIFESTYLE_AUTO,
 * SC_MEN_28-38_BLR_CASUAL — and "did BLR-targeted spend land in BLR?" was
 * unanswerable from our own data while every row said nothing finer than `IN`.
 * These come from the same edge resolution as the country: derived from an
 * address we still never see, still never store, and still never send anywhere.
 * A city across thousands of anonymous visitors identifies nobody, for the same
 * reason the country code does not.
 *
 * WHAT THIS IS NOT. It is not a location the visitor gave us, and it is not
 * precise. Edge geolocation resolves to the ISP's egress, so a mobile visitor in
 * a satellite town frequently reads as the metro that carries their traffic.
 * Good enough to compare markets; never good enough to state where somebody was.
 */

/** Vercel's headers in production; Cloudflare's are checked as a fallback. */
const COUNTRY_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry'] as const;
const CITY_HEADERS = ['x-vercel-ip-city', 'cf-ipcity'] as const;
const REGION_HEADERS = ['x-vercel-ip-country-region', 'cf-region-code'] as const;

/**
 * Hard cap on the free-text fields.
 *
 * A city name is not attacker-controlled today — it is written by the edge, not
 * by the client — but this row is inserted from an unauthenticated beacon, and
 * the difference between "the edge sets this" and "nothing else can" is one
 * misconfigured proxy. Bounded on the way in, like every other string on these
 * tables.
 */
const MAX_PLACE = 80;

export interface RequestGeo {
  country: string | null;
  city: string | null;
  region: string | null;
}

function firstHeader(request: Request, names: readonly string[]): string | null {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return value;
  }
  return null;
}

export function countryFromRequest(request: Request): string | null {
  const value = firstHeader(request, COUNTRY_HEADERS);
  // Cloudflare sends 'XX' for anonymising proxies and 'T1' for Tor. Neither is
  // a country, and storing them as one would put a fake market in the reports.
  if (value && /^[A-Za-z]{2}$/.test(value) && value.toUpperCase() !== 'XX' && value.toUpperCase() !== 'T1') {
    return value.toUpperCase();
  }
  return null;
}

/**
 * The city, decoded.
 *
 * Vercel percent-encodes this header, because city names contain spaces and
 * non-ASCII and a raw header cannot. Skipping the decode is the failure that
 * does not look like one: the column fills, the dashboard renders, and the top
 * Indian market reads `New%20Delhi` beside a separate `New Delhi` from whichever
 * request happened not to need encoding — two rows, one city, both half the
 * real number.
 */
function cityFromRequest(request: Request): string | null {
  const raw = firstHeader(request, CITY_HEADERS);
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A malformed sequence throws. Keep the raw value rather than dropping the
    // row's geography entirely — a slightly ugly label beats a null.
  }

  const trimmed = decoded.trim().slice(0, MAX_PLACE);
  // Control characters would be the only way this reaches a log or a CSV as
  // anything but text.
  const clean = trimmed.replace(/[\x00-\x1f\x7f]/g, '');
  return clean.length ? clean : null;
}

/**
 * The first-level subdivision — a state in India, a state in the US.
 *
 * ISO 3166-2 subdivision code WITHOUT the country prefix, which is what both
 * edges send: `KA`, not `IN-KA`. Stored as given rather than normalised into the
 * full code, so nothing here has to guess at the country half and get it wrong
 * for the handful of rows where the country header was the one that went
 * missing.
 */
function regionFromRequest(request: Request): string | null {
  const raw = firstHeader(request, REGION_HEADERS);
  if (!raw) return null;
  const clean = raw.trim().slice(0, MAX_PLACE).replace(/[^A-Za-z0-9-]/g, '');
  return clean.length ? clean.toUpperCase() : null;
}

/**
 * Everything the edge knows, in one call.
 *
 * Read together rather than field by field because they are written together:
 * a row with a city and no country is a bug in this file, not a fact about a
 * visitor.
 */
export function geoFromRequest(request: Request): RequestGeo {
  return {
    country: countryFromRequest(request),
    city: cityFromRequest(request),
    region: regionFromRequest(request)
  };
}
