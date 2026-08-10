/**
 * Snap Marketing API — daily spend per campaign.
 *
 * Docs: https://developers.snap.com/api/marketing-api/Ads-API/measurement
 *
 * Three things about this API drive the shape of everything below.
 *
 * SPEND COMES BACK IN MICRO-CURRENCY. An integer, one millionth of the ad
 * account's currency unit. It is divided by 1,000,000 into a string and stored
 * as numeric, not parsed into a double first: a float divide reintroduces the
 * rounding error the integer representation existed to avoid, on a column whose
 * whole job is to be money.
 *
 * DAYS ARE THE AD ACCOUNT'S DAYS. start_time and end_time must land on day
 * boundaries in the account's own timezone, and the dates that come back are
 * expressed in it. That timezone is fetched and stored alongside the rows rather
 * than assumed to be IST, because a silent 5h30m offset would misfile every
 * day's spend by a fraction and nobody would ever notice.
 *
 * METRICS FINALISE 48 HOURS AFTER THE DAY ENDS. Yesterday's spend is not
 * yesterday's final spend. This is why the sync re-fetches a trailing window
 * instead of writing each day once, and why the table upserts on the full grain.
 *
 * Returns an empty result rather than throwing when unconfigured, so the cron
 * ships useful before any credentials exist and starts working the moment they
 * are set, with no code change.
 */

import { env } from '$env/dynamic/private';

const TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';
const API_BASE = 'https://adsapi.snapchat.com/v1';

const TIMEOUT_MS = 20_000;

export interface SpendRow {
  network: 'snap' | 'meta';
  date: string;
  campaignId: string;
  campaignName: string | null;
  adSetId: string;
  adSetName: string | null;
  creativeId: string;
  creativeName: string | null;
  spend: string;
  currency: string;
  impressions: number;
  clicks: number;
  networkConversions: number;
  accountTimezone: string | null;
}

export interface FetchResult {
  rows: SpendRow[];
  /** Null when it worked. A human-readable reason otherwise — shown in the health panel. */
  error: string | null;
  /** False when the integration simply is not configured, which is not a failure. */
  configured: boolean;
}

/**
 * Credentials are read under several names on purpose.
 *
 * These were set by hand in the Vercel dashboard before this code existed, so
 * the exact spelling is not something this file gets to assume. Checking the
 * obvious variants costs nothing and avoids the failure mode where everything is
 * correct except a word, and the dashboard reports a confident zero.
 */
function credentials() {
  const clientId = env.SNAP_MARKETING_CLIENT_ID ?? env.SNAP_CLIENT_ID ?? '';
  const clientSecret = env.SNAP_MARKETING_CLIENT_SECRET ?? env.SNAP_CLIENT_SECRET ?? '';
  const refreshToken = env.SNAP_MARKETING_REFRESH_TOKEN ?? env.SNAP_REFRESH_TOKEN ?? '';
  const adAccountId = env.SNAP_AD_ACCOUNT_ID ?? env.SNAP_MARKETING_AD_ACCOUNT_ID ?? '';
  return { clientId, clientSecret, refreshToken, adAccountId };
}

/** Which credential names are present. Values are never returned — only presence. */
export function snapConfigStatus(): Record<string, boolean> {
  const c = credentials();
  return {
    clientId: Boolean(c.clientId),
    clientSecret: Boolean(c.clientSecret),
    refreshToken: Boolean(c.refreshToken),
    adAccountId: Boolean(c.adAccountId)
  };
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exchange the long-lived refresh token for a short-lived access token.
 *
 * Snap access tokens expire in ~30 minutes, so there is nothing to cache across
 * cron runs and no token storage to keep in sync — every run mints a fresh one.
 */
async function accessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = credentials();

  const res = await withTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`token ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('token response had no access_token');
  return body.access_token;
}

/** The account's currency and timezone — needed to interpret every number below. */
async function accountMeta(token: string, adAccountId: string) {
  const res = await withTimeout(`${API_BASE}/adaccounts/${adAccountId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`adaccount ${res.status}`);

  const body = (await res.json()) as {
    adaccounts?: Array<{ adaccount?: { currency?: string; timezone?: string } }>;
  };
  const account = body.adaccounts?.[0]?.adaccount;
  return {
    currency: account?.currency ?? 'USD',
    timezone: account?.timezone ?? null
  };
}

