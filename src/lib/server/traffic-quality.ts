/**
 * Telling real ad traffic from everything else that lands on a landing page.
 *
 * WHY THIS EXISTS. On 2026-08-10 the landing-page table held 76 rows from the
 * United States against 57 from India, while every live campaign targeted India
 * only. The American rows arrived in bursts of a dozen inside five seconds, each
 * with its own visit id, all from desktop macOS Safari. They are Snap's ad-review
 * crawler: every creative edit sends an ad back through review, and review
 * fetches the landing page. Three creative edits in a morning, three bursts.
 *
 * That is the majority of the dataset. Tap rate, campaign comparison, cost per
 * signup — every one of them was being computed against a denominator made
 * mostly of robots, and every one was wrong in the same direction: rates
 * deflated, campaigns flattened toward each other, and the flattening worst on
 * whichever campaign had most recently been edited.
 *
 * CLASSIFY, NEVER DELETE. Excluded rows stay in the table and are counted and
 * reported beside the totals. A filter that silently drops rows is a filter
 * nobody can audit, and the first time it excludes something real there is no
 * way to notice. The dashboard says how many were set aside and why.
 *
 * THE RULES ARE DELIBERATELY CONSERVATIVE. Each one has to be defensible as
 * "this cannot have been a paid ad click", not merely "this looks odd". A rule
 * that excludes real buyers to tidy a chart is worse than the noise it removes.
 */

/** Tokens a client volunteers when it is not a person. Lowercase comparison. */
const CRAWLER_TOKENS = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'headless',
  'phantomjs',
  'puppeteer',
  'playwright',
  'curl/',
  'wget',
  'python-requests',
  'axios/',
  'go-http-client',
  'java/',
  'okhttp',
  'facebookexternalhit',
  'facebot',
  'snapchat-ads',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'slackbot',
  'preview',
  'lighthouse',
  'pagespeed',
  'gtmetrix',
  'uptime',
  'pingdom',
  'monitor'
];

/** Any of these means the request came from a handset or tablet. */
const MOBILE_TOKENS = ['android', 'iphone', 'ipad', 'ipod', 'mobile', 'windows phone'];

export type ExclusionReason = 'crawler' | 'desktop_on_snap' | 'no_user_agent';

export interface Classified {
  counted: boolean;
  reason: ExclusionReason | null;
}

/** Human-readable, for the dashboard and the daily mail. */
export const REASON_LABEL: Record<ExclusionReason, string> = {
  crawler: 'Self-identifying bot or link previewer',
  desktop_on_snap: 'Snapchat parameters on a desktop browser — Snap ads only render in the mobile app',
  no_user_agent: 'No user agent sent'
};

function lower(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  const ua = lower(userAgent);
  if (!ua) return false;
  return CRAWLER_TOKENS.some((token) => ua.includes(token));
}

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  const ua = lower(userAgent);
  return MOBILE_TOKENS.some((token) => ua.includes(token));
}

/**
 * Which ad network a row came from, normalised.
 *
 * utm_source is the PLACEMENT on Meta — real traffic arrives as `ig` or `fb`,
 * never as `meta` — so grouping on the raw value would split one network into
 * two rows that each look half as effective as it is.
 */
export function networkOf(utm: Record<string, string> | null | undefined): 'snap' | 'meta' | 'other' {
  const source = lower(utm?.utm_source);
  if (source === 'snapchat' || source === 'snap') return 'snap';
  if (source === 'ig' || source === 'fb' || source === 'instagram' || source === 'facebook') return 'meta';
  return 'other';
}

/**
 * Decide whether a landing-page row counts as real ad traffic.
 *
 * The desktop-on-Snap rule is the one doing the work, and it is a statement
 * about how the product works rather than a heuristic: Snapchat ads are served
 * inside the Snapchat app, which exists only on phones. A hit carrying Snap's
 * own utm parameters from desktop Safari did not come from someone swiping an
 * advert. It came from the review crawler, a shared link, or a pasted URL — all
 * real events, none of them a paid click, and none of them something the cost
 * per signup should be divided by.
 *
 * Meta is deliberately NOT subject to that rule. Facebook has a genuine desktop
 * web surface and desktop ads on it convert, so excluding desktop Meta traffic
 * would be throwing away customers to tidy a chart.
 */
