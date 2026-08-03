/**
 * Where a person actually gets the app — one definition, shared by every invite
 * surface (the /beta landing, /beta/{token}/app, the beta emails, the web
 * Coming Soon screen).
 *
 * Both stores went to OPEN testing on 2026-08-03: Play is a public listing and
 * TestFlight is a public join link, so there is no tester allow-list and no
 * human in the loop any more. Two consequences are baked into this module:
 *
 *  1. Nothing waits. An invite surface hands over the download immediately
 *     rather than promising a follow-up email once an admin adds the address.
 *  2. Every surface offers BOTH stores. The device we think someone is on is
 *     always a guess — a self-declared dropdown on the /beta form, a
 *     User-Agent sniff on /beta/{token}/app, a `platform` column captured
 *     weeks earlier — and a wrong guess used to be a dead end. `platform` is
 *     therefore an ORDERING hint only, never a filter.
 *
 * Client-safe on purpose (no $env, no server imports) so Svelte pages can
 * import it directly instead of threading the links through a loader.
 */

export type Platform = 'ios' | 'android';

export const STORE_LINKS: Record<Platform, string> = {
  android: 'https://play.google.com/store/apps/details?id=com.riteangle.app',
  ios: 'https://testflight.apple.com/join/FxGV4VrC',
};

export function storeUrlFor(platform: Platform): string {
  return STORE_LINKS[platform] ?? '';
}

export interface StoreChoice {
  platform: Platform;
  /** Leads with the phone, not the store — people know which phone they hold. */
  label: string;
  url: string;
}

const CHOICE: Record<Platform, StoreChoice> = {
  android: {
    platform: 'android',
    label: 'Android — Get it on Google Play',
    url: STORE_LINKS.android,
  },
  ios: {
    platform: 'ios',
    label: 'iPhone — Join the beta on TestFlight',
    url: STORE_LINKS.ios,
  },
};

/**
 * Both stores, with the likely device first. Android leads when we have no idea:
 * Play open testing is the wider channel, and TestFlight additionally needs the
 * TestFlight app, so it is the worse blind guess.
 */
export function storeChoices(platform: Platform | null): StoreChoice[] {
  const order: Platform[] = platform === 'ios' ? ['ios', 'android'] : ['android', 'ios'];
  return order.map((p) => CHOICE[p]);
}
