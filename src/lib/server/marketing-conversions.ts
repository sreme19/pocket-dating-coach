/**
 * Server-side conversion reporting for the /get landing page.
 *
 * Why this exists at all: both ad pixels hand an event to a queue that flushes
 * on a ~1s timer, and every CTA on /get leaves for the Play Store immediately.
 * Measured against production — click at 6ms, beacon out at 1003ms — so the
 * page can be gone before the flush and the tap is never reported. Page views
 * survive because arrivals sit still for longer than a second; button taps do
 * not. That is why Custom event 1 sat at zero while landing page views climbed.
 *
 * The browser sends the tap here with `keepalive: true`, which is specified to
 * outlive the document, and this module does the reporting from a server that
 * is not in the middle of being destroyed. Three things fall out of that:
 * ad blockers cannot suppress it, the flush race disappears, and there is a
 * first-party row to read in SQL instead of waiting on a vendor dashboard.
 *
 * Dedup: `event_id` comes from the browser and goes to both networks with BOTH
 * the browser-side and server-side copies of the event, so each collapses the
 * pair into one conversion. Without it every tap would be counted twice.
 */

import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getSupabase } from '$lib/server/supabase';
import { isProductionUrl } from '$lib/marketing/production-origin';

/** Matches the pixel modules. Kept here so the server never imports client code. */
const SNAP_PIXEL_ID = '0657d30b-4d65-414b-b9a9-65edb4aa1e07';
const META_PIXEL_ID = '2286986682092608';

const SNAP_EVENT = 'CUSTOM_EVENT_1';
const META_EVENT = 'StoreClick';

const SNAP_CAPI = 'https://tr.snapchat.com/v2/conversion';
const META_CAPI = `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`;

/** Every network call is bounded — a slow vendor must not hold the response open. */
const FORWARD_TIMEOUT_MS = 2500;

export interface StoreClickInput {
  eventId: string;
  /** Joins this tap to the arrival that produced it. Null where sessionStorage was refused. */
  visitId: string | null;
  /** Which landing page earned the tap — 'get' | 'get_photos' | 'aibestie'. */
  page: string;
  /**
   * Meta's click identifier, from fbclid. The strongest match signal available:
   * it identifies the click itself rather than inferring a person from a device.
   */
  fbc: string | null;
  /** Meta's browser identifier, the `_fbp` cookie the pixel set. */
  fbp: string | null;
  cta: string;
  campaign: string | null;
  utm: Record<string, string>;
  userAgent: string | null;
  referrer: string | null;
  /** Two-letter code resolved at the edge. The IP it came from is never stored. */
  country: string | null;
  /** Forwarded to the networks for match quality; never persisted. */
  clientIp: string | null;
  /** Page the tap happened on, needed by both CAPIs. */
  eventSourceUrl: string;
}

