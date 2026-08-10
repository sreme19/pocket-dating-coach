/**
 * Is this the real site, or someone's laptop?
 *
 * WHY THIS EXISTS. The ad pixels shipped with no origin check, so they fired
 * from anywhere the landing pages ran — including localhost. Meta's Events
 * Manager shows the result plainly: over 28 days `www.riteangle.dating` sent 132
 * events and **`localhost` sent 21**, so roughly 13% of the pixel's volume was
 * developer traffic. The server-side conversion forward had the same hole, which
 * is how a store-click fired while verifying a build on port 5211 ended up
 * reported to Snap as a genuine conversion.
 *
 * This is not cosmetic. Both networks train delivery on the conversions they are
 * sent, so dev traffic does not merely inflate a count — it teaches the auction
 * to look for people who behave like a developer reloading a page. It also
 * inflates the denominator of everything the networks report back, which makes
 * their numbers disagree with ours for a reason nobody would think to look for.
 *
 * Deliberately a hostname allow-list rather than a build-time flag. A preview
 * deploy runs the production bundle, so `import.meta.env.PROD` is true there too
 * and would let every preview URL report conversions against the live pixel.
 * What matters is not how the code was compiled but which address the visitor
 * actually loaded, and only one address ever appears in an advert.
 */

/**
 * Hosts whose traffic is real. `www.riteangle.dating` is the verified domain and
 * the only one an ad ever points at; the apex is included because it redirects
 * there and a stray link could land on it.
 *
 * The *.vercel.app alias is deliberately NOT here. It serves the same build, but
 * the only people who reach it are us — so its events are staff traffic wearing
 * production's clothes, which is the exact thing this list exists to keep out.
 */
const PRODUCTION_HOSTS = new Set(['www.riteangle.dating', 'riteangle.dating']);

export function isProductionHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

/** Browser-side convenience. False during SSR, which cannot fire a pixel anyway. */
export function isProductionBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return isProductionHost(window.location.hostname);
}

/** Server-side check against the page a beacon claims to have come from. */
export function isProductionUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return isProductionHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
