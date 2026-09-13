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

/**
 * Network error text is raw API output and arrives in whatever shape the network
 * felt like: Snap answers a rate limit with an entire HTML error page, newlines
 * and all. It is escaped before it reaches the mail, so it cannot break the
 * layout — it just renders as a wall of unreadable markup. Collapse it to one
 * readable line first, keeping the part that names the cause.
 */
function condenseError(raw: string): string {
  return raw
    // Complete tags, and tags TRUNCATED MID-ATTRIBUTE — snap.ts slices the
    // network's reply to a fixed length, so the last tag usually has no closing
    // bracket at all and a `<[^>]*>` pattern walks straight past it. Stopping at
    // `|` too keeps the ad squad names, which are the only part worth reading.
    .replace(/<[^>|]*>?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** The most recent recorded run of a network's spend sync. */
export interface SyncRunRecord {
  network: string;
  ran_at: string;
  rows_returned?: number;
  error?: string | null;
}

export interface SpendSyncInput {
  network: 'snap' | 'meta';
  /** Credential name -> present. Values never appear. */
  credentials: Record<string, boolean>;
  run: SyncRunRecord | null;
  /** False when ad_sync_runs could not be read at all. */
  runsReadable: boolean;
  /** Most recent day this network delivered anything, ever. */
  lastDeliveryDate: string | null;
  now: Date;
}

/**
 * Is this network's spend pipeline broken, and how would we know?
 *
 * THE DISTINCTION THIS FUNCTION EXISTS FOR. A sync that runs perfectly and finds
 * nothing writes nothing. So "campaigns are paused" and "the access token died"
 * leave the database in an identical state — no recent spend rows — and the
 * previous version of this check read that emptiness as a broken pipeline. On
 * 2026-09-13 it mailed "meta spend sync returning nothing — check the cron logs
 * for an API error" forty minutes after a successful sync, about campaigns the
 * owner had deliberately paused. There was no error to find.
 *
 * Only the RUN RECORD separates them, which is why ad_sync_runs exists. Returns
 * null — say nothing — when the sync demonstrably ran and simply had nothing to
 * report, because a paused campaign is a decision somebody already made and this
 * file's contract is that a delivered mail always means there is something to do.
 */
export function spendSyncFinding(input: SpendSyncInput): Finding | null {
  const { network, credentials, run, runsReadable, lastDeliveryDate, now } = input;

  const missing = Object.entries(credentials)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  if (missing.length) {
    return {
      severity: 'pending',
      title: `${network} spend not configured`,
      detail: `Missing: ${missing.join(', ')}. Without spend there is no cost per signup, so "spend more here, pause that" cannot be answered at all — it is the one column that turns a conversion count into a decision.`
    };
  }

  if (!runsReadable || !run) {
    return {
      severity: 'pending',
      title: `${network} sync runs are not being recorded`,
      detail: `Nothing in ad_sync_runs for ${network}, so a healthy sync with paused campaigns cannot be told apart from a dead access token — both leave no recent rows. Run 20260913080000_create_ad_sync_runs_table.sql; the next hourly sync fills it in.`
    };
  }

  const seen = lastDeliveryDate ?? 'never';
  const returned = run.rows_returned ?? 0;

  /*
   * PARTIAL AND TOTAL FAILURE ARE DIFFERENT PROBLEMS. Snap answers a rate limit
   * with 429 on individual ad squads while the rest of the fetch succeeds, so a
   * run can carry an error AND 91 good rows. Calling that "spend reads as zero
   * everywhere" is false and urgent-sounding; the truth is quieter and worse to
   * miss — the numbers that landed are real but short, so every chart built on
   * them looks entirely plausible while understating the spend.
   */
  if (run.error && returned > 0) {
    return {
      severity: 'warning',
      title: `${network} spend sync is partly failing`,
      detail: `The sync ran at ${run.ran_at} and returned ${returned} rows, but part of the request was refused: ${condenseError(run.error)}. The spend that did land is understated rather than absent, so the dashboard looks plausible and is quietly short — which is harder to notice than a chart reading zero.`
    };
  }

  if (run.error) {
    return {
      severity: 'broken',
      title: `${network} spend sync is failing`,
      detail: `The sync ran at ${run.ran_at} and returned nothing: ${condenseError(run.error)}. Last day with any recorded delivery: ${seen}. Until this clears, spend reads as zero everywhere — which looks exactly like a campaign nobody is funding.`
    };
  }

  const ranHoursAgo = (now.getTime() - new Date(run.ran_at).getTime()) / 3600_000;
  if (!Number.isFinite(ranHoursAgo) || ranHoursAgo > SPEND_STALE_HOURS) {
    return {
      severity: 'broken',
      title: `${network} spend sync has stopped running`,
      detail: `Last run ${Number.isFinite(ranHoursAgo) ? `${ranHoursAgo.toFixed(0)}h ago at ${run.ran_at}` : `unreadable (${run.ran_at})`}, and it runs hourly. Last day with any recorded delivery: ${seen}. This is a stopped job rather than a quiet day — the job not running and the campaigns not spending produce the same empty dashboard, and only this timestamp separates them.`
    };
  }

  // Ran fine, nothing to report. Silence is the correct answer.
  return null;
}

export async function buildAdHealth(): Promise<HealthReport> {
  const supabase = getSupabase();
  const today = istToday();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [views, clicks, spend, lastDelivery, syncRuns, acquisition, members, lpSessions] = await Promise.all([
    supabase.from('marketing_page_views').select('campaign,created_at').gte('created_at', since),
    supabase
      .from('marketing_store_clicks')
      .select('campaign,snap_forwarded,meta_forwarded,forward_error,created_at')
      .gte('created_at', since),
    supabase.from('ad_spend_daily').select('*').gte('date', addDays(today, -3)),
    // Deliberately unfiltered by date: the whole question below is what the
    // most recent delivery was, however long ago. The 3-day filter above is
    // what used to hide it.
    supabase.from('ad_spend_daily').select('network,date').order('date', { ascending: false }).limit(400),
    supabase.from('ad_sync_runs').select('*'),
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

  /**
   * The most recent day each network actually delivered anything, however long
   * ago. A network with no row here has never recorded spend at all.
   */
  const lastDeliveryDate: Record<string, string | null> = { snap: null, meta: null };
  for (const row of (lastDelivery.data ?? []) as Array<{ network: string; date: string }>) {
    const current = lastDeliveryDate[row.network];
    if (!current || row.date > current) lastDeliveryDate[row.network] = row.date;
  }

  const runByNetwork = new Map<string, any>(
    ((syncRuns.data ?? []) as any[]).map((r) => [r.network, r])
  );

  for (const network of ['snap', 'meta'] as const) {
    const finding = spendSyncFinding({
      network,
      credentials: config[network],
      run: runByNetwork.get(network) ?? null,
      runsReadable: !syncRuns.error,
      lastDeliveryDate: lastDeliveryDate[network],
      now: new Date()
    });
    if (finding) findings.push(finding);
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
