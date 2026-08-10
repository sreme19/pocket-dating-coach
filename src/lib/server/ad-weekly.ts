/**
 * Weekly ad strategy report.
 *
 * Built on top of buildAdAnalytics rather than re-querying, so the report and the
 * dashboard can never disagree. Two runs — the last 7 IST days and the 7 before
 * them — give every headline a week-on-week delta.
 *
 * FLAGS ARE CANDIDATES, NEVER INSTRUCTIONS. Each one names the rule it fired on
 * and the sample it fired against, because a recommendation you cannot audit is
 * one you either follow blindly or ignore entirely, and both are worse than a
 * number with its workings attached.
 *
 * NOTHING FIRES ON A COST THAT DOES NOT EXIST. Cost-per-signup flags are
 * suppressed wholesale while attribution is empty or spend is unconfigured. A
 * "pause this campaign" derived from a divide-by-nothing is fabrication, and it
 * would be the single most expensive kind of wrong this report could be.
 *
 * IT SAYS WHAT EACH CAMPAIGN IS BIDDING ON. A cost-per-signup column beside a
 * campaign optimising for landing page views invites the conclusion that the
 * campaign is failing, when nobody ever asked it for signups. Until the ad APIs
 * supply the real objective, it is inferred from the campaign name and labelled
 * as inferred — never presented as fact.
 */

import { buildAdAnalytics, MIN_SAMPLE } from '$lib/server/ad-analytics';
import { adSpendConfigStatus } from '$lib/server/ad-spend/sync';
import { addDays, daysBetween, istToday, formatIstRange } from '$lib/ist-dates';

/** One week, the shortest window in which a campaign comparison clears MIN_SAMPLE. */
export const WEEK_DAYS = 7;

/* ── flag thresholds (spec §5.4) ─────────────────────────────────────────── */

/** Three signups is the floor at which a cost figure is not one lucky person. */
const SCALE_MIN_SIGNUPS = 3;
const SCALE_COST_RATIO = 0.6;
/** At 100 views a genuinely converting campaign has almost certainly produced one. */
const PAUSE_MIN_VIEWS = 100;
const INVESTIGATE_COST_RATIO = 2;
const BROKEN_FUNNEL_MIN_VIEWS = 50;
const BROKEN_FUNNEL_RATIO = 0.25;

export type FlagKind = 'scale' | 'pause' | 'investigate' | 'broken_funnel' | 'insufficient';

export interface Flag {
  kind: FlagKind;
  campaign: string;
  /** The rule, stated so the reader can disagree with it. */
  rule: string;
  evidence: string;
}

export interface Metric {
  label: string;
  now: number;
  prior: number;
  /** Null when the prior week was zero — "up from nothing" has no percentage. */
  deltaPct: number | null;
  /** Money is formatted by the caller, which knows the display currency. */
  money?: boolean;
}

export interface WeeklyReport {
  range: { start: string; end: string; label: string };
  priorRange: { start: string; end: string };
  currency: 'INR' | 'USD';
  headline: Metric[];
  campaigns: Array<{
    campaign: string;
    objective: string;
    objectiveInferred: boolean;
    spend: number;
    views: number;
    taps: number;
    tapRate: number | null;
    signups: number;
    costPerSignup: number | null;
    priorViews: number;
  }>;
  flags: Flag[];
  segments: {
    byCountry: Record<string, { views: number; taps: number }>;
    byPage: Record<string, { views: number; taps: number }>;
    byCta: Record<string, number>;
  };
  /** What could not be measured this week, said plainly. */
  caveats: string[];
  lpFunnel: Record<string, unknown>;
}

/**
 * What a campaign is bidding on, inferred from its name.
 *
 * Snap and Meta both expose the real objective on the campaign object, but that
 * arrives with the spend sync and needs credentials. Until then the suffix
 * convention already in use is the only signal available — `..._lpv` means the
 * campaign is optimising for landing page views, `..._auto` for automatic
 * bidding. Returned with an `inferred` flag so the report can label it rather
 * than assert it.
 */
export function inferObjective(campaign: string): { objective: string; inferred: boolean } {
  const name = campaign.toLowerCase();
  if (name.endsWith('_lpv')) return { objective: 'Landing page views', inferred: true };
  if (name.endsWith('_auto')) return { objective: 'Automatic bidding', inferred: true };
  if (name.includes('install')) return { objective: 'App installs', inferred: true };
  if (name.includes('swipe') || name.includes('click')) return { objective: 'Clicks', inferred: true };
  return { objective: 'Unknown', inferred: true };
}

