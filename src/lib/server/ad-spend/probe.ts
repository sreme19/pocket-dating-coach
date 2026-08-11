/**
 * Ask each network, live, which demographic breakdowns it will actually answer.
 *
 * The Snap adapter's `dimension` parameter is written from documentation rather
 * than from a confirmed response, because the production credentials are only
 * reachable from production — `vercel env pull` blanks every secret. This module
 * closes that gap from inside the deployment: it tries each candidate spelling
 * and reports the status code and the first line of the body.
 *
 * DIAGNOSTIC, NOT A DATA PATH. Nothing here parses a response into a row or
 * writes anything anywhere. It answers one question — does this parameter work? —
 * and the answer is meant to be read by a person once and then acted on by
 * trimming the adapter's candidate lists.
 *
 * Bodies are truncated hard. A Meta error body echoes the request back, and the
 * access token is in the query string.
 */

import { env } from '$env/dynamic/private';

const SNAP_TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';
const SNAP_API = 'https://adsapi.snapchat.com/v1';
const META_API = 'https://graph.facebook.com/v21.0';
const TIMEOUT_MS = 20_000;

/** Enough to see the shape or the error, never enough to leak a whole payload. */
const BODY_PREVIEW = 260;

export interface ProbeAttempt {
  network: 'snap' | 'meta';
  candidate: string;
  status: number | null;
  ok: boolean;
  /** Bucket labels found, when the response could be read at all. */
  buckets: string[];
  note: string;
}

export interface ProbeResult {
  start: string;
  end: string;
  configured: { snap: boolean; meta: boolean };
  attempts: ProbeAttempt[];
}

