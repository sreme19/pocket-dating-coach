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
import { IST_TIMEZONE, addDays, daysBetween, istDay } from '$lib/ist-dates';

/** Rates computed on fewer than this many observations are suppressed. */
export const MIN_SAMPLE = 30;

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

function emptyDayMap(start: string, end: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (let d = start; d <= end; d = addDays(d, 1)) out[d] = 0;
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
      .select('visit_id,page,cta,campaign,country,snap_forwarded,meta_forwarded,forward_error,created_at')
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

  const viewRows = views.data ?? [];
  const clickRows = clicks.data ?? [];
  const spendRows = spend.data ?? [];
  const acqRows = acquisition.data ?? [];
  const memberRows = (members.data ?? []).filter((m: any) => !m.is_seed && !m.is_provisional);
  const lpRows = lpSessions.data ?? [];
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

  const viewsByDay = emptyDayMap(start, end);
  const clicksByDay = emptyDayMap(start, end);
  const signupsByDay = emptyDayMap(start, end);
  const spendByDay = emptyDayMap(start, end);

  for (const v of viewRows) bump(viewsByDay, istDay(v.created_at));
  for (const c of clickRows) bump(clicksByDay, istDay(c.created_at));
  for (const m of memberRows) bump(signupsByDay, istDay(m.created_at));
  for (const s of spendRows) {
    // Spend is already a network day, not a timestamp — see the migration note
    // about the two not necessarily meaning the same 24 hours.
    if (s.date >= start && s.date <= end) bump(spendByDay, s.date, toDisplay(Number(s.spend), s.currency, s.date));
  }

  /* ------------------------------------------------------- campaign rollup */

  type Campaign = {
    campaign: string;
    spend: number;
    impressions: number;
    networkClicks: number;
    views: number;
    taps: number;
    signups: number;
  };
  const campaigns = new Map<string, Campaign>();
  const of = (name: string | null | undefined): Campaign => {
    const key = name && name.trim() ? name : '(none)';
    if (!campaigns.has(key)) {
      campaigns.set(key, {
        campaign: key,
        spend: 0,
        impressions: 0,
        networkClicks: 0,
        views: 0,
        taps: 0,
        signups: 0
      });
    }
    return campaigns.get(key)!;
  };

  for (const s of spendRows) {
    const c = of(s.campaign_name ?? s.campaign_id);
    c.spend += toDisplay(Number(s.spend), s.currency, s.date);
    c.impressions += Number(s.impressions ?? 0);
    c.networkClicks += Number(s.clicks ?? 0);
  }
  for (const v of viewRows) of(v.campaign).views += 1;
  for (const c of clickRows) of(c.campaign).taps += 1;
  for (const a of acqRows) of(a.campaign).signups += 1;

  const leaderboard = [...campaigns.values()]
    .map((c) => ({
      ...c,
      // Per-visit, not two totals divided by each other: a visit that produced
      // three taps is one converted visit, and reloads do not push it over 100%.
      tapRate: rate(c.taps, c.views),
      signupRate: rate(c.signups, c.taps),
      costPerSignup: c.signups > 0 && c.spend > 0 ? c.spend / c.signups : null,
      costPerTap: c.taps > 0 && c.spend > 0 ? c.spend / c.taps : null,
      tapRateInterval: c.views > 0 ? wilson(c.taps, c.views) : null
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
  }
  if (fxMissing) {
    anomalies.push(`Spend in a currency with no ${opts.currency} rate was excluded — add a row to ad_fx_rates.`);
  }

  return {
    range: { start, end, days, currency: opts.currency, timezone: IST_TIMEZONE },
    minSample: MIN_SAMPLE,
    trends: { views: viewsByDay, taps: clicksByDay, signups: signupsByDay, spend: spendByDay },
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
