/**
 * The Snap Pixel — Snapchat's conversion tag for the paid-social landing page.
 *
 * DELIBERATELY NOT IN app.html. Snap's own instructions say to paste the base
 * code into the site's <head>, which on a SvelteKit app means every route,
 * including the whole signed-in product. That is wrong here for two reasons:
 *
 *  1. Privacy. The pixel's "automated signal collector" scrapes the page for
 *     things that look like email addresses and phone numbers, hashes them, and
 *     sends them to Snap for identity matching. Inside a dating app that is
 *     members' contact details, in threads and profiles they never agreed to
 *     share with an advertising network. On /get there is nothing to collect —
 *     the page has no form at all — so the same tag is harmless here and only
 *     here. Keep it that way: do not lift this into a layout or app.html.
 *  2. Signal quality. A pixel that fires on every screen of a logged-in app
 *     reports mostly existing members, which is noise for a campaign whose
 *     whole job is finding people who are not members yet.
 *
 * Loaded from script rather than pasted as an inline <script> in <svelte:head>
 * because SvelteKit does not re-execute head scripts on client-side navigation,
 * so a visitor arriving at /get from any in-app link would go uncounted.
 * `initSnapPixel()` is idempotent and safe to call on every mount.
 */

import { isProductionBrowser } from './production-origin';

const PIXEL_ID = '0657d30b-4d65-414b-b9a9-65edb4aa1e07';
const SCRIPT_SRC = 'https://sc-static.net/scevent.min.js';

/**
 * The event fired when someone taps through to the Play listing.
 *
 * This page's real conversion is an install, which a web pixel cannot see —
 * the tap out to Play is the last thing we can honestly observe, so that is
 * what we report, and it is named as a custom event rather than dressed up as
 * APP_INSTALL or SIGN_UP. Select "Custom Event 1" as the campaign's
 * optimisation goal in Ads Manager to match. Swapping this one constant for a
 * standard event (e.g. 'SIGN_UP') is the only change needed if that is ever
 * preferred for reporting.
 */
export const STORE_CLICK_EVENT = 'CUSTOM_EVENT_1';

type Snaptr = ((...args: unknown[]) => void) & {
  handleRequest?: (...args: unknown[]) => void;
  queue: IArguments[];
};

declare global {
  interface Window {
    snaptr?: Snaptr;
  }
}

let started = false;

/**
 * Install the base code and fire PAGE_VIEW. Browser-only; a no-op on the server
 * and on any call after the first.
 */
export function initSnapPixel(): void {
  if (typeof window === 'undefined' || started) return;
  // Same gate as Meta: a page opened on a dev machine is not a visitor, and a
  // conversion reported from one teaches the auction the wrong thing.
  if (!isProductionBrowser()) return;
  started = true;

  // Snap's own base snippet, transcribed. The stub queues calls made before
  // scevent.min.js has loaded and replays them once it has, which is why
  // `track` below can run on the same tick as the injection.
  if (!window.snaptr) {
    const stub = function (this: unknown, ...args: unknown[]) {
      stub.handleRequest
        ? stub.handleRequest.apply(stub, args)
        : // eslint-disable-next-line prefer-rest-params
          stub.queue.push(arguments as unknown as IArguments);
    } as Snaptr;
    stub.queue = [];
    window.snaptr = stub;

    const script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT_SRC;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }

  // No user_email / user_phone_number passed: this page collects neither, and
  // we do not hand Snap contact details harvested from anywhere else.
  window.snaptr('init', PIXEL_ID, {});
  window.snaptr('track', 'PAGE_VIEW');
}

/**
 * Report an event. Silent when the pixel never loaded — an ad blocker or a
 * failed CDN request must never break the page or its links.
 */
export function trackSnap(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.snaptr) return;
  try {
    window.snaptr('track', event, params ?? {});
  } catch {
    /* measurement is never worth an exception on the page we pay for */
  }
}
