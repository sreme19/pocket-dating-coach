import type { RequestHandler } from './$types';
import { recordPageView } from '$lib/server/marketing-page-views';
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
 * POST /api/marketing/page-view
 *
 * Fired on arrival at /get, /get/w, /get-photos and /aibestie. Writes the denominator
 * for store-tap rate, which until now existed only inside Snap's and Meta's
 * dashboards.
 *
 * Deliberately unauthenticated, for the same reason as the store-click endpoint:
 * anonymous ad traffic on pages with no login and no form. The defences are
 * shape-based — a small body, a closed set of page names, hard length caps, and
 * a unique (visit_id, page) key so a flood writes bounded garbage.
 *
 * Always answers 204, even on rubbish input. Nobody is reading the status: this
 * is a beacon, and an error code would be seen by nothing while being logged as
 * a client error by Vercel.
 */

/** Must match the table's check constraint. */
const ALLOWED_PAGES = new Set(['get', 'get_w', 'get_photos', 'aibestie']);

export const POST: RequestHandler = async ({ request }) => {
  const noContent = new Response(null, { status: 204 });

  // Cheap guard before parsing: a body this large is not one of our beacons.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return noContent;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return noContent;
  }

  const page = typeof body.page === 'string' ? body.page : '';
  const visitId = typeof body.visitId === 'string' ? body.visitId : '';

  // The visit id is the one field with no sensible default — it is what lets a
  // later tap be joined to this arrival, and a made-up one would join to the
  // wrong visit rather than to none.
  if (!ALLOWED_PAGES.has(page) || !ID_PATTERN.test(visitId)) return noContent;

  // Resolved at the edge from an address we never see and never store.
  const geo = geoFromRequest(request);

  await recordPageView({
    visitId,
    page: page as 'get' | 'get_w' | 'get_photos' | 'aibestie',
    campaign: clamp(body.campaign, MAX_CAMPAIGN),
    utm: sanitizeUtm(body.utm),
    userAgent: clamp(request.headers.get('user-agent'), MAX_UA),
    referrer: clamp(body.referrer, MAX_REFERRER),
    country: geo.country,
    city: geo.city,
    region: geo.region
  });

  return noContent;
};
