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
import { fetchSnapSpend, addDays, snapConfigStatus, type SpendRow } from './snap';
import { fetchMetaSpend, metaConfigStatus } from './meta';

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
    fetched_at: new Date().toISOString(),
    source: 'api'
  }));

  // ignoreDuplicates is deliberately FALSE here — the opposite of every other
  // upsert in this codebase. A re-fetched day is expected to differ from the
  // stored one; that restatement is the entire reason for re-fetching, and
  // ignoring it would freeze each day at whatever it read within hours of
  // happening, which is exactly when it is least final.
  const { error } = await supabase
    .from('ad_spend_daily')
    .upsert(payload, { onConflict: 'network,date,campaign_id,ad_set_id,creative_id', ignoreDuplicates: false });

  if (error) {
    console.error('[ad-spend] rows NOT written:', error.message, error.hint ?? '');
    return 0;
  }

  await dropStaleCoarserRows(rows);
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

export async function syncAdSpend(windowDays = SYNC_WINDOW_DAYS): Promise<SyncOutcome> {
  const end = todayUtc();
  const start = addDays(end, -Math.max(0, windowDays - 1));

  const [snap, meta] = await Promise.all([fetchSnapSpend(start, end), fetchMetaSpend(start, end)]);

  let written = 0;
  written += await writeRows(snap.rows);
  written += await writeRows(meta.rows);

  return {
    start,
    end,
    written,
    networks: [
      { network: 'snap', configured: snap.configured, rows: snap.rows.length, error: snap.error },
      { network: 'meta', configured: meta.configured, rows: meta.rows.length, error: meta.error }
    ]
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