export function classifyTraffic(row: {
  user_agent?: string | null;
  utm?: Record<string, string> | null;
}): Classified {
  const ua = row.user_agent;

  if (!ua) return { counted: false, reason: 'no_user_agent' };
  if (isCrawlerUserAgent(ua)) return { counted: false, reason: 'crawler' };

  if (networkOf(row.utm) === 'snap' && !isMobileUserAgent(ua)) {
    return { counted: false, reason: 'desktop_on_snap' };
  }

  return { counted: true, reason: null };
}

export interface TrafficSplit<T> {
  counted: T[];
  excluded: T[];
  byReason: Record<string, number>;
}

/**
 * Split rows into what the rates may be computed from and what may not.
 *
 * Both halves are returned. The caller reports the excluded count rather than
 * quietly presenting a smaller denominator as though it were the whole truth.
 */
export function splitTraffic<T extends { user_agent?: string | null; utm?: Record<string, string> | null }>(
  rows: T[]
): TrafficSplit<T> {
  const counted: T[] = [];
  const excluded: T[] = [];
  const byReason: Record<string, number> = {};

  for (const row of rows) {
    const verdict = classifyTraffic(row);
    if (verdict.counted) {
      counted.push(row);
    } else {
      excluded.push(row);
      const key = verdict.reason ?? 'unknown';
      byReason[key] = (byReason[key] ?? 0) + 1;
    }
  }

  return { counted, excluded, byReason };
}

/**
 * The ad set a row belongs to, and the key everything joins on.
 *
 * AD SET, NOT CAMPAIGN, because that is the unit of decision here — one audience,
 * one placement, one optimisation goal — and because two live Snap campaigns
 * share the identical name `RA_TRAFFIC_GET_IN_BLR_TOF_202608` with different ids,
 * so a campaign name is not even unique.
 *
 * The id lives in a different parameter per network, which is the sort of thing
 * that silently produces a join of zero rows:
 *   · Snap  — the ad set UUID arrives in utm_id, which SNAPCHAT APPENDS ITSELF.
 *     Verified 2026-08-10: the creative URLs provably contain no utm_id (regex
 *     checked against all eight URL fields) yet every delivered impression
 *     carries one, resolved. utm_campaign holds the ad set NAME rather than the
 *     campaign name, and utm_term arrives either absent or as Snap's own BGID_n.
 *   · Meta  — utm_term holds the ad set id; utm_campaign and utm_id both hold
 *     the campaign id.
 *
 * On Snap both utm_term and utm_id are therefore read, and whichever looks like
 * a UUID wins. We now also set utm_term={{adSet.id}} on the creatives, so the
 * two will agree once that change finishes propagating through ad review — but
 * one is ours and documented while the other is an undocumented injection that
 * could stop at any time, and depending on either alone is a single point of
 * failure for the entire cost-per-signup column.
 *
 * BGID_n is rejected by the UUID shape test rather than by name, so a value we
 * have not seen before fails closed instead of being joined to nothing.
 *
 * Falls back to the ad set name so rows recorded before the id parameters
 * existed still group with their descendants rather than forming a second,
 * spend-less row for the same ad set.
 */
export function adSetKeyOf(utm: Record<string, string> | null | undefined): {
  network: 'snap' | 'meta' | 'other';
  adSetId: string | null;
  adSetName: string | null;
  key: string;
} {
  const network = networkOf(utm);
  const raw = utm ?? {};

  // A macro that failed to resolve is stored verbatim, e.g. "{{adSet.id}}".
  // Treated as absent: joining on it would merge every unresolved row into one
  // fictitious ad set.
  const clean = (v: string | undefined): string | null =>
    v && v.trim() && !v.includes('{{') ? v.trim() : null;

  // Snap ad set ids are UUIDs. Shape-testing rather than trusting a parameter
  // name is what makes BGID_7 fail closed instead of becoming a fictitious ad set.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidOrNull = (v: string | undefined): string | null => {
    const c = clean(v);
    return c && UUID.test(c) ? c : null;
  };

  const adSetId =
    network === 'snap'
      ? // Ours first, Snap's injection second — see the note above about why both.
        uuidOrNull(raw.utm_term) ?? uuidOrNull(raw.utm_id)
      : network === 'meta'
        ? clean(raw.utm_term)
        : null;
  const adSetName = clean(raw.utm_campaign);

  return {
    network,
    adSetId,
    adSetName,
    // Network-prefixed so a numeric Meta id can never collide with a Snap one.
    key: adSetId ? `${network}:${adSetId}` : adSetName ? `${network}:name:${adSetName}` : `${network}:(none)`
  };
}