/** Meta requires user data hashed; Snap requires the same for its own fields. */
function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Meta carries its token in the body, Snap in an Authorization header. */
async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${text.slice(0, 300)}`);
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Snap Conversions API. No-ops without a token, so this ships useful — the
 * first-party row is written either way — and starts forwarding the moment
 * SNAP_CAPI_TOKEN is set, with no code change.
 */
async function forwardToSnap(input: StoreClickInput, at: number): Promise<boolean | null> {
  const token = env.SNAP_CAPI_TOKEN;
  if (!token) return null;

  await postJson(
    SNAP_CAPI,
    {
      pixel_id: SNAP_PIXEL_ID,
      event_type: SNAP_EVENT,
      event_conversion_type: 'WEB',
      timestamp: at,
      // Same id the browser pixel sent, so Snap keeps one conversion not two.
      client_dedup_id: input.eventId,
      page_url: input.eventSourceUrl,
      user_agent: input.userAgent ?? undefined,
      hashed_ip_address: input.clientIp ? sha256(input.clientIp) : undefined,
      item_category: 'play_store_click',
      item_ids: [input.cta],
      description: input.campaign ?? 'get_lp'
    },
    { authorization: `Bearer ${token}` }
  );
  return true;
}

/**
 * Meta Conversions API. Same no-op-without-a-token contract as Snap.
 */
async function forwardToMeta(input: StoreClickInput, at: number): Promise<boolean | null> {
  const token = env.META_CAPI_TOKEN;
  if (!token) return null;

  await postJson(META_CAPI, {
    access_token: token,
    data: [
      {
        event_name: META_EVENT,
        event_time: at,
        // Meta dedupes on event_name + event_id against the browser event.
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: 'website',
        user_data: {
          client_user_agent: input.userAgent ?? undefined,
          client_ip_address: input.clientIp ?? undefined,
          // fbc first in importance, not in order: with it the conversion is
          // matched to the click that produced it. Without it Meta is left
          // inferring a person from a user agent and an IP, which it accepts and
          // then largely discounts — a conversion reported but not acted on.
          fbc: input.fbc ?? undefined,
          fbp: input.fbp ?? undefined
        },
        custom_data: { cta: input.cta, campaign: input.campaign ?? 'get_lp' }
      }
    ]
  });
  return true;
}

/**
 * Record the tap, then report it onward.
 *
 * The forwards are AWAITED, deliberately. On Vercel a function is frozen the
 * moment its response is returned, so a promise left running is not "finished
 * later", it is silently dropped — that is what left the nightly matchmaker
 * with six started runs and zero completed ones. A tap is worth ~2.5s of
 * function time; a conversion that vanishes is not.
 *
 * Never throws. This is called from a request the browser fires as it leaves
 * the page, and there is nothing on the other end to receive an error.
 */
export async function recordStoreClick(input: StoreClickInput): Promise<void> {
  const at = Math.floor(Date.now() / 1000);

  let snap: boolean | null = null;
  let meta: boolean | null = null;
  const errors: string[] = [];

  /**
   * Only the live site reports conversions.
   *
   * The browser pixels are gated the same way, but this half matters more: it
   * runs server-side, so an ad blocker cannot stop it and a dev machine cannot
   * be told apart by the network. A tap fired while verifying a build on
   * localhost:5211 was reported to Snap as a genuine conversion — snap_forwarded
   * came back true — which is dev behaviour teaching the auction what a
   * converting user looks like.
   *
   * The first-party row is still written either way. It is ours, it is
   * filterable, and being able to verify the write path locally is the whole
   * reason this table can be trusted.
   */
  const live = isProductionUrl(input.eventSourceUrl);

  if (live) {
    const [snapResult, metaResult] = await Promise.allSettled([
      forwardToSnap(input, at),
      forwardToMeta(input, at)
    ]);

    if (snapResult.status === 'fulfilled') snap = snapResult.value;
    else {
      snap = false;
      errors.push(`snap: ${snapResult.reason}`);
    }

    if (metaResult.status === 'fulfilled') meta = metaResult.value;
    else {
      meta = false;
      errors.push(`meta: ${metaResult.reason}`);
    }
  } else {
    // Null, matching "not attempted" — the same value an unconfigured token
    // produces. The health check reads null as "not forwarded", never as failure.
    console.info('[marketing] non-production origin, conversion not forwarded:', input.eventSourceUrl);
  }

  try {
    const supabase = getSupabase();

    // The columns this table has always had. Split out so the write can fall
    // back to them if the newer ones are not there yet — see below.
    const base = {
      event_id: input.eventId,
      cta: input.cta,
      campaign: input.campaign,
      utm: input.utm,
      user_agent: input.userAgent,
      referrer: input.referrer,
      snap_forwarded: snap,
      meta_forwarded: meta,
      forward_error: errors.length ? errors.join(' | ').slice(0, 500) : null
    };

    // `event_id` is unique: a retried keepalive request writes one row, not two.
    let { error } = await supabase.from('marketing_store_clicks').upsert(
      { ...base, visit_id: input.visitId, page: input.page, country: input.country },
      { onConflict: 'event_id', ignoreDuplicates: true }
    );

    /**
     * Retry without the new columns if the database has not got them yet.
     *
     * visit_id, page and country arrive in a migration that is run BY HAND, in a
     * SQL editor, separately from the deploy. Between those two moments
     * PostgREST rejects the whole row for naming a column that does not exist —
     * so a deploy that lands first would not degrade this table, it would switch
     * it off completely, and taps that record fine today would vanish until
     * someone noticed. That is the exact failure this table was built to end.
     *
     * Losing three columns of detail on a handful of taps is a far smaller cost
     * than losing the taps, so the older shape is written instead and the gap
     * is logged loudly enough to act on.
     */
    if (error?.code === 'PGRST204') {
      console.warn(
        '[marketing] store click: new columns missing, writing legacy shape — run 20260809170000_create_marketing_page_views.sql:',
        error.message
      );
      ({ error } = await supabase
        .from('marketing_store_clicks')
        .upsert(base, { onConflict: 'event_id', ignoreDuplicates: true }));
    }

    // Checked, not assumed: PostgREST reports a missing table or a policy
    // refusal in `error` rather than by throwing, so a `try` alone would let
    // the write fail in complete silence — on the one table whose entire job is
    // to be the thing we can still read when the dashboards say nothing. Until
    // the migration is run this is exactly the state, and it should say so.
    if (error) {
      console.error('[marketing] store click NOT recorded:', error.message, error.hint ?? '');
    }
  } catch (err) {
    // A database blip must not turn into a 500 on a request the visitor's
    // browser fired on its way out the door.
    console.error('[marketing] failed to record store click', err);
  }
}
