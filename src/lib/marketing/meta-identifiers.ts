/**
 * Meta's own click and browser identifiers, handed back to the system that minted
 * them.
 *
 * WHY THIS EXISTS. Our server-side conversion payload carried only user agent and
 * IP address. Meta accepts that — a probe against the live pixel returned
 * `events_received: 1` — but its own error text for a weaker payload warns that a
 * combination "so broad that it is unlikely to be effective for matching" is
 * rejected outright, and UA plus IP sits barely above that floor. A conversion
 * that arrives but cannot be matched to a person is reported and then ignored by
 * the auction, which is the expensive kind of working.
 *
 * Two identifiers were already sitting on the page unused:
 *
 *   fbc — built from `fbclid`, which Meta appends to every ad click. This is the
 *         strongest match signal available anywhere, because it identifies the
 *         click itself rather than inferring a person from a device.
 *   fbp — the first-party cookie the browser pixel sets. Ties the server event to
 *         the same browser session the pixel already reported.
 *
 * NEITHER IS PERSONAL DATA WE ARE INTRODUCING. Both are Meta's identifiers,
 * created by Meta, read from a page Meta sent the visitor to, and returned to
 * Meta. No email, no phone, no name — the no-PII posture of /get is unchanged,
 * and the deliberate decision not to store IP addresses stands untouched.
 *
 * CAPTURED AT LANDING, NOT AT THE TAP. `fbclid` is on the URL when the visitor
 * arrives, and `fbc` embeds the moment it was first observed. Reading it at tap
 * time would stamp the wrong timestamp and would lose the value entirely if
 * anything ever rewrites the query string. Landing is also the only moment we can
 * be sure it is there.
 */

const CLICK_ID_KEY = 'ra.fbclid';

/** Meta's format: fb.<subdomainIndex>.<creationTimeMs>.<fbclid> */
function buildFbc(fbclid: string, createdAtMs: number, subdomainIndex: number): string {
  return `fb.${subdomainIndex}.${createdAtMs}.${fbclid}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=') || null;
  }
  return null;
}

/**
 * The subdomain index Meta expects, taken from `_fbp` when we can.
 *
 * The pixel writes its own index into `_fbp`, so copying it is authoritative and
 * costs nothing — far better than reasoning about how many labels the host has
 * and getting it wrong on a cookie scoped to the registrable domain. Falls back
 * to 1, which is what Meta documents for a plain `example.com`.
 */
function subdomainIndex(): number {
  const fbp = readCookie('_fbp');
  const parsed = fbp?.split('.')[1];
  const n = parsed ? Number.parseInt(parsed, 10) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 1;
}

/**
 * Record `fbclid` on arrival. Safe to call on every page view.
 *
 * Never overwrites an existing value: the first ad click in a session is the one
 * that earned the visit, and a later navigation carrying a fresh fbclid should
 * not reassign credit mid-session.
 */
export function captureMetaClickId(url: URL): void {
  if (typeof window === 'undefined') return;
  const fbclid = url.searchParams.get('fbclid');
  if (!fbclid) return;

  try {
    if (window.sessionStorage.getItem(CLICK_ID_KEY)) return;
    window.sessionStorage.setItem(
      CLICK_ID_KEY,
      JSON.stringify({ id: fbclid.slice(0, 400), at: Date.now() })
    );
  } catch {
    /* storage refused — getFbc falls back to reading the URL directly */
  }
}

/**
 * The `fbc` value for this session, or null.
 *
 * Falls back to the live URL when storage was refused, which is the case in some
 * in-app browsers — and Meta traffic arrives through the Instagram and Facebook
 * in-app browsers, so the fallback is the common path rather than an edge case.
 */
export function getFbc(url?: URL): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(CLICK_ID_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; at?: number };
      if (parsed?.id && parsed?.at) return buildFbc(parsed.id, parsed.at, subdomainIndex());
    }
  } catch {
    /* fall through to the URL */
  }

  const live = url?.searchParams.get('fbclid');
  return live ? buildFbc(live.slice(0, 400), Date.now(), subdomainIndex()) : null;
}

/** The `_fbp` cookie the browser pixel set, verbatim. Null before the pixel runs. */
export function getFbp(): string | null {
  return readCookie('_fbp');
}
