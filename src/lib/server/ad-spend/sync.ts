/**
 * Pull spend from every configured network and land it in ad_spend_daily.
 *
 * THE TRAILING WINDOW IS THE WHOLE DESIGN. Snap finalises metrics 48 hours after
 * a day ends and Meta restates for longer, so a day fetched once is a day
 * recorded wrong. Every run re-fetches the last SYNC_WINDOW_DAYS and upserts on
 * the full grain, which means the newest answer replaces the older one and the
 * totals converge instead of drifting. This is also why the table's primary key
 * is the whole grain rather than a surrogate id: an insert-only design would
 * accumulate one duplicate day per run and double every number on the dashboard.
 *
 * Networks are independent. One with a dead token must not stop the other from
 * syncing, so failures are collected and reported rather than thrown — and they
 * ARE reported, because a sync that silently stopped looks exactly like a
 * campaign that stopped spending, and those two need opposite responses.
 */

import { getSupabase } from '$lib/server/supabase';
import {
  fetchSnapSpend,
  fetchSnapCreativeSpend,
  fetchSnapDemographics,
  addDays,
  snapConfigStatus,
  type DemographicRow,
  type SpendRow
} from './snap';
import { fetchMetaSpend, fetchMetaDemographics, metaConfigStatus } from './meta';

/**
 * How far back each run re-fetches.
 *
 * Seven days is comfortably past Snap's 48-hour finalisation and covers Meta's
 * slower restatements, at a cost of a handful of API calls. Cheaper than being
 * wrong, and far cheaper than discovering the drift a month later.
 */
export const SYNC_WINDOW_DAYS = 7;

export interface NetworkOutcome {
  network: 'snap' | 'meta';
  configured: boolean;
  rows: number;
  error: string | null;
}

export interface SyncOutcome {
  start: string;
  end: string;
  networks: NetworkOutcome[];
  written: number;
  /**
   * Demographics reported SEPARATELY from spend, never folded into it.
   *
   * These two can succeed and fail independently — Snap's demographic parameter
   * is not the one that returns spend — and a combined count would let a
   * demographics fetch that returns nothing hide behind a spend fetch that
   * worked. The health panel needs to be able to say which half is broken.
   */
  demographics: { networks: NetworkOutcome[]; written: number };
  /**
   * Per-ad (creative) spend, reported separately for the same reason
   * demographics is: this fetch can succeed or fail independently of the
   * ad-squad fetch above, and folding it in would let a creative-level fetch
   * that returns nothing hide behind an ad-set fetch that worked fine.
   *
   * SNAP ONLY. Meta's ad-level data is already inside the `meta` entry under
   * `networks` above — `fetchMetaSpend` fetches at `level:'ad'` directly, so
   * there is no separate Meta creative fetch to report here.
   */
  creativeSpend: { networks: NetworkOutcome[]; written: number };
}

/** Today in UTC, as YYYY-MM-DD. The networks resolve their own day boundaries. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function writeRows(rows: SpendRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = getSupabase();
  const payload = rows.map((r) => ({
    network: r.network,
    date: r.date,
    campaign_id: r.campaignId,
    campaign_name: r.campaignName,
    ad_set_id: r.adSetId,
    creative_id: r.creativeId,
    ad_set_name: r.adSetName,
    creative_name: r.creativeName,
    spend: r.spend,
    currency: r.currency,
    impressions: r.impressions,
    clicks: r.clicks,
    network_conversions: r.networkConversions,
    account_timezone: r.accountTimezone,
    status: r.status,
    fetched_at: new Date().toISOString(),
    source: 'api'
  }));

  const upsert = (rows: Array<Omit<(typeof payload)[number], 'status'> & { status?: string | null }>) =>
    supabase
      // ignoreDuplicates is deliberately FALSE here — the opposite of every other
      // upsert in this codebase. A re-fetched day is expected to differ from the
      // stored one; that restatement is the entire reason for re-fetching, and
      // ignoring it would freeze each day at whatever it read within hours of
      // happening, which is exactly when it is least final.
      .from('ad_spend_daily')
      .upsert(rows, { onConflict: 'network,date,campaign_id,ad_set_id,creative_id', ignoreDuplicates: false });

  let { error } = await upsert(payload);

  /**
   * FALL BACK WITHOUT `status` ON A SCHEMA-CACHE ERROR, exactly the same
   * migration-lag gap the read side handles in `selectWithFallback` above.
   * Migrations here are run by hand, separately from the deploy, so there is
   * always a window where this code knows about a column
   * (20260815140510_add_status_column_to_ad_spend_daily.sql) some database does
   * not — every environment gets this migration at a different moment (this
   * one was applied straight to hosted Supabase and synced back, not run
   * through a local dev DB first) — and PostgREST rejects the WHOLE upsert on
   * an unrecognised column, not just the one field. Unlike a read, silently
   * losing this would mean the hourly cron writes zero rows and every number
   * on the dashboard reads as "nothing spent" instead of "status not synced
   * yet" — so this is deliberately narrowed to PostgREST's schema-cache code
   * rather than swallowing every error, and still logs loudly either way.
   */
  if (error?.code === 'PGRST204') {
    console.warn(
      '[ad-spend] retrying without `status` — run 20260815140510_add_status_column_to_ad_spend_daily.sql:',
      error.message
    );
    const retry = await upsert(payload.map(({ status: _status, ...rest }) => rest));
    error = retry.error;
  }

  if (error) {
    console.error('[ad-spend] rows NOT written:', error.message, error.hint ?? '');
    return 0;
  }

  await dropStaleCoarserRows(rows);
  await dropStaleAdSquadLevelRows(rows);
  return payload.length;
}