async function withTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Never returns the token or the URL that carried it. */
function preview(text: string): string {
  return text.replace(/access_token=[^&"\s]+/g, 'access_token=REDACTED').slice(0, BODY_PREVIEW);
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function probeSnap(start: string, end: string): Promise<ProbeAttempt[]> {
  const clientId = env.SNAP_MARKETING_CLIENT_ID ?? env.SNAP_CLIENT_ID ?? '';
  const clientSecret = env.SNAP_MARKETING_CLIENT_SECRET ?? env.SNAP_CLIENT_SECRET ?? '';
  const refreshToken = env.SNAP_MARKETING_REFRESH_TOKEN ?? env.SNAP_REFRESH_TOKEN ?? '';
  const adAccountId = env.SNAP_AD_ACCOUNT_ID ?? env.SNAP_MARKETING_AD_ACCOUNT_ID ?? '';
  if (!clientId || !clientSecret || !refreshToken || !adAccountId) return [];

  const attempts: ProbeAttempt[] = [];

  let token: string;
  try {
    const res = await withTimeout(SNAP_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) {
      return [
        { network: 'snap', candidate: '(token)', status: res.status, ok: false, buckets: [], note: 'no access_token in response' }
      ];
    }
    token = body.access_token;
  } catch (err) {
    return [{ network: 'snap', candidate: '(token)', status: null, ok: false, buckets: [], note: String(err).slice(0, 120) }];
  }

  // One real campaign to probe against. A dimension parameter is rejected the
  // same way for every campaign, so one is as informative as forty.
  let campaignId = '';
  try {
    const res = await withTimeout(`${SNAP_API}/adaccounts/${adAccountId}/campaigns?limit=1`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = (await res.json()) as { campaigns?: Array<{ campaign?: { id?: string } }> };
    campaignId = body.campaigns?.[0]?.campaign?.id ?? '';
  } catch {
    // Fall through: the account-level attempt below is still worth making.
  }

  const CANDIDATES = ['GENDER', 'AGE_BUCKET', 'AGE', 'COUNTRY', 'REGION', 'DMA', 'OPERATING_SYSTEM'];
  const base = campaignId ? `${SNAP_API}/campaigns/${campaignId}/stats` : `${SNAP_API}/adaccounts/${adAccountId}/stats`;

  for (const candidate of CANDIDATES) {
    const params = new URLSearchParams({
      granularity: 'DAY',
      dimension: candidate,
      fields: 'spend,impressions,swipes',
      start_time: `${start}T00:00:00.000+08:00`,
      end_time: `${end}T00:00:00.000+08:00`
    });

    try {
      const res = await withTimeout(`${base}?${params}`, { headers: { authorization: `Bearer ${token}` } });
      const text = await res.text();

      // Read bucket labels without committing to a parse — the probe's whole job
      // is to discover the shape, so it looks for the field by name anywhere in
      // the body rather than walking a structure it has assumed.
      const buckets = [...new Set([...text.matchAll(/"dimension_value"\s*:\s*"([^"]{1,60})"/g)].map((m) => m[1]))].slice(0, 12);

      attempts.push({
        network: 'snap',
        candidate: `dimension=${candidate}`,
        status: res.status,
        ok: res.ok && buckets.length > 0,
        buckets,
        note: res.ok
          ? buckets.length
            ? 'buckets returned'
            : `200 but no dimension_value found: ${preview(text)}`
          : preview(text)
      });
    } catch (err) {
      attempts.push({
        network: 'snap',
        candidate: `dimension=${candidate}`,
        status: null,
        ok: false,
        buckets: [],
        note: String(err).slice(0, 120)
      });
    }
  }

  return attempts;
}

async function probeMeta(start: string, end: string): Promise<ProbeAttempt[]> {
  const token = env.META_MARKETING_TOKEN ?? env.META_ADS_TOKEN ?? '';
  const raw = env.META_AD_ACCOUNT_ID ?? env.META_MARKETING_AD_ACCOUNT_ID ?? '';
  if (!token || !raw) return [];
  const adAccountId = raw.startsWith('act_') ? raw : `act_${raw}`;

  const CANDIDATES = ['age', 'gender', 'age,gender', 'region', 'country', 'impression_device', 'publisher_platform'];
  const attempts: ProbeAttempt[] = [];

  for (const candidate of CANDIDATES) {
    const params = new URLSearchParams({
      level: 'campaign',
      time_increment: '1',
      breakdowns: candidate,
      fields: 'campaign_name,spend,impressions',
      time_range: JSON.stringify({ since: start, until: end }),
      limit: '10',
      access_token: token
    });

    try {
      const res = await withTimeout(`${META_API}/${adAccountId}/insights?${params}`);
      const text = await res.text();
      const key = candidate.split(',')[0];
      const buckets = [
        ...new Set([...text.matchAll(new RegExp(`"${key}"\\s*:\\s*"([^"]{1,60})"`, 'g'))].map((m) => m[1]))
      ].slice(0, 12);

      attempts.push({
        network: 'meta',
        candidate: `breakdowns=${candidate}`,
        status: res.status,
        ok: res.ok && buckets.length > 0,
        buckets,
        note: res.ok ? (buckets.length ? 'buckets returned' : `200 but no rows: ${preview(text)}`) : preview(text)
      });
    } catch (err) {
      attempts.push({
        network: 'meta',
        candidate: `breakdowns=${candidate}`,
        status: null,
        ok: false,
        buckets: [],
        note: String(err).slice(0, 120)
      });
    }
  }

  return attempts;
}

export async function probeDemographicSupport(startArg?: string, endArg?: string): Promise<ProbeResult> {
  const end = endArg ?? yesterday();
  const start = startArg ?? end;

  const snapConfigured = Boolean(
    (env.SNAP_MARKETING_CLIENT_ID ?? env.SNAP_CLIENT_ID) && (env.SNAP_AD_ACCOUNT_ID ?? env.SNAP_MARKETING_AD_ACCOUNT_ID)
  );
  const metaConfigured = Boolean(
    (env.META_MARKETING_TOKEN ?? env.META_ADS_TOKEN) && (env.META_AD_ACCOUNT_ID ?? env.META_MARKETING_AD_ACCOUNT_ID)
  );

  const [snap, meta] = await Promise.all([probeSnap(start, end), probeMeta(start, end)]);

  return {
    start,
    end,
    configured: { snap: snapConfigured, meta: metaConfigured },
    attempts: [...snap, ...meta]
  };
}