function delta(now: number, prior: number): number | null {
  // Null rather than Infinity or 100%: a rise from zero has no meaningful
  // percentage, and rendering one invites a comparison that isn't there.
  if (prior === 0) return null;
  return (now - prior) / prior;
}

function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export async function buildWeeklyReport(
  currency: 'INR' | 'USD' = 'INR',
  today: string = istToday()
): Promise<WeeklyReport> {
  const end = addDays(today, -1); // Yesterday: today is still accruing.
  const start = addDays(end, -(WEEK_DAYS - 1));
  const priorEnd = addDays(start, -1);
  const priorStart = addDays(priorEnd, -(WEEK_DAYS - 1));

  const [now, prior] = await Promise.all([
    buildAdAnalytics({ start, end, currency, granularity: 'day' }),
    buildAdAnalytics({ start: priorStart, end: priorEnd, currency, granularity: 'day' })
  ]);

  const sum = (rows: Array<Record<string, any>>, key: string) =>
    rows.reduce((t, r) => t + Number(r[key] ?? 0), 0);

  const nowSpend = sum(now.leaderboard, 'spend');
  const nowViews = sum(now.leaderboard, 'views');
  const nowTaps = sum(now.leaderboard, 'taps');
  const nowSignups = sum(now.leaderboard, 'signups');

  const priorSpend = sum(prior.leaderboard, 'spend');
  const priorViews = sum(prior.leaderboard, 'views');
  const priorTaps = sum(prior.leaderboard, 'taps');
  const priorSignups = sum(prior.leaderboard, 'signups');

  const headline: Metric[] = [
    { label: 'Spend', now: nowSpend, prior: priorSpend, deltaPct: delta(nowSpend, priorSpend), money: true },
    { label: 'Landing page views', now: nowViews, prior: priorViews, deltaPct: delta(nowViews, priorViews) },
    { label: 'Store taps', now: nowTaps, prior: priorTaps, deltaPct: delta(nowTaps, priorTaps) },
    { label: 'Signups (attributed)', now: nowSignups, prior: priorSignups, deltaPct: delta(nowSignups, priorSignups) },
    {
      label: 'Cost per signup',
      now: nowSignups > 0 ? nowSpend / nowSignups : 0,
      prior: priorSignups > 0 ? priorSpend / priorSignups : 0,
      deltaPct:
        nowSignups > 0 && priorSignups > 0
          ? delta(nowSpend / nowSignups, priorSpend / priorSignups)
          : null,
      money: true
    }
  ];

  const priorViewsByCampaign = new Map(prior.leaderboard.map((c: any) => [c.campaign, c.views]));

  const campaigns = now.leaderboard.map((c: any) => {
    const { objective, inferred } = inferObjective(c.campaign);
    return {
      campaign: c.campaign,
      objective,
      objectiveInferred: inferred,
      spend: c.spend,
      views: c.views,
      taps: c.taps,
      tapRate: c.tapRate,
      signups: c.signups,
      costPerSignup: c.costPerSignup,
      priorViews: Number(priorViewsByCampaign.get(c.campaign) ?? 0)
    };
  });

  /* ── flags ───────────────────────────────────────────────────────────── */

  const spendConfig = adSpendConfigStatus();
  const spendConfigured =
    Object.values(spendConfig.snap).every(Boolean) || Object.values(spendConfig.meta).every(Boolean);
  const attributionLive = now.health.counts.attributedSignups > 0;

  // The gate that stops this report inventing decisions. Cost flags need both a
  // cost and an attributed conversion; without either, cost per signup is not a
  // quantity that exists, and a flag derived from it is fabricated.
  const costFlagsPossible = spendConfigured && attributionLive && nowSpend > 0;

  const flags: Flag[] = [];
  const costs = campaigns.map((c) => c.costPerSignup).filter((v): v is number => typeof v === 'number');
  const medianCost = median(costs);
  const tapRates = campaigns.filter((c) => c.tapRate !== null).map((c) => c.tapRate as number);
  const medianTapRate = median(tapRates);

  for (const c of campaigns) {
    if (c.views < MIN_SAMPLE) {
      flags.push({
        kind: 'insufficient',
        campaign: c.campaign,
        rule: `Fewer than ${MIN_SAMPLE} views`,
        evidence: `${c.views} view${c.views === 1 ? '' : 's'}, ${c.taps} tap${c.taps === 1 ? '' : 's'}. Reported as counts; no rate is shown because none would mean anything.`
      });
      continue;
    }

    if (
      medianTapRate !== null &&
      c.views >= BROKEN_FUNNEL_MIN_VIEWS &&
      c.tapRate !== null &&
      c.tapRate <= medianTapRate * BROKEN_FUNNEL_RATIO
    ) {
      flags.push({
        kind: 'broken_funnel',
        campaign: c.campaign,
        rule: `≥${BROKEN_FUNNEL_MIN_VIEWS} views and tap rate ≤${BROKEN_FUNNEL_RATIO * 100}% of the median`,
        evidence: `Tap rate ${(c.tapRate * 100).toFixed(1)}% against a median of ${(medianTapRate * 100).toFixed(1)}% on ${c.views} views. People are arriving and not tapping — usually a creative promise the page does not keep, rather than a bad audience.`
      });
    }

    if (!costFlagsPossible) continue;

    if (c.views >= PAUSE_MIN_VIEWS && c.signups === 0) {
      flags.push({
        kind: 'pause',
        campaign: c.campaign,
        rule: `≥${PAUSE_MIN_VIEWS} views and zero attributed signups`,
        evidence: `${c.views} views, ${c.taps} taps, no signups. At this volume a converting campaign has almost certainly produced one.`
      });
    }

    if (medianCost !== null && c.costPerSignup !== null) {
      if (c.costPerSignup <= medianCost * SCALE_COST_RATIO && c.signups >= SCALE_MIN_SIGNUPS) {
        flags.push({
          kind: 'scale',
          campaign: c.campaign,
          rule: `Cost/signup ≤${SCALE_COST_RATIO}× median on ≥${SCALE_MIN_SIGNUPS} signups`,
          evidence: `${c.costPerSignup.toFixed(0)} per signup against a median of ${medianCost.toFixed(0)}, on ${c.signups} signups from ${c.views} views.`
        });
      } else if (c.costPerSignup >= medianCost * INVESTIGATE_COST_RATIO) {
        flags.push({
          kind: 'investigate',
          campaign: c.campaign,
          rule: `Cost/signup ≥${INVESTIGATE_COST_RATIO}× median`,
          evidence: `${c.costPerSignup.toFixed(0)} per signup against a median of ${medianCost.toFixed(0)} on ${c.signups} signups. Outside ordinary variance at this volume, but check the objective below before concluding the campaign is at fault.`
        });
      }
    }
  }

  /* ── caveats ─────────────────────────────────────────────────────────── */

  const caveats: string[] = [];

  if (!spendConfigured) {
    caveats.push(
      'No ad spend was available: neither Snap nor Meta is configured, so every cost figure in this report is zero because nothing was fetched — not because nothing was spent. No cost-based flag was evaluated.'
    );
  }
  if (!attributionLive) {
    caveats.push(
      'No signup could be attributed to a campaign, so the signup and cost-per-signup columns are structurally empty rather than genuinely zero. Attribution begins with installs from build 1.0.8+1104 onward; earlier installs report only if they update.'
    );
  }
  if (now.health.counts.views === 0) {
    caveats.push('No landing page views were recorded at all this week — check the beacon before reading anything else here.');
  }
  if (now.health.tapsWithoutVisit > 0) {
    caveats.push(
      `${now.health.tapsWithoutVisit} tap${now.health.tapsWithoutVisit === 1 ? '' : 's'} carried no visit id and sit outside the per-visit tap rate — blocked sessionStorage, usually in an in-app browser.`
    );
  }
  if (now.health.iosMembers > 0) {
    caveats.push(
      `${now.health.iosMembers} iOS member${now.health.iosMembers === 1 ? '' : 's'} cannot be attributed at all: iOS has no install referrer. Unattributable, not organic.`
    );
  }
  if (campaigns.every((c) => c.objectiveInferred) && campaigns.length > 0) {
    caveats.push(
      'Every campaign objective below is inferred from its name, not read from the ad network. The real objective arrives with the spend sync once credentials are set.'
    );
  }
  if (now.health.fxMissing) {
    caveats.push(`Spend in a currency with no ${currency} rate was excluded from totals rather than converted at 1:1.`);
  }

  return {
    range: { start, end, label: formatIstRange(start, end) },
    priorRange: { start: priorStart, end: priorEnd },
    currency,
    headline,
    campaigns,
    flags,
    segments: { byCountry: now.byCountry, byPage: now.byPage, byCta: now.byCta },
    caveats,
    lpFunnel: now.lpFunnel as Record<string, unknown>
  };
}

/** Worst-first, and "insufficient" last — it is context, not a finding. */
export function sortFlags(flags: Flag[]): Flag[] {
  const rank: Record<FlagKind, number> = {
    pause: 0,
    broken_funnel: 1,
    investigate: 2,
    scale: 3,
    insufficient: 4
  };
  return [...flags].sort((a, b) => rank[a.kind] - rank[b.kind]);
}

export { daysBetween };