/** Micro-currency integer to a decimal string, without ever touching a float. */
function fromMicro(micro: unknown): string {
  const n = typeof micro === 'number' ? Math.round(micro) : Number.parseInt(String(micro ?? '0'), 10);
  if (!Number.isFinite(n)) return '0';

  const negative = n < 0;
  const digits = Math.abs(n).toString().padStart(7, '0');
  const whole = digits.slice(0, -6);
  const fraction = digits.slice(-6);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function asInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The account timezone's UTC offset, as the suffix Snap wants on a timestamp.
 *
 * Derived, not hardcoded. Snap rejects a range whose bounds are not midnight in
 * the ad account's own timezone, and this account is Asia/Singapore (+08:00)
 * while the app reports in IST — so a literal '+08:00' works today and silently
 * misfiles every day the moment a second ad account exists in another zone, or
 * a zone with daylight saving is used. The account already tells us its timezone;
 * this turns that into an offset for the specific date being asked about, so a
 * DST transition inside the window cannot shift the boundary either.
 */
export function offsetSuffix(timeZone: string | null, onDate: string): string {
  if (!timeZone) return '+00:00';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset'
    }).formatToParts(new Date(`${onDate}T12:00:00.000Z`));

    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    // 'GMT+08:00' -> '+08:00'. Plain 'GMT' means zero offset.
    const match = name.match(/GMT([+-]\d{2}:\d{2})/);
    if (match) return match[1];
    if (name === 'GMT') return '+00:00';
  } catch {
    // An unrecognised zone name must not take the whole sync down.
  }
  return '+00:00';
}

