/**
 * Meta Marketing API (Insights) — daily spend per AD.
 *
 * Differs from Snap in three ways worth knowing before reading the code.
 *
 * SPEND IS ALREADY A DECIMAL STRING in the account's currency — no micro-units.
 * It is passed through as a string rather than parsed, for the same reason Snap's
 * micro integer is divided as a string: the value goes into a numeric column and
 * a round trip through a double is the one step that could lose a paisa.
 *
 * ONE ROW PER DAY PER AD comes from `time_increment=1`. Without it the API
 * returns a single aggregate for the whole range, which looks plausible, sums
 * correctly, and destroys every trend chart on the dashboard.
 *
 * TOKENS EXPIRE SILENTLY. A user access token dies at around 60 days and the API
 * then answers 190 on every call — which, without the error surfacing, is
 * indistinguishable from a campaign that stopped spending. Generate the token as
 * a System User token in Business Manager, which does not expire; the health
 * panel exists to make the difference visible when it does happen.
 *
 * Returns an empty result rather than throwing when unconfigured, so this ships
 * inert and starts working the moment META_MARKETING_TOKEN is set.
 *
 * FETCHED AT AD LEVEL, NOT CAMPAIGN, so the same rows carry campaign, ad set and
 * ad names/ids in one pass — no separate campaign-level call, and no risk of the
 * two grains disagreeing or double-counting the way `dropStaleCoarserRows` in
 * `sync.ts` exists to guard against on the Snap side. Rolling these rows up by
 * campaign_id (or by ad_set_id) reproduces exactly what a campaign-level (or
 * ad-set-level) fetch would have returned, so nothing is lost by going straight
 * to the finest grain. UNVERIFIED AGAINST THE LIVE API: this account has never
 * had META_MARKETING_TOKEN set (see the Ad Analytics memory), so the exact field
 * names below (`adset_id`/`adset_name`/`ad_id`/`ad_name`) are Meta's documented
 * Insights breakdown fields, not something this code has ever seen a real
 * response for.
 */

import { env } from '$env/dynamic/private';
import type { DemographicResult, DemographicRow, FetchResult, SpendRow } from './snap';

const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;
const TIMEOUT_MS = 20_000;

function credentials() {
  const token = env.META_MARKETING_TOKEN ?? env.META_ADS_TOKEN ?? '';
  const raw = env.META_AD_ACCOUNT_ID ?? env.META_MARKETING_AD_ACCOUNT_ID ?? '';
  // The Graph API wants `act_<id>`; the dashboard shows the bare number. Accept
  // either so a correct id in the wrong shape is not a silent zero.
  const adAccountId = raw && !raw.startsWith('act_') ? `act_${raw}` : raw;
  return { token, adAccountId };
}

/** Which credential names are present. Values are never returned — only presence. */
export function metaConfigStatus(): Record<string, boolean> {
  const c = credentials();
  return { token: Boolean(c.token), adAccountId: Boolean(c.adAccountId) };
}

async function withTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function asInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

/** A decimal money string, kept as a string. Anything unparseable becomes '0'. */
function asDecimal(value: unknown): string {
  const raw = String(value ?? '0').trim();
  return /^-?\d+(\.\d+)?$/.test(raw) ? raw : '0';
}

export async function fetchMetaSpend(start: string, end: string): Promise<FetchResult> {
  const { token, adAccountId } = credentials();
  if (!token || !adAccountId) return { rows: [], error: null, configured: false };

  const params = new URLSearchParams({
    level: 'ad',
    // One row per day. Without it the range collapses into a single total.
    time_increment: '1',
    fields:
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,account_currency,date_start',
    time_range: JSON.stringify({ since: start, until: end }),
    limit: '500',
    access_token: token
  });

  try {
    const res = await withTimeout(`${API_BASE}/${adAccountId}/insights?${params}`);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Meta reports an expired or revoked token as a 190 inside the body. Said
      // plainly here because "spend is zero" and "the token died" look identical
      // on a chart and mean entirely different things.
      const hint = text.includes('"code":190') ? ' — access token expired or revoked' : '';
      return { rows: [], error: `insights ${res.status}${hint}: ${text.slice(0, 300)}`, configured: true };
    }

    const body = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };

    const rows: SpendRow[] = (body?.data ?? []).map((row) => ({
      network: 'meta' as const,
      date: String(row.date_start ?? '').slice(0, 10),
      campaignId: String(row.campaign_id ?? ''),
      campaignName: (row.campaign_name as string) ?? null,
      adSetId: String(row.adset_id ?? ''),
      adSetName: (row.adset_name as string) ?? null,
      creativeId: String(row.ad_id ?? ''),
      creativeName: (row.ad_name as string) ?? null,
      spend: asDecimal(row.spend),
      currency: String(row.account_currency ?? 'USD'),
      impressions: asInt(row.impressions),
      clicks: asInt(row.clicks),
      networkConversions: 0,
      // Meta reports in the ad account's timezone but does not return it on the
      // insights row. Left null rather than guessed — a wrong timezone recorded
      // as fact is worse than an absent one.
      accountTimezone: null,
      // `effective_status` lives on the entity-read endpoint, not on an Insights
      // row — a separate API call this function does not make. Null until
      // that's wired up, same as every other Meta row here until credentials
      // exist to test any of it against.
      status: null
    }));

    return { rows: rows.filter((r) => r.date), error: null, configured: true };
  } catch (err) {
    return { rows: [], error: String(err).slice(0, 300), configured: true };
  }
}