/**
 * Remove rows for the same days at a COARSER grain than we just wrote.
 *
 * THE SYNC OWNS ITS WINDOW, at exactly one grain per network. Without this, a
 * change of grain doubles the money. The primary key includes ad_set_id, so when
 * this adapter moved from campaign-level to ad-set-level totals the new rows did
 * not replace the old ones — they landed beside them, and every rupee was
 * counted twice. Measured on 2026-08-10: 49 ad-set rows at ₹387.79 sitting next
 * to 35 campaign rows at ₹387.79, summing to ₹775.57 of spend that never
 * happened. Nothing errored, and the number looked entirely plausible.
 *
 * Self-healing rather than a one-off cleanup script, because this recurs every
 * time a grain changes — Meta will do the same the first time it moves from
 * campaign to ad set.
 *
 * Guarded so it can only ever delete a coarser grain than the one just written.
 * When the ad-squad listing fails and the adapter falls back to campaign level,
 * `rows` carry an empty ad_set_id, nothing here qualifies as coarser, and the
 * existing ad-set rows are left alone. A degraded fetch must not be able to
 * delete good data.
 */
async function dropStaleCoarserRows(rows: SpendRow[]): Promise<void> {
  const finer = rows.filter((r) => r.adSetId);
  if (finer.length === 0) return;

  const supabase = getSupabase();
  const networks = [...new Set(finer.map((r) => r.network))];
  const dates = [...new Set(finer.map((r) => r.date))];

  for (const network of networks) {
    const { error, count } = await supabase
      .from('ad_spend_daily')
      .delete({ count: 'exact' })
      .eq('network', network)
      .eq('ad_set_id', '')
      .in('date', dates);

    if (error) {
      // Loud, because the consequence of a silent failure here is a spend total
      // that is quietly twice what was actually spent.
      console.error('[ad-spend] could not clear coarser rows:', error.message);
    } else if (count) {
      console.warn(`[ad-spend] cleared ${count} campaign-level ${network} row(s) superseded by ad-set data`);
    }
  }
}

/**
 * Remove the ad-squad-level AGGREGATE row for exactly the (network, ad_set_id,
 * date) triples the creative-level fetch just covered — one grain further
 * down than `dropStaleCoarserRows` above, and guarded MORE tightly than it.
 *
 * That function clears every `ad_set_id=''` row for a whole network+date,
 * which is safe there because a squads-listing failure means NO ad-set rows
 * were written for that run at all — nothing partial to protect. Here, a
 * single squad's ads-listing or per-ad stats call failing is ROUTINE (one bad
 * squad among a dozen good ones, not an all-or-nothing failure), so a blanket
 * clear by network+date would delete a still-good ad-squad aggregate for the
 * one squad whose creative breakdown happened to fail this run — turning a
 * partial creative-fetch failure into a partial SPEND-total failure, which is
 * strictly worse. Scoped instead to only the (network, ad_set_id) pairs this
 * batch of rows actually has creative-level data for.
 */
async function dropStaleAdSquadLevelRows(rows: SpendRow[]): Promise<void> {
  const byAdSet = new Map<string, { network: string; adSetId: string; dates: Set<string> }>();
  for (const r of rows) {
    if (!r.creativeId || !r.adSetId) continue;
    const key = `${r.network}:${r.adSetId}`;
    if (!byAdSet.has(key)) byAdSet.set(key, { network: r.network, adSetId: r.adSetId, dates: new Set() });
    byAdSet.get(key)!.dates.add(r.date);
  }
  if (byAdSet.size === 0) return;

  const supabase = getSupabase();
  for (const { network, adSetId, dates } of byAdSet.values()) {
    const { error, count } = await supabase
      .from('ad_spend_daily')
      .delete({ count: 'exact' })
      .eq('network', network)
      .eq('ad_set_id', adSetId)
      .eq('creative_id', '')
      .in('date', [...dates]);

    if (error) {
      console.error(`[ad-spend] could not clear ad-squad-level rows for ${adSetId}:`, error.message);
    } else if (count) {
      console.warn(`[ad-spend] cleared ${count} ad-squad-level row(s) for ${adSetId} superseded by per-ad data`);
    }
  }
}

