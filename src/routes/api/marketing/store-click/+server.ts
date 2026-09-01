import type { RequestHandler } from './$types';
import { recordStoreClick } from '$lib/server/marketing-conversions';
import { geoFromRequest } from '$lib/server/request-geo';
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

/**
 * The CTAs each landing page actually has. Per page rather than one shared set:
 * the closed list is this endpoint's whole defence, and a single pool would let
 * a forged /get tap wear "chat_gate" — a button /get does not have — and land in
 * the position-breakdown chart as a phantom row.
 */
const ALLOWED_CTAS: Record<string, Set<string>> = {
  get: new Set(['hero', 'mid', 'footer', 'sticky']),
  // Her variant of /get carries the same four positions as his.
  get_w: new Set(['hero', 'mid', 'footer', 'sticky']),
  get_photos: new Set(['hero', 'mid', 'footer', 'sticky']),
  // Four moments of persuasion on a chat page, not four positions on a
  // brochure: the header Continue, the in-chat signup gate, the profile sheet,
  // the leave sheet. Which moment converts is the question /aibestie exists to
  // answer.
  aibestie: new Set(['header', 'chat_gate', 'profile_sheet', 'leave_sheet']),
  // One button, and it only exists after she clears the age gate. Naming it
  // 'qualified' rather than 'hero' keeps the position-breakdown chart honest:
  // this is not a position on a brochure, it is the only CTA on the page and it
  // is gated, so a tap here means she answered.
  get_w_apply: new Set(['qualified']),
  // Same three positions as /get_w's hero/mid/footer, minus 'sticky' — this
  // page has no sticky bar.
  get_w_drip: new Set(['hero', 'mid', 'footer'])
};

/**
 * Meta's identifier formats, both `fb.<subdomainIndex>.<createdMs>.<value>`.
 *
 * Validated rather than passed through: these go straight into an outbound API
 * call, and a malformed value gets the whole conversion rejected by Meta rather
 * than just that field ignored.
 */
const FB_ID_PATTERN = /^fb\.\d\.\d{10,}\.[A-Za-z0-9_.-]{1,400}$/;
const MAX_FB_ID = 500;

/** Landing pages that report taps, and the path each one lives at. */
const PAGE_PATHS: Record<string, string> = {
  get: '/get',
  get_w: '/get/w',
  get_photos: '/get-photos',
  aibestie: '/aibestie',
  get_w_apply: '/get/w-apply',
  get_w_drip: '/get/w-drip'
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

  // Page resolves BEFORE the CTA check, because the CTA list is per page.
  // Defaults to 'get' so taps sent by an older cached copy of the page — which
  // will keep arriving for as long as someone has it open — land as the page
  // they actually came from rather than as an unknown.
  const rawPage = typeof body.page === 'string' ? body.page : '';
  const page = rawPage in PAGE_PATHS ? rawPage : 'get';

  // An event id we did not generate is the one field we cannot substitute a
  // default for — it is what stops the networks counting the tap twice.
  if (!ALLOWED_CTAS[page].has(cta) || !ID_PATTERN.test(eventId)) {
    return noContent;
  }

  // The visit id is not required. It arrives from sessionStorage, which some
  // in-app browsers refuse outright — and this traffic comes through Snapchat's.
  // A tap that cannot be joined to its arrival is still a tap worth recording;
  // it just sits outside the per-visit rate, which is why the reports have to
  // treat a null here as unknown rather than as a visit that did not convert.
  const rawVisitId = typeof body.visitId === 'string' ? body.visitId : '';
  const visitId = ID_PATTERN.test(rawVisitId) ? rawVisitId : null;

  // Dropped silently when malformed rather than passed on: an invalid fbc costs
  // the entire conversion, whereas an absent one only costs match quality.
  const fbId = (value: unknown): string | null => {
    const raw = clamp(value, MAX_FB_ID);
    return raw && FB_ID_PATTERN.test(raw) ? raw : null;
  };

  const geo = geoFromRequest(request);

  await recordStoreClick({
    eventId,
    visitId,
    page,
    cta,
    fbc: fbId(body.fbc),
    fbp: fbId(body.fbp),
    campaign: clamp(body.campaign, MAX_CAMPAIGN),
    utm: sanitizeUtm(body.utm),
    userAgent: clamp(request.headers.get('user-agent'), MAX_UA),
    referrer: clamp(body.referrer, MAX_REFERRER),
    // Resolved at the edge from an address we never store. See request-geo.ts.
    country: geo.country,
    city: geo.city,
    region: geo.region,
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
