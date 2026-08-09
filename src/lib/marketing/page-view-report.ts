/**
 * Tell our own server that a paid landing page was opened.
 *
 * The sibling of store-click-report.ts, and it exists for the same reason: the
 * only record of a landing page view currently lives in Snap's and Meta's
 * dashboards, so store-tap rate — views divided by taps — has a numerator we
 * own and a denominator we do not. That is not a rate anyone can audit, and the
 * clicks table was built in the first place because the vendor numbers turned
 * out to be wrong for a week.
 *
 * Unlike the click beacon this one is NOT racing a page teardown — an arrival
 * sits still, which is exactly why the pixels' own PAGE_VIEW survived while
 * their store-click event read zero. `keepalive` is still set, because a visitor
 * who lands and immediately taps through would otherwise lose the view and leave
 * a tap with no visit to attach to.
 *
 * Fire-and-forget and silent on failure, same contract as the click beacon:
 * measurement never gets to break the page.
 */

import { getVisitId } from './visit-id';

const ENDPOINT = '/api/marketing/page-view';

/** The landing pages that report views. Must match the table's check constraint. */
export type LandingPage = 'get' | 'get_photos' | 'aibestie';

export interface PageViewReport {
  page: LandingPage;
  campaign: string;
  url: URL;
}

export function reportPageView({ page, campaign, url }: PageViewReport): void {
  if (typeof fetch === 'undefined') return;

  // Only the utm_* params travel. Everything else on the query string is someone
  // else's business and none of it is needed to attribute a campaign.
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
        visitId: getVisitId(),
        page,
        campaign,
        utm,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null
      })
    }).catch(() => {
      /* a lost view is a slightly wrong denominator, not the visitor's problem */
    });
  } catch {
    /* older browsers without keepalive, or a blocked request — same answer */
  }
}
