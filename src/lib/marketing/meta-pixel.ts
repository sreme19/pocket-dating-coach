/**
 * The Meta Pixel — Facebook/Instagram's conversion tag for the paid-social
 * landing page. Sibling of `snap-pixel.ts`; the same rules apply, for the same
 * reasons, and one extra that is specific to Meta.
 *
 * DELIBERATELY NOT IN app.html. Meta's own instructions say to paste the base
 * code into the site's <head>, which on a SvelteKit app means every route,
 * including the whole signed-in product. That is wrong here:
 *
 *  1. Privacy. Meta's "Automatic Advanced Matching" reads form fields and page
 *     content for things that look like emails, phone numbers and names,
 *     hashes them, and sends them for identity matching. Inside a dating app
 *     that is members' contact details, from threads and profiles they never
 *     agreed to hand to an ad network. On /get there is no form at all, so the
 *     same tag collects nothing. Keep it that way: never lift this into a
 *     layout or app.html.
 *  2. Signal quality. A pixel firing on every screen of a logged-in app reports
 *     mostly existing members — noise for a campaign whose job is finding
 *     people who are not members yet.
 *
 * And the Meta-specific one:
 *
 *  3. `autoConfig` is switched OFF below, on purpose. Left on — its default —
 *     Meta watches the DOM and invents events from button clicks it decides
 *     look interesting, storing those rules on Meta's servers rather than in
 *     this repo. Snap's equivalent feature silently bound three rules to this
 *     page's CTAs and double-counted every tap under a second event name for
 *     weeks; nothing in the codebase revealed it, because nothing in the
 *     codebase caused it. One measured event we wrote down beats two we did
 *     not. Turning this off also disables Automatic Advanced Matching, which
 *     is the point of item 1.
 *
 * Loaded from script rather than pasted into <svelte:head> because SvelteKit
 * does not re-execute head scripts on client-side navigation, so a visitor
 * reaching /get from an in-app link would go uncounted. `initMetaPixel()` is
 * idempotent and safe to call on every mount.
 */

/**
 * From Meta Events Manager → Data sources → your pixel. A 15–16 digit number.
 *
 * Empty until that ID exists, and every function here no-ops while it is —
 * shipping a half-configured pixel that 404s on every page view is worse than
 * shipping none. Paste the ID and it activates on the next deploy.
 */
const PIXEL_ID = '';

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/**
 * The event fired when someone taps through to the Play listing.
 *
 * A custom event, not `Lead` or `CompleteRegistration` or `Purchase`. This
 * page's real conversion is an install, which no web pixel can see — the tap
 * out to Play is the last thing we can honestly observe, so that is what gets
 * reported, under a name that says exactly what happened. Borrowing a standard
 * event would read better in Ads Manager and would be a lie about what the
 * number counts.
 *
 * To optimise a campaign against it: Events Manager → Custom Conversions →
 * create one from this event, then pick that conversion as the campaign's
 * optimisation goal. Meta needs ~50 of them a week before optimisation is
 * meaningful, so start on Landing Page Views and switch once volume is real.
 */
export const STORE_CLICK_EVENT = 'StoreClick';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: { apply: (ctx: unknown, args: unknown[]) => void };
  queue: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;

/**
 * Install the base code and fire PageView. Browser-only; a no-op on the server,
 * on any call after the first, and while PIXEL_ID is unset.
 */
export function initMetaPixel(): void {
  if (typeof window === 'undefined' || started || !PIXEL_ID) return;
  started = true;

  // Meta's base snippet, transcribed. The stub queues calls made before
  // fbevents.js has loaded and replays them once it has, which is why the
  // `track` below can run on the same tick as the injection.
  if (!window.fbq) {
    const stub = function (this: unknown, ...args: unknown[]) {
      stub.callMethod ? stub.callMethod.apply(stub, args) : stub.queue.push(args);
    } as Fbq;
    stub.queue = [];
    stub.loaded = true;
    stub.version = '2.0';
    stub.push = stub;
    window.fbq = stub;
    window._fbq ??= stub;

    const script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT_SRC;
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  }

  // Must precede `init` to take effect. See item 3 in the header: this is what
  // stops Meta inventing its own events off our buttons and reading the page
  // for contact details.
  window.fbq('set', 'autoConfig', false, PIXEL_ID);

  // No advanced-matching object passed: this page collects no contact details,
  // and we do not hand Meta any harvested from elsewhere.
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

/**
 * Report a custom event. Silent when the pixel never loaded — an ad blocker or
 * a failed CDN request must never break the page or its links.
 */
export function trackMeta(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  try {
    window.fbq('trackCustom', event, params ?? {});
  } catch {
    /* measurement is never worth an exception on the page we pay for */
  }
}
