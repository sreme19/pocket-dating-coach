/**
 * Meta Marketing API (Insights) — daily spend per campaign.
 *
 * Differs from Snap in three ways worth knowing before reading the code.
 *
 * SPEND IS ALREADY A DECIMAL STRING in the account's currency — no micro-units.
 * It is passed through as a string rather than parsed, for the same reason Snap's
 * micro integer is divided as a string: the value goes into a numeric column and
 * a round trip through a double is the one step that could lose a paisa.
 *
 * ONE ROW PER DAY PER CAMPAIGN comes from `time_increment=1`. Without it the API
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
 */

import { env } from '$env/dynamic/private';
import type { FetchResult, SpendRow } from './snap';

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
    level: 'campaign',
    // One row per day. Without it the range collapses into a single total.
    time_increment: '1',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,account_currency,date_start',
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
      adSetId: '',
      adSetName: null,
      creativeId: '',
      creativeName: null,
      spend: asDecimal(row.spend),
      currency: String(row.account_currency ?? 'USD'),
      impressions: asInt(row.impressions),
      clicks: asInt(row.clicks),
      networkConversions: 0,
      // Meta reports in the ad account's timezone but does not return it on the
      // insights row. Left null rather than guessed — a wrong timezone recorded
      // as fact is worse than an absent one.
      accountTimezone: null
    }));

    return { rows: rows.filter((r) => r.date), error: null, configured: true };
  } catch (err) {
    return { rows: [], error: String(err).slice(0, 300), configured: true };
  }
}
