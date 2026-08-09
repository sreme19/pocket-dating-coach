/**
 * One id per browsing session, shared by the view beacon and the store-click
 * beacon so the two first-party tables join.
 *
 * Scoped to `sessionStorage`, which is the deliberate middle setting. A
 * per-page-load id would mint a fresh visit on every reload and inflate the
 * denominator of tap rate; a persistent `localStorage` id would follow someone
 * across days and turn an anonymous measurement into something much closer to
 * tracking a person, on a page that has no account and collects nothing else.
 * A session is the unit the question is actually about: did this arrival tap
 * the button.
 *
 * Never throws. `sessionStorage` is unavailable in some in-app browsers and
 * throws outright in Safari's private mode — and the in-app browser inside
 * Snapchat is precisely where this traffic comes from. When storage is refused
 * the caller still gets a usable id, it just does not survive a reload, which
 * costs a little denominator accuracy and breaks nothing.
 */

const KEY = 'ra.visit_id';

/**
 * Held for the life of the document, not just as a cache.
 *
 * When storage is refused this is the ONLY thing keeping the view beacon and the
 * click beacon on the same id. Deriving a fresh random id per call would join
 * nothing — and it would fail specifically in the blocked-storage in-app browser
 * this page's traffic arrives through, which is the one case that has to work.
 */
let inMemory: string | null = null;

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // crypto.randomUUID needs a secure context; some in-app webviews are not one.
    return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function getVisitId(): string {
  if (typeof window === 'undefined') return '';
  if (inMemory) return inMemory;

  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) {
      inMemory = existing;
      return inMemory;
    }
    inMemory = randomId();
    window.sessionStorage.setItem(KEY, inMemory);
    return inMemory;
  } catch {
    // Storage blocked. An id that lives only as long as this document is still
    // worth sending: the view and any tap on this same page share it.
    inMemory = randomId();
    return inMemory;
  }
}