/**
 * Land demographic buckets in ad_demographics_daily.
 *
 * Upserts on the full grain for the same reason spend does — the trailing window
 * re-fetches days the networks are still restating, and an insert-only design
 * would duplicate every bucket on every run.
 *
 * NO EQUIVALENT OF dropStaleCoarserRows HERE, deliberately. That function exists
 * because spend changed grain and the finer rows landed BESIDE the coarser ones,
 * doubling the money. This table cannot have that problem: `dimension` is part of
 * the primary key and comes from a closed set, so a new dimension is a new
 * partition rather than a finer view of an existing one. What it CAN have is the
 * opposite mistake, made by a reader — summing spend across dimensions double
 * counts every rupee, because age and gender partition the same money. That is a
 * query-side rule, and it is stated on the table and in the migration.
 */
async function writeDemographics(rows: DemographicRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = getSupabase();
  const fetchedAt = new Date().toISOString();
  const payload = rows.map((r) => ({
    network: r.network,
    date: r.date,
    campaign_id: r.campaignId,
    campaign_name: r.campaignName,
    dimension: r.dimension,
    bucket: r.bucket,
    spend: r.spend,
    currency: r.currency,
    impressions: r.impressions,
    clicks: r.clicks,
    account_timezone: r.accountTimezone,
    fetched_at: fetchedAt,
    source: 'api'
  }));

  const { error } = await supabase
    .from('ad_demographics_daily')
    .upsert(payload, { onConflict: 'network,date,campaign_id,dimension,bucket', ignoreDuplicates: false });

  if (error) {
    // Loud, and specifically naming the migration: until it is run by hand this
    // is exactly the state, and a silent zero here is indistinguishable from a
    // network that reports no demographics at all.
    console.error(
      '[ad-spend] demographics NOT written (run 20260811065544_create_ad_demographics_daily_table.sql):',
      error.message,
      error.hint ?? ''
    );
    return 0;
  }

  return payload.length;
}

export async function syncAdSpend(windowDays = SYNC_WINDOW_DAYS): Promise<SyncOutcome> {
  const end = todayUtc();
  const start = addDays(end, -Math.max(0, windowDays - 1));

  // Five independent fetches. A demographics or creative-level call failing
  // must not stop the campaign/ad-set spend from syncing — that is the number
  // decisions are actually made on, and the finer breakdowns are colour
  // around it.
  const [snap, meta, snapCreative, snapDemo, metaDemo] = await Promise.all([
    fetchSnapSpend(start, end),
    fetchMetaSpend(start, end),
    fetchSnapCreativeSpend(start, end),
    fetchSnapDemographics(start, end),
    fetchMetaDemographics(start, end)
  ]);

  let written = 0;
  written += await writeRows(snap.rows);
  written += await writeRows(meta.rows);
  // WRITTEN LAST, DELIBERATELY. `writeRows` clears the ad-squad-level
  // aggregate for whatever this batch covers (`dropStaleAdSquadLevelRows`) —
  // if this ran before `snap.rows` above, that unconditional ad-squad upsert
  // would simply re-insert the rows the cleanup just removed, undoing it and
  // silently doubling the money again exactly the way the original
  // campaign/ad-set collision did.
  let creativeWritten = 0;
  creativeWritten += await writeRows(snapCreative.rows);

  let demoWritten = 0;
  demoWritten += await writeDemographics(snapDemo.rows);
  demoWritten += await writeDemographics(metaDemo.rows);

  return {
    start,
    end,
    written,
    networks: [
      { network: 'snap', configured: snap.configured, rows: snap.rows.length, error: snap.error },
      { network: 'meta', configured: meta.configured, rows: meta.rows.length, error: meta.error }
    ],
    demographics: {
      written: demoWritten,
      networks: [
        { network: 'snap', configured: snapDemo.configured, rows: snapDemo.rows.length, error: snapDemo.error },
        { network: 'meta', configured: metaDemo.configured, rows: metaDemo.rows.length, error: metaDemo.error }
      ]
    },
    // Snap only — see the type's doc comment for why Meta has no entry here.
    creativeSpend: {
      written: creativeWritten,
      networks: [
        {
          network: 'snap',
          configured: snapCreative.configured,
          rows: snapCreative.rows.length,
          error: snapCreative.error
        }
      ]
    }
  };
}

/**
 * Which credentials each network can see, by name and never by value.
 *
 * These were set by hand in a dashboard, so "is it configured?" is a real
 * question with a non-obvious answer, and the usual way to get it wrong is a
 * spelling that nothing complains about. Rendered in the health panel.
 */
export function adSpendConfigStatus() {
  return { snap: snapConfigStatus(), meta: metaConfigStatus() };
}
