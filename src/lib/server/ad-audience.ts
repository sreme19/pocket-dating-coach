/**
 * Which audience a landing-page hit was aimed at.
 *
 * THIS IS THE AUDIENCE TARGETED, NOT THE PERSON WHO ARRIVED. The landing page
 * has no idea who is looking at it — `marketing_page_views` and
 * `marketing_store_clicks` carry no identity and no gender, and they should not:
 * a visitor has not told us anything yet. So the only honest gender-ish cut
 * available on views and taps is the one the ad buyer chose, and that is
 * recoverable from the campaign and creative names.
 *
 * Actual gender exists in exactly one place, `verified_vibe_users.gender`, and
 * only for people who finished signing up. The two must never be added together
 * or shown in the same column: a campaign aimed at men produces women signups
 * routinely, and that difference is a finding rather than an error to smooth
 * over.
 *
 * DERIVED FROM NAMING, SO IT IS ONLY AS GOOD AS THE NAMING. Snap campaigns here
 * are human-named (`men_25_40_casual_story_ind_lpv`) and classify cleanly. Meta
 * passes a numeric campaign id (`6978093820881`), so Meta traffic resolves to
 * `unknown` and stays there until the campaign name arrives with the spend rows.
 * Unknown is reported as its own bucket, never folded into one of the other two.
 */

export type Audience = 'men' | 'women' | 'unknown';

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'men', label: 'Men' },
  { id: 'women', label: 'Women' },
  { id: 'unknown', label: 'Unknown' }
];

/**
 * Two properties of these names make the matching fiddlier than it looks.
 *
 * UNDERSCORE IS A WORD CHARACTER, so `\b` never fires inside snake_case:
 * /\bmale\b/ does not match `male_audience`. Separators are normalised to spaces
 * before any boundary test.
 *
 * WOMEN-WORDS CONTAIN MEN-WORDS — "women" contains "men", "female" contains
 * "male". A men-first test reads `women_18_30_blr_lifestyle_auto` as men, which
 * does not throw, does not look wrong, and swaps the two biggest numbers on the
 * page. So women is matched first, as a SUBSTRING (real creatives run words
 * together, e.g. `img_floodedwoman_v1`), every match is removed, and only then
 * is men tested — on WORD BOUNDARIES, because bare "man" as a substring would
 * classify `management_test`.
 */
const WOMEN = /wom[ae]n|females?|girls?|lad(?:y|ies)/g;
const MEN = /\b(?:men|males?|man|guys?|m\d{2})\b/;

/** Lowercased, with every separator flattened to a space. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

/** Every naming field that could carry the targeting, joined. */
function haystack(row: {
  campaign?: string | null;
  utm?: Record<string, string> | null;
}): string {
  const utm = row.utm ?? {};
  return normalise(
    [row.campaign, utm.utm_campaign, utm.utm_content, utm.utm_term]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
  );
}

/**
 * The audience a row was targeted at, or 'unknown'.
 *
 * A row mentioning both is 'unknown' rather than a guess. That combination means
 * the naming convention is ambiguous, and quietly picking one would hide the
 * fact that the campaign cannot be classified.
 */
export function audienceOf(row: {
  campaign?: string | null;
  utm?: Record<string, string> | null;
}): Audience {
  const text = haystack(row);
  if (!text.trim()) return 'unknown';

  // Global replace, so EVERY women-word is removed before men is tested — a
  // single non-global replace would leave the second occurrence behind.
  const residue = text.replace(WOMEN, ' ');
  const women = residue !== text;
  const men = MEN.test(residue);

  if (women && men) return 'unknown';
  if (women) return 'women';
  if (men) return 'men';
  return 'unknown';
}

export function isAudience(value: unknown): value is Audience {
  return value === 'men' || value === 'women' || value === 'unknown';
}
