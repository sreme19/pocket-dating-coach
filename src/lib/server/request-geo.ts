/**
 * The visitor's country, without keeping the address it came from.
 *
 * Both landing-page tables deliberately store no IP — see the note in the
 * marketing_store_clicks migration. That decision is worth keeping, but taken
 * alone it also removes the ability to tell an expensive market from a cheap
 * one, and choosing between markets is most of what paid-social spend
 * allocation actually is. Recruiting runs across India and Indonesia, where CPMs
 * and traffic quality differ by an order of magnitude; blending them into one
 * average number is how you end up scaling the wrong one.
 *
 * The edge has already resolved the address to a country by the time the
 * request reaches us, so we can read the answer and never touch the input. A
 * two-letter country code across thousands of visitors identifies nobody, which
 * is the whole difference between this and the column we chose not to add.
 */

/** Vercel's header in production; Cloudflare's is checked as a fallback. */
const HEADERS = ['x-vercel-ip-country', 'cf-ipcountry'] as const;

export function countryFromRequest(request: Request): string | null {
  for (const name of HEADERS) {
    const value = request.headers.get(name);
    // Cloudflare sends 'XX' for anonymising proxies and 'T1' for Tor. Neither is
    // a country, and storing them as one would put a fake market in the reports.
    if (value && /^[A-Za-z]{2}$/.test(value) && value.toUpperCase() !== 'XX' && value.toUpperCase() !== 'T1') {
      return value.toUpperCase();
    }
  }
  return null;
}
