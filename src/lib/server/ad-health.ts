/**
 * Daily instrumentation check for the ad pipeline.
 *
 * This answers one question — is the pipe alive? — and deliberately says nothing
 * about strategy. Those are separate reports because they call for separate
 * reactions: a broken beacon needs fixing this morning, a weak campaign needs a
 * week of data and a decision.
 *
 * SILENT WHEN HEALTHY. Nothing is sent unless something is wrong, so a delivered
 * mail always means there is something to do. A daily "all good" message becomes
 * invisible within a week, and then the one that matters is invisible with it —
 * which is the same failure as a dashboard reading zero for a week while everyone
 * assumed it was working.
 *
 * EVERY CHECK DISTINGUISHES "BROKEN" FROM "NOT CONFIGURED YET". An unconfigured
 * network and a dead token both produce no data, and they need opposite
 * responses. The wording of each finding carries that difference, because a
 * report that flattens them trains the reader to ignore it.
 */

import { getSupabase } from '$lib/server/supabase';
import { adSpendConfigStatus } from '$lib/server/ad-spend/sync';
import { istDay, istToday, addDays } from '$lib/ist-dates';

export type Severity = 'broken' | 'warning' | 'pending';

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface HealthReport {
  day: string;
  findings: Finding[];
  /** Counted for the mail's opening line, so the reader gets scale before detail. */
  stats: {
    views24h: number;
    taps24h: number;
    spend24h: number;
    signups24h: number;
    attributedTotal: number;
  };
}

/** Views below this make a zero-tap day meaningless rather than alarming. */
const MIN_VIEWS_FOR_TAP_ALARM = 30;

/** A sync running hourly is late, not idle, after three hours. */
const SPEND_STALE_HOURS = 3;

