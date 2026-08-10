/**
 * Aggregation behind the admin Ad Analytics tab.
 *
 * Three rules are enforced here rather than in the UI, because a chart that
 * decides these for itself is a chart that quietly disagrees with the one next
 * to it.
 *
 * DAYS ARE IST DAYS. Every timestamp is bucketed by Asia/Kolkata, not UTC. The
 * operating day is Indian, and bucketing by UTC would file roughly the first
 * five and a half hours of every day's activity into the day before — which is
 * invisible in a total and badly wrong in a trend.
 *
 * RATES BELOW A MINIMUM SAMPLE ARE NOT SHOWN. At present volumes almost every
 * per-campaign comparison is noise, and a dashboard that renders "40% better"
 * off five visitors against three will cause worse decisions than no dashboard.
 * Anything under MIN_SAMPLE returns null, which the UI renders as "not enough
 * data" rather than as a number.
 *
 * ABSENT IS NOT ZERO. iOS has no install referrer, taps from before the visit-id
 * beacon carry no visit, and an unconfigured ad network reports nothing. All
 * three arrive as null and none of them mean "zero happened". They are counted
 * and reported separately so the difference stays visible.
 */

import { getSupabase } from '$lib/server/supabase';
import {
  IST_TIMEZONE,
  addDays,
  daysBetween,
  istBucket,
  istBucketKeys,
  istDay,
  type Granularity
} from '$lib/ist-dates';
import { REASON_LABEL, adSetKeyOf, networkOf, splitTraffic } from '$lib/server/traffic-quality';
import { audienceOf, type Audience } from '$lib/server/ad-audience';

/** Rates computed on fewer than this many observations are suppressed. */
export const MIN_SAMPLE = 30;

/**
 * A single minute is called a burst above these two thresholds together.
 *
 * Both are needed. The share alone would flag a quiet range where 3 of 4 views
 * happened to share a minute; the count alone would flag a genuinely busy
 * minute on a day that had thousands of views spread evenly.
 */
export const BURST_MIN_VIEWS = 10;
export const BURST_MIN_SHARE = 0.2;

/**
 * Clicks charged for, with zero arrivals, before it is called a broken
 * destination rather than ordinary drop-off.
 *
 * Twenty is comfortably past the point where "everyone happened to bounce before
 * the beacon fired" stops being a plausible explanation.
 */
export const PAID_NO_TRAFFIC_MIN_CLICKS = 20;

/**
 * A rate, or null when the denominator is too small to mean anything.
 *
 * Returning null rather than 0 matters: zero is a finding, "we cannot tell" is
 * not, and rendering the second as the first is how a campaign gets paused for
 * having had four visitors.
 */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator < MIN_SAMPLE) return null;
  return numerator / denominator;
}

/** Wilson score interval — honest error bars on a proportion at small n. */
export function wilson(successes: number, total: number, z = 1.96): [number, number] | null {
  if (total === 0) return null;
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, (centre - spread) / denom), Math.min(1, (centre + spread) / denom)];
}

/**
 * Every bucket in the range, pre-set to zero.
 *
 * Zero-filled rather than sparse on purpose. A chart built only from buckets
 * that had events joins straight across the gaps, which reads as steady low
 * traffic instead of as nothing happening. At hourly granularity most buckets
 * are legitimately zero and the chart has to say so.
 */
function emptyBucketMap(start: string, end: string, g: Granularity): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of istBucketKeys(start, end, g)) out[key] = 0;
  return out;
}

function bump(map: Record<string, number>, key: string, by = 1) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + by;
}

export interface AdAnalyticsOptions {
  /** First IST day to include, 'YYYY-MM-DD'. */
  start: string;
  /** Last IST day to include, inclusive. */
  end: string;
  /** Display currency. Spend is stored in the ad account's own currency. */
  currency: 'INR' | 'USD';
  /**
   * Trend bucket size. Already validated against the span by resolveGranularity
   * in the endpoint, so the cap is not re-checked here.
   */
  granularity: Granularity;
  /** Restrict views and taps to one ad network. 'all' by default. */
  network?: 'all' | 'snap' | 'meta' | 'other';
  /**
   * Restrict views and taps to one targeted audience, derived from campaign and
   * creative naming — NOT the gender of the person who arrived, which a landing
   * page cannot know. See ad-audience.ts.
   */
  audience?: 'all' | Audience;
}