/** `{ entities: [{ entity: {...} }] }` is Snap's shape for every list endpoint. */
async function listEntities<T>(token: string, url: string, key: string): Promise<T[]> {
  const res = await withTimeout(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${key} ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  const list = (body[key] as Array<Record<string, unknown>>) ?? [];
  // Each element wraps the object under its singular name.
  return list.map((row) => row[key.replace(/s$/, '')] as T).filter(Boolean);
}

/**
 * Daily ad-set spend between two dates, inclusive.
 *
 * AD SET LEVEL, NOT CAMPAIGN. The landing page URLs identify the ad SET — Snap
 * puts the ad set name in utm_campaign and appends the ad set id itself — so
 * campaign-level spend cannot be joined to the traffic it paid for. Two live
 * campaigns also share the identical name `RA_TRAFFIC_GET_IN_BLR_TOF_202608`
 * with different ids, which makes a campaign name useless as a key even where
 * one exists.
 *
 * NAMES COME FROM THE LIST ENDPOINTS, not from the stats response. Snap's stats
 * payload carries ids only, which is why the first 35 rows this ever wrote had a
 * null campaign_name and a leaderboard showing UUIDs. One call each for
 * campaigns and ad squads maps them back to something a human can read.
 *
 * Falls back to the old campaign-level breakdown if the ad-squad listing fails.
 * Coarse spend that still joins by date is worth far more than no spend at all.
 */
export async function fetchSnapSpend(start: string, end: string): Promise<FetchResult> {
  const { clientId, clientSecret, refreshToken, adAccountId } = credentials();

  if (!clientId || !clientSecret || !refreshToken || !adAccountId) {
    return { rows: [], error: null, configured: false };
  }

  try {
    const token = await accessToken();
    const meta = await accountMeta(token, adAccountId);

    // Boundaries must be midnight in the ACCOUNT's zone, not ours.
    const from = `${start}T00:00:00.000${offsetSuffix(meta.timezone, start)}`;
    // Exclusive upper bound: the API takes a half-open range, so the end date is
    // passed as the following midnight or its own day is silently omitted.
    const toDay = addDays(end, 1);
    const to = `${toDay}T00:00:00.000${offsetSuffix(meta.timezone, toDay)}`;

    let squads: Array<{ id?: string; name?: string; campaign_id?: string }>;
    try {
      squads = await listEntities(token, `${API_BASE}/adaccounts/${adAccountId}/adsquads?limit=500`, 'adsquads');
    } catch (err) {
      const fallback = await fetchCampaignBreakdown(token, adAccountId, from, to, meta);
      return {
        ...fallback,
        error: `ad squad listing failed (${String(err).slice(0, 120)}); fell back to campaign level`
      };
    }

    const campaignNames = new Map<string, string>();
    try {
      const campaigns = await listEntities<{ id?: string; name?: string }>(
        token,
        `${API_BASE}/adaccounts/${adAccountId}/campaigns?limit=500`,
        'campaigns'
      );
      for (const c of campaigns) if (c.id) campaignNames.set(c.id, c.name ?? '');
    } catch {
      // A missing name is cosmetic; a missing ad set id is not. Carry on.
    }

    const rows: SpendRow[] = [];
    const errors: string[] = [];

    for (const squad of squads) {
      if (!squad.id) continue;
      const params = new URLSearchParams({
        granularity: 'DAY',
        fields: 'spend,impressions,swipes,conversion_purchases',
        start_time: from,
        end_time: to
      });

      const res = await withTimeout(`${API_BASE}/adsquads/${squad.id}/stats?${params}`, {
        headers: { authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`${squad.name ?? squad.id}: ${res.status} ${text.slice(0, 80)}`);
        continue;
      }

      for (const point of pointsOf(await res.json())) {
        const day = (point.start_time ?? '').slice(0, 10);
        if (!day) continue;
        const stats = point.stats ?? {};
        rows.push({
          network: 'snap',
          date: day,
          campaignId: squad.campaign_id ?? '',
          campaignName: campaignNames.get(squad.campaign_id ?? '') ?? null,
          adSetId: squad.id,
          adSetName: squad.name ?? null,
          creativeId: '',
          creativeName: null,
          spend: fromMicro(stats.spend),
          currency: meta.currency,
          impressions: asInt(stats.impressions),
          // A "swipe" is Snap's click. Named as the metric it stands in for so the
          // leaderboard's CTR column means the same thing across networks.
          clicks: asInt(stats.swipes),
          networkConversions: asInt(stats.conversion_purchases),
          accountTimezone: meta.timezone
        });
      }
    }

    return {
      rows,
      // Partial failure is reported rather than swallowed: some ad squads
      // syncing looks identical to all of them syncing on a chart.
      error: errors.length ? `${errors.length} ad squad(s) failed: ${errors.join(' | ').slice(0, 240)}` : null,
      configured: true
    };
  } catch (err) {
    return { rows: [], error: String(err).slice(0, 300), configured: true };
  }
}

/** Timeseries points from a single-entity stats response. */
function pointsOf(body: unknown): Array<{ start_time?: string; stats?: Record<string, unknown> }> {
  const envelope = body as {
    timeseries_stats?: Array<{
      timeseries_stat?: {
        timeseries?: Array<{ start_time?: string; stats?: Record<string, unknown> }>;
      };
    }>;
  };
  return envelope?.timeseries_stats?.flatMap((e) => e?.timeseries_stat?.timeseries ?? []) ?? [];
}

/** The previous campaign-level path, kept only as the degraded fallback. */
async function fetchCampaignBreakdown(
  token: string,
  adAccountId: string,
  from: string,
  to: string,
  meta: { currency: string; timezone: string | null }
): Promise<FetchResult> {
  const params = new URLSearchParams({
    granularity: 'DAY',
    breakdown: 'campaign',
    fields: 'spend,impressions,swipes,conversion_purchases',
    start_time: from,
    end_time: to
  });

  const res = await withTimeout(`${API_BASE}/adaccounts/${adAccountId}/stats?${params}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { rows: [], error: `stats ${res.status}: ${text.slice(0, 300)}`, configured: true };
  }
  return { rows: parseTimeseries(await res.json(), meta.currency, meta.timezone), error: null, configured: true };
}

/**
 * Walk the timeseries envelope into flat rows.
 *
 * Written defensively at every level rather than trusting the shape: this runs
 * unattended on a cron, and an API that adds or renames a wrapper should produce
 * zero rows and a visible zero, not a thrown 500 in a log nobody reads.
 */
function parseTimeseries(body: unknown, currency: string, timezone: string | null): SpendRow[] {
  const rows: SpendRow[] = [];
  const envelope = body as {
    timeseries_stats?: Array<{
      timeseries_stat?: {
        start_time?: string;
        timeseries?: Array<{
          start_time?: string;
          stats?: Record<string, unknown>;
        }>;
        breakdown_stats?: {
          campaign?: Array<{
            id?: string;
            name?: string;
            timeseries?: Array<{ start_time?: string; stats?: Record<string, unknown> }>;
          }>;
        };
      };
    }>;
  };

  for (const entry of envelope?.timeseries_stats ?? []) {
    const campaigns = entry?.timeseries_stat?.breakdown_stats?.campaign ?? [];

    for (const campaign of campaigns) {
      for (const point of campaign?.timeseries ?? []) {
        const day = (point?.start_time ?? '').slice(0, 10);
        if (!day) continue;

        const stats = point?.stats ?? {};
        rows.push({
          network: 'snap',
          date: day,
          campaignId: campaign?.id ?? '',
          campaignName: campaign?.name ?? null,
          // Snap's campaign breakdown does not descend further. Ad set and
          // creative stay empty so the primary key still resolves, and the
          // leaderboard's drill-down simply has nothing under this row yet.
          adSetId: '',
          adSetName: null,
          creativeId: '',
          creativeName: null,
          spend: fromMicro(stats.spend),
          currency,
          impressions: asInt(stats.impressions),
          // A "swipe" is Snap's click. Named as the metric it stands in for so
          // the leaderboard's CTR column means the same thing across networks.
          clicks: asInt(stats.swipes),
          networkConversions: asInt(stats.conversion_purchases),
          accountTimezone: timezone
        });
      }
    }
  }

  return rows;
}

/** Plain date arithmetic on YYYY-MM-DD, without dragging in a timezone. */
export function addDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