/**
 * Delivery demographics per campaign-day.
 *
 * ONE CALL PER DIMENSION, and the money is never re-added on our side. `age` and
 * `gender` can be requested together, and doing so looks like a saving right up
 * to the point where the age partition has to be recovered by summing decimal
 * money strings in JavaScript — the one step capable of losing a paisa on a
 * column whose entire job is to be money. Three calls, three partitions, no
 * arithmetic. Meta charges nothing for the extra round trips.
 *
 * `region` IS THE ONE WORTH READING FIRST. It is the closest thing either network
 * reports to the first-party city data now landing in marketing_page_views, so
 * the two can be held against each other: the network's account of where it
 * delivered, beside our own account of who actually arrived. When those disagree,
 * the first-party number is the one that was not written by the party being paid.
 *
 * WHAT THESE ROWS DESCRIBE. Impressions — everybody the advert was SHOWN to. Not
 * our visitors, and not the targeting. See the migration for why that distinction
 * has to survive all the way onto the dashboard.
 */
const META_BREAKDOWNS: Array<{ dimension: DemographicRow['dimension']; param: string; key: string }> = [
  { dimension: 'age', param: 'age', key: 'age' },
  { dimension: 'gender', param: 'gender', key: 'gender' },
  { dimension: 'region', param: 'region', key: 'region' }
];

export async function fetchMetaDemographics(start: string, end: string): Promise<DemographicResult> {
  const { token, adAccountId } = credentials();
  if (!token || !adAccountId) return { rows: [], error: null, configured: false };

  const rows: DemographicRow[] = [];
  const errors: string[] = [];

  for (const { dimension, param, key } of META_BREAKDOWNS) {
    const params = new URLSearchParams({
      level: 'campaign',
      // One row per day, for the same reason as the spend fetch: without it the
      // range collapses to a single total that sums correctly and destroys every
      // trend on the dashboard.
      time_increment: '1',
      breakdowns: param,
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,account_currency,date_start',
      time_range: JSON.stringify({ since: start, until: end }),
      limit: '500',
      access_token: token
    });

    try {
      const res = await withTimeout(`${API_BASE}/${adAccountId}/insights?${params}`);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const hint = text.includes('"code":190') ? ' — access token expired or revoked' : '';
        errors.push(`${param} ${res.status}${hint}: ${text.slice(0, 160)}`);
        continue;
      }

      const body = (await res.json()) as { data?: Array<Record<string, unknown>> };

      for (const row of body?.data ?? []) {
        const date = String(row.date_start ?? '').slice(0, 10);
        const bucket = row[key];
        // A row whose bucket is absent is not a bucket called "unknown" — it is a
        // response shape this code does not understand, and inventing a label for
        // it would put a fabricated category on a spend chart.
        if (!date || bucket === undefined || bucket === null || bucket === '') continue;

        rows.push({
          network: 'meta',
          date,
          campaignId: String(row.campaign_id ?? ''),
          campaignName: (row.campaign_name as string) ?? null,
          dimension,
          bucket: String(bucket).slice(0, 120),
          spend: asDecimal(row.spend),
          currency: String(row.account_currency ?? 'USD'),
          impressions: asInt(row.impressions),
          clicks: asInt(row.clicks),
          // Meta does not return the account timezone on an insights row. Left
          // null rather than guessed — see the spend fetch.
          accountTimezone: null
        });
      }
    } catch (err) {
      errors.push(`${param}: ${String(err).slice(0, 160)}`);
    }
  }

  return {
    rows,
    // Partial failure is reported rather than swallowed: two dimensions working
    // and one silently failing looks exactly like an audience with no rows in
    // that partition.
    error: errors.length ? `meta demographics: ${errors.join(' | ').slice(0, 300)}` : null,
    configured: true
  };
}