/**
 * Everything the Ad Analytics tab renders, in one round of parallel queries.
 *
 * Deliberately NOT folded into the admin/analytics page load, which already runs
 * ten queries plus a batched auth lookup per user and takes seconds. This is
 * fetched when the tab is first opened, the same way the Activity tab works.
 */
export async function buildAdAnalytics(opts: AdAnalyticsOptions) {
  const supabase = getSupabase();

  // Already resolved and bounds-checked by resolveIstRange in the endpoint, so
  // these are trusted here: two real IST days, in order, ending no later than
  // today and spanning no more than MAX_RANGE_DAYS.
  const { start, end } = opts;
  const days = daysBetween(start, end);
  // Queried in UTC with a day of slack on each side, because an IST day starts
  // 5h30m before the UTC one and rows near the boundary belong to a different
  // bucket than a naive UTC range would collect.
  const fromIso = `${addDays(start, -1)}T00:00:00.000Z`;
  const toIso = `${addDays(end, 1)}T23:59:59.999Z`;

  const [views, clicks, spend, acquisition, members, lpSessions, fx] = await Promise.all([
    supabase
      .from('marketing_page_views')
      .select('visit_id,page,campaign,country,user_agent,utm,created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('marketing_store_clicks')
      // user_agent and utm are load-bearing, not extra: without them every tap
      // classifies as "no user agent" and is excluded, and no tap can be joined
      // to an ad set. Omitting them silently zeroes the tap column.
      .select(
        'visit_id,page,cta,campaign,country,user_agent,utm,snap_forwarded,meta_forwarded,forward_error,created_at'
      )
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase.from('ad_spend_daily').select('*').gte('date', start).lte('date', end),
    supabase
      .from('user_acquisition')
      .select('user_id,network,campaign,creative,ad_set,landing_page,platform,created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    // Signups. verified_vibe_users rather than auth.users on purpose: the row is
    // written at signup, and reading auth.users means the batched admin lookup
    // that already makes the Overview tab slow. Seeds and provisional rows are
    // excluded — /aibestie mints a provisional user on a visitor's first message,
    // and counting those as signups would report conversions that are not people.
    supabase
      .from('verified_vibe_users')
      .select('id,gender,created_at,is_seed,is_provisional')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('aibestie_lp_sessions')
      .select('id,turns,bar_percent,materialized_at,cta_clicked_at,claimed_at,utm,created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase.from('ad_fx_rates').select('date,base,quote,rate').gte('date', addDays(start, -30))
  ]);

  /**
   * SPEND THE OVER-FETCH SLACK HERE, AND NOWHERE ELSE.
   *
   * The queries above deliberately widen the window by a day on each side,
   * because an IST day begins 5h30m before the UTC one and a naive UTC range
   * drops rows belonging in the first bucket. That slack is for making boundary
   * rows *available*; it is not licence to count them.
   *
   * Trimming it once, here, is the only place this can be done safely. Almost
   * everything below counts rows — the campaign leaderboard, the visit funnel,
   * the CTA and country splits, the health totals — so untrimmed slack credits
   * the range with up to a day of events from outside it. It is a nasty bug to
   * notice, because every number inflates together and the page stays
   * self-consistent while disagreeing with the dates at the top of it.
   */
  const inRange = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const d = istDay(iso);
    return d >= start && d <= end;
  };

  const viewsInRange = (views.data ?? []).filter((r: any) => inRange(r.created_at));
  const clicksInRange = (clicks.data ?? []).filter((r: any) => inRange(r.created_at));

  /**
   * SET ASIDE WHAT WAS NEVER A PAID CLICK, BEFORE ANYTHING IS COUNTED.
   *
   * Sixty percent of the landing-page table was Snap's ad-review crawler — it
   * fetches the page every time a creative is edited, from desktop macOS, in
   * bursts, on campaigns targeting India only. Left in, it inflates views
   * without inflating taps, so every rate deflates and every campaign flattens
   * toward the others; and it flattens worst whichever campaign was most
   * recently edited, which is exactly the one being evaluated.
   *
   * Both halves are kept. `traffic` below reports how many rows were set aside
   * and why, so a reader can see the denominator was reduced rather than
   * discovering a quietly smaller number.
   */
  const viewSplit = splitTraffic<any>(viewsInRange);
  const clickSplit = splitTraffic<any>(clicksInRange);

  /**
   * NETWORK AND AUDIENCE FILTER, APPLIED AFTER THE QUALITY SPLIT.
   *
   * The order matters and composing matters. Filtering to Snap without first
   * removing what was never a paid click reports 179 views where 96 are real —
   * because nearly half of Snap's rows are the review crawler on desktop. Two
   * orthogonal questions ("which network?" and "was this a real click?") need two
   * filters that stack, not one that replaces the other.
   *
   * The unfiltered splits are computed below and returned whatever the filter is
   * set to, so narrowing the page never hides the denominator it narrowed away.
   */
  const networkFilter = opts.network ?? 'all';
  const audienceFilter = opts.audience ?? 'all';
  const matchesFilters = (row: any): boolean =>
    (networkFilter === 'all' || networkOf(row.utm) === networkFilter) &&
    (audienceFilter === 'all' || audienceOf(row) === audienceFilter);

  /** Counts per network and per audience, before either filter narrows anything. */
  const splitBy = <K extends string>(rows: any[], key: (r: any) => K) => {
    const out = {} as Record<K, number>;
    for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
    return out;
  };
  const facets = {
    network: {
      views: splitBy(viewSplit.counted, (r) => networkOf(r.utm)),
      taps: splitBy(clickSplit.counted, (r) => networkOf(r.utm)),
      viewsExcluded: splitBy(viewSplit.excluded, (r) => networkOf(r.utm))
    },
    audience: {
      views: splitBy(viewSplit.counted, (r) => audienceOf(r)),
      taps: splitBy(clickSplit.counted, (r) => audienceOf(r)),
      viewsExcluded: splitBy(viewSplit.excluded, (r) => audienceOf(r))
    }
  };

  const viewRows = viewSplit.counted.filter(matchesFilters);
  const clickRows = clickSplit.counted.filter(matchesFilters);
  const spendRows = spend.data ?? [];
  const acqRows = (acquisition.data ?? []).filter((r: any) => inRange(r.created_at));
  const memberRows = (members.data ?? []).filter(
    (m: any) => !m.is_seed && !m.is_provisional && inRange(m.created_at)
  );
  const lpRows = (lpSessions.data ?? []).filter((r: any) => inRange(r.created_at));
  const fxRows = fx.data ?? [];

  /* ---------------------------------------------------------------- currency */

  // Latest rate on or before a date, so a weekend without a quote uses Friday's
  // rather than silently falling back to a rate from an unrelated month.
  const rateFor = (from: string, to: string, on: string): number | null => {
    if (from === to) return 1;
    const candidates = fxRows
      .filter((r: any) => r.base === from && r.quote === to && r.date <= on)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    if (candidates.length) return Number(candidates[0].rate);

    const inverse = fxRows
      .filter((r: any) => r.base === to && r.quote === from && r.date <= on)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    if (inverse.length) return 1 / Number(inverse[0].rate);
    return null;
  };

  let fxMissing = false;
  const toDisplay = (amount: number, from: string, on: string): number => {
    const r = rateFor(from, opts.currency, on);
    if (r === null) {
      // Counted and surfaced rather than silently treated as 1:1, which would
      // under-report dollar spend in rupees by a factor of ~85.
      fxMissing = true;
      return 0;
    }
    return amount * r;
  };

  /* ------------------------------------------------------------------ trends */

  const g = opts.granularity;
  const viewsByBucket = emptyBucketMap(start, end, g);
  const clicksByBucket = emptyBucketMap(start, end, g);
  const signupsByBucket = emptyBucketMap(start, end, g);

  for (const v of viewRows) bump(viewsByBucket, istBucket(v.created_at, g));
  for (const c of clickRows) bump(clicksByBucket, istBucket(c.created_at, g));
  for (const m of memberRows) bump(signupsByBucket, istBucket(m.created_at, g));

  // SPEND IS ALWAYS DAY-KEYED, whatever the granularity is, which is why it sits
  // outside `trends` rather than beside three bucket-keyed series in the same
  // object. `ad_spend_daily` has no time of day in it — the networks report a
  // day at a time — so an hourly spend series could only be a daily total
  // divided by 24. That is not a finer measurement, it is a fabricated one, and
  // every cost-per-thing derived from it would inherit the fabrication.
  // Views bucketed by DAY as well, whatever the display granularity is. The
  // decline anomaly below compares a day against the prior seven days; run over
  // hourly buckets it would silently start comparing an hour against seven hours
  // and fire constantly on ordinary overnight quiet.
  const viewsByDay = g === 'day' ? viewsByBucket : emptyBucketMap(start, end, 'day');
  if (g !== 'day') for (const v of viewRows) bump(viewsByDay, istBucket(v.created_at, 'day'));

  const spendByDay = emptyBucketMap(start, end, 'day');
  for (const s of spendRows) {
    // Spend is already a network day, not a timestamp — see the migration note
    // about the two not necessarily meaning the same 24 hours.
    if (s.date >= start && s.date <= end) bump(spendByDay, s.date, toDisplay(Number(s.spend), s.currency, s.date));
  }

  /* -------------------------------------------------------- ad set rollup */

  /**
   * KEYED ON AD SET, NOT CAMPAIGN, because that is the only key both sides share.
   *
   * The landing page URLs identify the ad set: Snap puts the ad set NAME in
   * utm_campaign and the ad set id in utm_term. Spend arrives from the Marketing
   * API keyed on ad_set_id. Grouping on a campaign name instead matches nothing —
   * Snap's stats carry ids with no names, and two live campaigns share the
   * identical name `RA_TRAFFIC_GET_IN_BLR_TOF_202608` with different ids, so a
   * campaign name is not even unique. The result was a leaderboard with spend on
   * one row and the traffic it paid for on another.
   *
   * The ad set is also the right unit of decision: one audience, one placement,
   * one optimisation goal.
   */
  type AdSet = {
    /** Display label. Named `campaign` so existing UI bindings keep working. */
    campaign: string;
    adSetId: string | null;
    network: string;
    spend: number;
    impressions: number;
    networkClicks: number;
    views: number;
    taps: number;
    signups: number;
  };
  const adSets = new Map<string, AdSet>();
  const of = (key: string, label: string | null, network: string, adSetId: string | null): AdSet => {
    if (!adSets.has(key)) {
      adSets.set(key, {
        campaign: label && label.trim() ? label : '(unattributed)',
        adSetId,
        network,
        spend: 0,
        impressions: 0,
        networkClicks: 0,
        views: 0,
        taps: 0,
        signups: 0
      });
    }
    const row = adSets.get(key)!;
    // Spend knows the real ad set name; traffic only knows what the ad URL said.
    // Prefer whichever arrives with a proper label.
    if (label && label.trim() && row.campaign === '(unattributed)') row.campaign = label;
    return row;
  };

  /**
   * NAME RECONCILIATION, for traffic whose utm_term never resolved to an id.
   *
   * While `{{adSet.id}}` was still propagating through Snap ad review, some
   * landing-page hits carry the literal macro instead of an id. Those fell back
   * to a name key and appeared as a SECOND leaderboard row for an ad set that
   * already had one — spend and impressions on the upper row, part of the traffic
   * on the lower, and each half looking worse than the ad set really is. It is
   * near-invisible because the two labels differ only in case and separators:
   *
   *   traffic utm_campaign : men_25_40_casual_story_ind_lpv
   *   spend   ad_set_name  : MEN_25-40_CASUAL_STORY_IND-LPV
   *
   * Lowercasing is not enough — '_' against '-' still differs — so the index is
   * keyed on the name with every non-alphanumeric character stripped.
   *
   * Deliberately one-directional: id-less traffic may merge INTO an ad set that
   * spend gave a real id to, and never the other way. Two id-less rows sharing a
   * name are NOT merged with each other — that is a different claim, and nothing
   * here has the authority to make it.
   *
   * Temporary by design. These rows shrink on their own as the macro propagates;
   * utm_term stays the primary key.
   */
  const normName = (s: string | null | undefined) =>
    (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  /** `${network}:${normalised name}` -> rollup key, only for ids spend confirmed. */
  const byNormName = new Map<string, string>();

  for (const s of spendRows) {
    const id = s.ad_set_id || null;
    const key = id ? `${s.network}:${id}` : `${s.network}:name:${s.campaign_name ?? s.campaign_id}`;
    const row = of(key, s.ad_set_name ?? s.campaign_name ?? s.campaign_id, s.network, id);
    row.spend += toDisplay(Number(s.spend), s.currency, s.date);
    row.impressions += Number(s.impressions ?? 0);
    row.networkClicks += Number(s.clicks ?? 0);
    // Network-scoped, so a numeric Meta name can never merge into a Snap ad set.
    if (id && s.ad_set_name) {
      const n = normName(s.ad_set_name);
      if (n) byNormName.set(`${s.network}:${n}`, key);
    }
  }

  /**
   * Where an id-less traffic row belongs, and how confident that is.
   *
   * "Matched by name" and "could not be placed at all" are different confidence
   * levels, and only the second needs chasing — so they are counted separately
   * rather than summed into one number that hides the distinction.
   */
  let viewsReconciledByName = 0;
  let viewsUnattributed = 0;
  const placeRow = (utm: any, fallbackLabel: string | null) => {
    const k = adSetKeyOf(utm);
    if (k.adSetId) return { key: k.key, label: k.adSetName ?? fallbackLabel, k, matched: 'id' as const };

    const n = normName(k.adSetName ?? fallbackLabel);
    const hit = n ? byNormName.get(`${k.network}:${n}`) : undefined;
    if (hit) {
      // Keep the real ad set name that spend supplied, not the lowercase utm
      // value — passing null lets `of` leave the existing label alone.
      return { key: hit, label: null, k, matched: 'name' as const };
    }
    return { key: k.key, label: k.adSetName ?? fallbackLabel, k, matched: 'none' as const };
  };

  for (const v of viewRows) {
    // `campaign` is the denormalised utm_campaign on the row itself, and is the
    // only label available for traffic recorded before the utm parameters existed.
    const p = placeRow(v.utm, v.campaign);
    if (p.matched === 'name') viewsReconciledByName += 1;
    else if (p.matched === 'none') viewsUnattributed += 1;
    of(p.key, p.label, p.k.network, p.k.adSetId).views += 1;
  }
  for (const c of clickRows) {
    const p = placeRow(c.utm, c.campaign);
    of(p.key, p.label, p.k.network, p.k.adSetId).taps += 1;
  }
  for (const a of acqRows) {
    // user_acquisition stores the ad set id in `ad_set`, from the install referrer.
    const key = a.ad_set ? `${a.network === 'snapchat' ? 'snap' : a.network}:${a.ad_set}` : null;
    if (key) of(key, a.campaign, a.network ?? 'other', a.ad_set).signups += 1;
    else of(`${a.network ?? 'other'}:name:${a.campaign}`, a.campaign, a.network ?? 'other', null).signups += 1;
  }

  const leaderboard = [...adSets.values()]
    .map((c) => ({
      ...c,
      // Per-visit, not two totals divided by each other: a visit that produced
      // three taps is one converted visit, and reloads do not push it over 100%.
      tapRate: rate(c.taps, c.views),
      signupRate: rate(c.signups, c.taps),
      costPerSignup: c.signups > 0 && c.spend > 0 ? c.spend / c.signups : null,
      costPerTap: c.taps > 0 && c.spend > 0 ? c.spend / c.taps : null,
      costPerView: c.views > 0 && c.spend > 0 ? c.spend / c.views : null,
      /**
       * How many of the clicks the network charged for actually became a page
       * view. Measured at 12–39% on live data, so most of what is billed never
       * arrives — a leak upstream of every other number here, and invisible
       * unless network clicks and first-party views sit in the same row.
       */
      clickToViewRate: c.networkClicks > 0 ? c.views / c.networkClicks : null,
      tapRateInterval: c.views > 0 ? wilson(c.taps, c.views) : null,
      /**
       * Any evidence of activity in this range, from either side.
       *
       * Deliberately not `spend > 0 || impressions > 0`. Meta traffic arrives
       * with no spend rows at all, because those credentials were never set, and
       * an ad set with 13 landing-page views is plainly running — calling it
       * "not delivering" because the spend feed is silent would report a
       * configuration gap as an ad decision. Traffic counts as evidence.
       *
       * So `false` means genuinely inert here: nothing served, nothing charged,
       * nobody arrived.
       */
      delivering:
        c.spend > 0 || c.impressions > 0 || c.networkClicks > 0 || c.views > 0 || c.taps > 0,
      /**
       * Serving and being charged for, but nothing reaching the landing page.
       *
       * The worst state on this table and the one that looks quietest: it sits
       * among the delivering rows with a plausible spend and a column of zeros.
       * Live, two ad sets had 346 clicks Snap charged for and not one page view,
       * while the -LPV variants of the same audiences converted 47-54% — that is
       * a destination that does not land, not an audience that did not swipe.
       */
      paidButNoTraffic: (c.impressions > 0 || c.networkClicks > 0) && c.views === 0
    }))
    .sort((a, b) => b.spend - a.spend || b.views - a.views);

  /* ------------------------------------------------------ per-visit funnel */

  // The join the visit id exists for. Only visits that carry one can take part,
  // which is why the uncounted total is reported next to the rate.
  const visitsWithView = new Set(viewRows.map((v: any) => v.visit_id).filter(Boolean));
  const visitsThatTapped = new Set(
    clickRows.map((c: any) => c.visit_id).filter((id: string | null) => id && visitsWithView.has(id))
  );
  const tapsWithoutVisit = clickRows.filter((c: any) => !c.visit_id).length;

  /* ------------------------------------------------------------ breakdowns */

  const byCta: Record<string, number> = {};
  const byPage: Record<string, { views: number; taps: number }> = {};
  const byCountry: Record<string, { views: number; taps: number }> = {};

  for (const v of viewRows) {
    const page = v.page ?? 'unknown';
    byPage[page] ??= { views: 0, taps: 0 };
    byPage[page].views += 1;

    const country = v.country ?? 'unknown';
    byCountry[country] ??= { views: 0, taps: 0 };
    byCountry[country].views += 1;
  }
  for (const c of clickRows) {
    byCta[c.cta ?? 'unknown'] = (byCta[c.cta ?? 'unknown'] ?? 0) + 1;

    const page = c.page ?? 'unknown';
    byPage[page] ??= { views: 0, taps: 0 };
    byPage[page].taps += 1;

    const country = c.country ?? 'unknown';
    byCountry[country] ??= { views: 0, taps: 0 };
    byCountry[country].taps += 1;
  }

  /* -------------------------------------------------------- aibestie funnel */

  const lpFunnel = {
    opened: lpRows.length,
    spoke: lpRows.filter((s: any) => s.materialized_at).length,
    reached3Turns: lpRows.filter((s: any) => (s.turns ?? 0) >= 3).length,
    tappedCta: lpRows.filter((s: any) => s.cta_clicked_at).length,
    claimed: lpRows.filter((s: any) => s.claimed_at).length,
    turnHistogram: (() => {
      const buckets: Record<string, number> = { '0': 0, '1-2': 0, '3-5': 0, '6-9': 0, '10+': 0 };
      for (const s of lpRows) {
        const t = Number(s.turns ?? 0);
        if (t === 0) buckets['0'] += 1;
        else if (t <= 2) buckets['1-2'] += 1;
        else if (t <= 5) buckets['3-5'] += 1;
        else if (t <= 9) buckets['6-9'] += 1;
        else buckets['10+'] += 1;
      }
      return buckets;
    })()
  };

  /* ------------------------------------------------------------- attribution */

  const attributedSignups = acqRows.length;
  const totalSignups = memberRows.length;

  /**
   * Signups by ACTUAL gender — a different population from the audience filter.
   *
   * `verified_vibe_users.gender` is the only real gender in this whole file, and
   * it exists only for people who finished signing up. The audience filter above
   * is who the ad was AIMED at, read off campaign naming. A campaign targeting
   * men producing women signups is routine, and reporting the two in one column
   * would erase exactly that.
   *
   * NOT narrowed by the network or audience filter, and it cannot be: joining a
   * signup to the campaign that produced it needs `user_acquisition`, which has
   * no rows until the new Flutter build ships. So this is a whole-range total,
   * and `joinableToCampaign` says so rather than letting a filtered page imply
   * these signups came from the filtered traffic.
   */
  const signupGender = {
    man: memberRows.filter((m: any) => m.gender === 'man').length,
    woman: memberRows.filter((m: any) => m.gender === 'woman').length,
    unknown: memberRows.filter((m: any) => m.gender !== 'man' && m.gender !== 'woman').length,
    joinableToCampaign: acqRows.length > 0
  };
  const androidAttributed = acqRows.filter((a: any) => a.platform === 'android' && a.campaign).length;
  const iosMembers = acqRows.filter((a: any) => a.platform === 'ios').length;

  /* ---------------------------------------------------------------- health */

  const forwardErrors = clickRows.filter((c: any) => c.forward_error).slice(0, 5).map((c: any) => c.forward_error);
  const lastFetch: Record<string, string | null> = { snap: null, meta: null };
  for (const s of spendRows) {
    const seen = lastFetch[s.network];
    if (!seen || s.fetched_at > seen) lastFetch[s.network] = s.fetched_at;
  }

  const health = {
    // A missing table reports as an error rather than as an empty day, so a
    // migration that was never run cannot masquerade as "no traffic yet".
    tables: {
      pageViews: views.error?.message ?? null,
      storeClicks: clicks.error?.message ?? null,
      adSpend: spend.error?.message ?? null,
      acquisition: acquisition.error?.message ?? null
    },
    counts: {
      views: viewRows.length,
      taps: clickRows.length,
      spendRows: spendRows.length,
      attributedSignups,
      totalSignups
    },
    snapForwardOk: clickRows.filter((c: any) => c.snap_forwarded === true).length,
    snapForwardFailed: clickRows.filter((c: any) => c.snap_forwarded === false).length,
    metaForwardOk: clickRows.filter((c: any) => c.meta_forwarded === true).length,
    metaForwardFailed: clickRows.filter((c: any) => c.meta_forwarded === false).length,
    forwardErrors,
    lastSpendFetch: lastFetch,
    fxMissing,
    // The share of taps that can take part in the per-visit funnel at all.
    tapsWithoutVisit,
    attributionCoverage: rate(attributedSignups, totalSignups),
    iosMembers,
    androidAttributed
  };

  /* -------------------------------------------------------------- anomalies */

  const anomalies: string[] = [];
  const series = Object.entries(viewsByDay).sort(([a], [b]) => (a < b ? -1 : 1));
  if (series.length >= 8) {
    const recent = series[series.length - 2][1];
    const prior = series.slice(-9, -2).map(([, n]) => n);
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (mean >= 10 && recent < mean * 0.4) {
      anomalies.push(`Landing page views down ${Math.round((1 - recent / mean) * 100)}% vs the prior 7-day average.`);
    }
  }
  if (health.snapForwardFailed > 0 && health.snapForwardOk === 0) {
    anomalies.push('Every Snap conversion forward failed in this window — check SNAP_CAPI_TOKEN.');
  }
  if (health.metaForwardFailed > 0 && health.metaForwardOk === 0) {
    anomalies.push('Every Meta conversion forward failed in this window — check META_CAPI_TOKEN.');
  }
  for (const c of leaderboard) {
    if (c.taps >= MIN_SAMPLE && c.signups === 0) {
      anomalies.push(`${c.campaign}: ${c.taps} store taps and zero attributed signups.`);
    }
    /**
     * Paid clicks that never arrived. Flagged above the charts because it is a
     * spend leak rather than a performance reading: the ad set looks merely quiet
     * on the leaderboard while the network bills for clicks that land nowhere.
     *
     * Gated on the click count, not just impressions — a handful of clicks with
     * no view is ordinary drop-off, hundreds is a destination that does not work.
     */
    if (c.paidButNoTraffic && c.networkClicks >= PAID_NO_TRAFFIC_MIN_CLICKS) {
      anomalies.push(
        `${c.campaign}: ${c.networkClicks} clicks charged for and zero landing page views` +
          `${c.spend > 0 ? ` (${Math.round(c.spend)} ${opts.currency} spent)` : ''} — ` +
          `check where this ad set actually points.`
      );
    }
  }
  if (fxMissing) {
    anomalies.push(`Spend in a currency with no ${opts.currency} rate was excluded — add a row to ad_fx_rates.`);
  }

  /* ------------------------------------------------------- burst detection */

  // Computed at minute grain regardless of the granularity being displayed,
  // because the whole point is to catch a spike the chosen bucket size would
  // average away. A daily chart cannot show this and an hourly one barely can.
  //
  // Why it earns a place next to real errors: a single client hammering a
  // landing page inflates views without inflating taps, so it drags the tap
  // rate down and makes a working campaign look broken. The first time this
  // ran on real data, 72 of 139 views in a two-day range turned out to have
  // landed inside one minute.
  const viewsByMinute: Record<string, number> = {};
  for (const v of viewRows) {
    const key = istBucket(v.created_at, 'minute');
    if (key) viewsByMinute[key] = (viewsByMinute[key] ?? 0) + 1;
  }
  const peakMinute = Object.entries(viewsByMinute).sort((a, b) => b[1] - a[1])[0] ?? null;
  const totalViews = viewRows.length;
  const burst =
    peakMinute && peakMinute[1] >= BURST_MIN_VIEWS && peakMinute[1] / totalViews >= BURST_MIN_SHARE
      ? { at: peakMinute[0], views: peakMinute[1], shareOfRange: peakMinute[1] / totalViews }
      : null;

  if (burst) {
    const pct = Math.round(burst.shareOfRange * 100);
    anomalies.push(
      `${burst.views} of ${totalViews} page views (${pct}%) arrived in the single minute ${burst.at} IST — ` +
        `that is unlikely to be ${burst.views} people, and it deflates every rate computed against views.`
    );
  }

  return {
    range: {
      start,
      end,
      days,
      currency: opts.currency,
      timezone: IST_TIMEZONE,
      granularity: g,
      buckets: Object.keys(viewsByBucket).length,
      network: networkFilter,
      audience: audienceFilter
    },
    minSample: MIN_SAMPLE,
    // Shared so the row badge and the anomaly agree on when zero arrivals is a
    // broken destination rather than ordinary drop-off.
    paidNoTrafficMinClicks: PAID_NO_TRAFFIC_MIN_CLICKS,
    // Unfiltered, always — so narrowing the page never hides what it narrowed
    // away, and the filter chips can carry their own counts.
    facets,
    signupGender,
    /**
     * What was set aside, and why. Reported rather than silently applied: a
     * filter nobody can see is one that eventually drops something real without
     * anyone noticing, and the excluded share here is large enough (60% on first
     * measurement) that a reader deserves to know the denominator moved.
     */
    traffic: {
      viewsCounted: viewRows.length,
      viewsExcluded: viewSplit.excluded.length,
      tapsCounted: clickRows.length,
      tapsExcluded: clickSplit.excluded.length,
      byReason: Object.fromEntries(
        Object.entries(viewSplit.byReason).map(([reason, n]) => [
          reason,
          { count: n, label: REASON_LABEL[reason as keyof typeof REASON_LABEL] ?? reason }
        ])
      ),
      /**
       * Views with no resolvable ad set — pre-macro rows; shrinks on its own.
       *
       * Split by confidence, because they are not equally worrying: a name match
       * is placed and countable, an unattributed row is neither. The sum is what
       * this used to report as one figure.
       */
      viewsWithoutAdSet: viewsReconciledByName + viewsUnattributed,
      viewsReconciledByName,
      viewsUnattributed
    },
    trends: { views: viewsByBucket, taps: clicksByBucket, signups: signupsByBucket },
    // Day-keyed whatever `granularity` is — see the note where it is built.
    spendDaily: spendByDay,
    burst,
    leaderboard,
    visitFunnel: {
      visits: visitsWithView.size,
      tapped: visitsThatTapped.size,
      tapRate: rate(visitsThatTapped.size, visitsWithView.size),
      tapsWithoutVisit
    },
    byCta,
    byPage,
    byCountry,
    lpFunnel,
    health,
    anomalies
  };
}
