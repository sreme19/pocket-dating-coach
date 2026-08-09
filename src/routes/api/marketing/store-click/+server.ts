import type { RequestHandler } from './$types';
import { recordStoreClick } from '$lib/server/marketing-conversions';

/**
 * POST /api/marketing/store-click
 *
 * Called from /get as the visitor taps through to the Play Store, with
 * `keepalive: true` so the request outlives the page. See
 * marketing-conversions.ts for why the browser pixels alone cannot be trusted
 * with this event.
 *
 * Deliberately unauthenticated: it is fired by anonymous ad traffic on a page
 * that has no login and no form. The defences are therefore shape-based rather
 * than identity-based — a small body, a closed set of CTA names, hard length
 * caps, and a table whose only unique key is the browser-generated event id, so
 * a flood writes bounded garbage rather than unbounded rows.
 *
 * Always answers 204, even on rubbish input. There is nobody on the other end:
 * the tab that sent this is already navigating to Play, and an error status
 * would be read by nothing and logged as a client error by Vercel.
 */

/** The four CTAs on /get. Anything else is not from our page. */
const ALLOWED_CTAS = new Set(['hero', 'mid', 'footer', 'sticky']);

const MAX_BODY_BYTES = 2_000;
const MAX_CAMPAIGN = 120;
const MAX_UA = 500;
const MAX_REFERRER = 500;
const MAX_UTM_KEYS = 12;

function clamp(value: unknown, max: number): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null;
}

export const POST: RequestHandler = async ({ request, getClientAddress, url }) => {
  const noContent = new Response(null, { status: 204 });

  // Cheap guard before parsing: a body this large is not one of our taps.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return noContent;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return noContent;
  }

  const cta = typeof body.cta === 'string' ? body.cta : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';

  // An event id we did not generate is the one field we cannot substitute a
  // default for — it is what stops the networks counting the tap twice.
  if (!ALLOWED_CTAS.has(cta) || !/^[a-zA-Z0-9-]{8,64}$/.test(eventId)) {
    return noContent;
  }

  const rawUtm = (body.utm ?? {}) as Record<string, unknown>;
  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawUtm).slice(0, MAX_UTM_KEYS)) {
    if (typeof v === 'string' && /^utm_[a-z_]{1,24}$/.test(k)) utm[k] = v.slice(0, 120);
  }

  await recordStoreClick({
    eventId,
    cta,
    campaign: clamp(body.campaign, MAX_CAMPAIGN),
    utm,
    userAgent: clamp(request.headers.get('user-agent'), MAX_UA),
    referrer: clamp(body.referrer, MAX_REFERRER),
    // Forwarded to the networks for match quality, never stored.
    clientIp: (() => {
      try {
        return getClientAddress();
      } catch {
        return null;
      }
    })(),
    eventSourceUrl: new URL('/get', url.origin).toString()
  });

  return noContent;
};
