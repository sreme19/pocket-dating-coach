/**
 * Tell our own server about a store-button tap, from a request built to
 * outlive the page that sent it.
 *
 * The pixels cannot be relied on for this event. Both hand it to a queue that
 * flushes on a ~1s timer, and every CTA on /get navigates to the Play Store
 * immediately — measured against production, the click fires at 6ms and the
 * beacon leaves at 1003ms, by which point the page may be gone and the queue
 * with it. That is why the store-click event read zero for a week while page
 * views, which sit still for far longer than a second, recorded fine.
 *
 * `keepalive` is the whole point: the spec requires the browser to keep such a
 * request alive after the document goes away, so there is no race to lose. The
 * server then reports to Snap and Meta from somewhere that is not being torn
 * down, which also puts the event beyond the reach of ad blockers and writes a
 * first-party row we can read in SQL instead of waiting on a dashboard.
 *
 * Fire-and-forget by design, and silent on failure. This runs while the visitor
 * is already leaving for Play; there is nothing useful to do with an error and
 * nobody left to show it to. Measurement never gets to break the tap.
 */

const ENDPOINT = '/api/marketing/store-click';

export interface StoreClickReport {
  /** Shared with both browser pixels so the networks dedupe. */
  eventId: string;
  cta: string;
  campaign: string;
  url: URL;
}

export function reportStoreClick({ eventId, cta, campaign, url }: StoreClickReport): void {
  if (typeof fetch === 'undefined') return;

  // Only the utm_* params travel. Everything else on the query string is
  // someone else's business and none of it is needed to attribute a campaign.
  const utm: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (key.startsWith('utm_')) utm[key] = value;
  });

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId,
        cta,
        campaign,
        utm,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null
      })
    }).catch(() => {
      /* the visitor is on their way to Play; a failed beacon is not their problem */
    });
  } catch {
    /* older browsers without keepalive, or a blocked request — same answer */
  }
}
