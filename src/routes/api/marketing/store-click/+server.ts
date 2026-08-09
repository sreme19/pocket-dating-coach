import type { RequestHandler } from './$types';
import { recordStoreClick } from '$lib/server/marketing-conversions';
import { countryFromRequest } from '$lib/server/request-geo';
import {
  MAX_BODY_BYTES,
  MAX_CAMPAIGN,
  MAX_REFERRER,
  MAX_UA,
  ID_PATTERN,
  clamp,
  sanitizeUtm
} from '$lib/server/marketing-input';

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

/** The four CTAs shared by /get and /get-photos. Anything else is not from our pages. */
const ALLOWED_CTAS = new Set(['hero', 'mid', 'footer', 'sticky']);

/** Landing pages that report taps, and the path each one lives at. */
const PAGE_PATHS: Record<string, string> = {
  get: '/get',
  get_photos: '/get-photos',
  aibestie: '/aibestie'
};

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
  if (!ALLOWED_CTAS.has(cta) || !ID_PATTERN.test(eventId)) {
    return noContent;
  }

  // The visit id is not required. It arrives from sessionStorage, which some
  // in-app browsers refuse outright — and this traffic comes through Snapchat's.
  // A tap that cannot be joined to its arrival is still a tap worth recording;
  // it just sits outside the per-visit rate, which is why the reports have to
  // treat a null here as unknown rather than as a visit that did not convert.
  const rawVisitId = typeof body.visitId === 'string' ? body.visitId : '';
  const visitId = ID_PATTERN.test(rawVisitId) ? rawVisitId : null;

  // Defaults to 'get' so taps sent by an older cached copy of the page — which
  // will keep arriving for as long as someone has it open — land as the page
  // they actually came from rather than as an unknown.
  const rawPage = typeof body.page === 'string' ? body.page : '';
  const page = rawPage in PAGE_PATHS ? rawPage : 'get';

  await recordStoreClick({
    eventId,
    visitId,
    page,
    cta,
    campaign: clamp(body.campaign, MAX_CAMPAIGN),
    utm: sanitizeUtm(body.utm),
    userAgent: clamp(request.headers.get('user-agent'), MAX_UA),
    referrer: clamp(body.referrer, MAX_REFERRER),
    // Resolved at the edge from an address we never store. See request-geo.ts.
    country: countryFromRequest(request),
    // Forwarded to the networks for match quality, never stored.
    clientIp: (() => {
      try {
        return getClientAddress();
      } catch {
        return null;
      }
    })(),
    // The page the tap actually happened on. Both CAPIs use this for attribution
    // and Meta checks it against the verified domain, so reporting every tap as
    // /get would misattribute every /get-photos conversion.
    eventSourceUrl: new URL(PAGE_PATHS[page], url.origin).toString()
  });

  return noContent;
};