export async function buildAdHealth(): Promise<HealthReport> {
  const supabase = getSupabase();
  const today = istToday();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [views, clicks, spend, acquisition, members, lpSessions] = await Promise.all([
    supabase.from('marketing_page_views').select('campaign,created_at').gte('created_at', since),
    supabase
      .from('marketing_store_clicks')
      .select('campaign,snap_forwarded,meta_forwarded,forward_error,created_at')
      .gte('created_at', since),
    supabase.from('ad_spend_daily').select('*').gte('date', addDays(today, -3)),
    supabase.from('user_acquisition').select('user_id', { count: 'exact', head: true }),
    supabase
      .from('verified_vibe_users')
      .select('id,created_at,is_seed,is_provisional')
      .gte('created_at', since),
    supabase.from('aibestie_lp_sessions').select('id', { count: 'exact', head: true })
  ]);

  const findings: Finding[] = [];
  const viewRows = views.data ?? [];
  const clickRows = clicks.data ?? [];
  const spendRows = spend.data ?? [];
  const newMembers = (members.data ?? []).filter((m: any) => !m.is_seed && !m.is_provisional);
  const attributedTotal = acquisition.count ?? 0;

  const spend24h = spendRows
    .filter((s: any) => s.date === today || s.date === addDays(today, -1))
    .reduce((sum: number, s: any) => sum + Number(s.spend ?? 0), 0);

  /* ─── the tables themselves ─────────────────────────────────────────── */

  for (const [name, res] of [
    ['marketing_page_views', views],
    ['marketing_store_clicks', clicks],
    ['ad_spend_daily', spend],
    ['user_acquisition', acquisition]
  ] as const) {
    if (res.error) {
      findings.push({
        severity: 'broken',
        title: `Cannot read ${name}`,
        detail: `${res.error.message}. A migration may not have been run — until it is, this table records nothing and the dashboard shows an honest-looking zero.`
      });
    }
  }

  /* ─── the beacons ───────────────────────────────────────────────────── */

  if (viewRows.length === 0 && spend24h > 0) {
    findings.push({
      severity: 'broken',
      title: 'Spend with zero landing page views',
      detail: `${spend24h.toFixed(0)} spent in the last 24h and not one page view recorded. Either the view beacon stopped or the ads are pointing somewhere that is not instrumented. Money is going out with nothing coming back to measure it.`
    });
  }

  if (viewRows.length >= MIN_VIEWS_FOR_TAP_ALARM && clickRows.length === 0) {
    findings.push({
      severity: 'broken',
      title: 'Views but zero store taps',
      detail: `${viewRows.length} views and no taps in 24h. Before assuming the creative is at fault, check that the CTAs still carry target="_blank" — removing it silently stops the tap being measurable, with no error anywhere.`
    });
  }

  /* ─── the conversion forwards ───────────────────────────────────────── */

  const snapFailed = clickRows.filter((c: any) => c.snap_forwarded === false);
  const metaFailed = clickRows.filter((c: any) => c.meta_forwarded === false);
  const metaNever = clickRows.length > 0 && clickRows.every((c: any) => c.meta_forwarded === null);

  if (snapFailed.length) {
    findings.push({
      severity: 'broken',
      title: `Snap conversion forward failing (${snapFailed.length}/${clickRows.length})`,
      detail: `SNAP_CAPI_TOKEN may have expired. First error: ${snapFailed[0].forward_error ?? 'unknown'}. Snap stops receiving deduplicated server events, so its optimisation degrades before any number on the dashboard moves.`
    });
  }

  if (metaFailed.length) {
    findings.push({
      severity: 'broken',
      title: `Meta conversion forward failing (${metaFailed.length}/${clickRows.length})`,
      detail: `META_CAPI_TOKEN may have expired — Meta answers code 190 on a dead token, which looks exactly like a campaign that stopped spending. First error: ${metaFailed[0].forward_error ?? 'unknown'}.`
    });
  } else if (metaNever) {
    findings.push({
      severity: 'pending',
      title: 'Meta server-side forwarding is off',
      detail: `META_CAPI_TOKEN is not set, so every tap reaches Meta from the browser only. Browser events are the ones that get lost to ad blockers and to the page teardown on tap — the exact failure that left Snap's store-click event reading zero for a week. Generate a System User token in Business Manager; user tokens expire at ~60 days.`
    });
  }

  /* ─── spend ─────────────────────────────────────────────────────────── */

  const config = adSpendConfigStatus();
  for (const network of ['snap', 'meta'] as const) {
    const creds = config[network];
    const configured = Object.values(creds).every(Boolean);
    const rows = spendRows.filter((s: any) => s.network === network);

    if (!configured) {
      const missing = Object.entries(creds)
        .filter(([, present]) => !present)
        .map(([name]) => name)
        .join(', ');
      findings.push({
        severity: 'pending',
        title: `${network} spend not configured`,
        detail: `Missing: ${missing}. Without spend there is no cost per signup, so "spend more here, pause that" cannot be answered at all — it is the one column that turns a conversion count into a decision.`
      });
      continue;
    }

    if (rows.length === 0) {
      findings.push({
        severity: 'broken',
        title: `${network} spend sync returning nothing`,
        detail: `Credentials are present but no rows landed for the last 3 days. The sync runs hourly; check the cron logs for an API error.`
      });
      continue;
    }

    const newest = rows.reduce(
      (max: string, s: any) => (s.fetched_at > max ? s.fetched_at : max),
      rows[0].fetched_at as string
    );
    const ageHours = (Date.now() - new Date(newest).getTime()) / 3600_000;
    if (ageHours > SPEND_STALE_HOURS) {
      findings.push({
        severity: 'broken',
        title: `${network} spend is ${ageHours.toFixed(0)}h stale`,
        detail: `Last successful fetch ${newest}. The sync runs hourly, so this is a stopped job rather than a quiet day. A stale sync reads as a campaign that spent nothing.`
      });
    }
  }

  // Spend against a campaign nobody arrived from: usually a tagging or link fault.
  const viewCampaigns = new Set(viewRows.map((v: any) => v.campaign).filter(Boolean));
  for (const s of spendRows) {
    const name = s.campaign_name ?? s.campaign_id;
    if (Number(s.spend ?? 0) > 0 && name && !viewCampaigns.has(name) && s.date === addDays(today, -1)) {
      findings.push({
        severity: 'warning',
        title: `Spend on "${name}" with no matching page views`,
        detail: `The campaign is spending but its utm_campaign does not match anything arriving on the landing pages. Usually a tagging mismatch between the ad URL and the campaign name, which makes this spend unattributable rather than ineffective.`
      });
    }
  }

  /* ─── attribution ───────────────────────────────────────────────────── */

  if (attributedTotal === 0 && newMembers.length > 0) {
    findings.push({
      severity: 'pending',
      title: `${newMembers.length} new member(s) and no attribution rows`,
      detail: `user_acquisition is still empty, so nobody can be traced to a campaign. This needs the new Flutter build: the Play install referrer is readable exactly once per install, so every install until that build ships is permanently unattributable. This is the only gap here that cannot be fixed retroactively.`
    });
  }

  /* ─── currency ──────────────────────────────────────────────────────── */

  const currencies = new Set(spendRows.map((s: any) => s.currency).filter(Boolean));
  if (currencies.size > 0 && !currencies.has('INR')) {
    const { count } = await supabase
      .from('ad_fx_rates')
      .select('date', { count: 'exact', head: true });
    if (!count) {
      findings.push({
        severity: 'warning',
        title: `Spend is in ${[...currencies].join(', ')} but ad_fx_rates is empty`,
        detail: `Reporting defaults to INR, and without a rate that spend is excluded from every total rather than silently converted at 1:1. Add a row to ad_fx_rates.`
      });
    }
  }

  return {
    day: today,
    findings,
    stats: {
      views24h: viewRows.length,
      taps24h: clickRows.length,
      spend24h,
      signups24h: newMembers.length,
      attributedTotal
    }
  };
}

/** Ordered worst-first, because the reader may only read the first line. */
export function sortFindings(findings: Finding[]): Finding[] {
  const rank: Record<Severity, number> = { broken: 0, warning: 1, pending: 2 };
  return [...findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export { istDay };
