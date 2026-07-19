/**
 * Profile content moderation — defends the Discover surfaces against
 * section-overload abuse (the "paste the same paragraph 20×" / character-flood
 * pattern). See the abuse case that motivated this: a user whose `about` blob
 * was 3.8 KB of one repeated paragraph plus runs like "AAAAAAW".
 *
 * Two layers use this:
 *   1. READ paths (discovery-feed, public-profile, match-profile) call
 *      {@link analyzeAbout} on the *effective* about text and act on the verdict:
 *        - 'ok'       → show as-is
 *        - 'truncate' → show `cleaned` (capped + char-runs collapsed)
 *        - 'reject'   → egregious abuse; hide the card (feed) or blank the text (detail)
 *   2. WRITE path (master-profile POST) stores `cleaned` regardless of verdict,
 *      so new abusive blobs can never be persisted in the first place.
 *
 * The thresholds are deliberately loose: validated against the live pool they
 * flag only genuine flooders and leave normal multi-paragraph bios untouched.
 */

/** Hard cap on displayed/stored about length. The mobile/web UI caps input at
 * 500; 600 gives slack for legacy text before we truncate. */
export const ABOUT_MAX_CHARS = 600;

/** Length past which an about is pure flooding regardless of content. */
const ABOUT_FLOOD_CHARS = 4000;

export type AboutVerdict = 'ok' | 'truncate' | 'reject';

export interface AboutAnalysis {
  verdict: AboutVerdict;
  /** Safe-to-store / safe-to-show version. Empty string only when input is empty. */
  cleaned: string;
  /** Human-readable reason (for logging), present when verdict !== 'ok'. */
  reason?: string;
}

/** Collapse runs of 5+ identical letters down to 3 ("AAAAAAW" → "AAAW",
 * "soooooo" → "sooo"). Leaves normal text and punctuation alone. */
function collapseCharRuns(text: string): string {
  return text.replace(/([A-Za-z])\1{4,}/g, (_m, c: string) => c.repeat(3));
}

/** Truncate to the cap on a word boundary with an ellipsis. */
function capLength(text: string): string {
  if (text.length <= ABOUT_MAX_CHARS) return text;
  return text.slice(0, ABOUT_MAX_CHARS).replace(/\s+\S*$/, '').trimEnd() + '…';
}

/**
 * Classify an about string. Pure + cheap — safe to call per-profile in a feed.
 */
export function analyzeAbout(raw: unknown): AboutAnalysis {
  if (typeof raw !== 'string') return { verdict: 'ok', cleaned: '' };
  const text = raw.trim();
  if (!text) return { verdict: 'ok', cleaned: '' };

  const len = text.length;
  const flat = text.replace(/\s+/g, ' ');
  const words = flat.toLowerCase().split(' ').filter(Boolean);
  const uniqueRatio = words.length ? new Set(words).size / words.length : 1;

  // How many times does the opening 60 chars recur? Repeated-paragraph spam
  // re-states its own opening many times.
  const head = flat.toLowerCase().slice(0, 60);
  let headRepeats = 0;
  if (head.length >= 20) {
    const hay = flat.toLowerCase();
    for (let i = hay.indexOf(head); i >= 0; i = hay.indexOf(head, i + 1)) headRepeats++;
  }

  const hasCharRun = /([A-Za-z])\1{4,}/.test(text);

  // Egregious → reject (hide). Any one of:
  //  - absurd length (pure flood)
  //  - long AND highly repetitive (low unique-word ratio)
  //  - opening paragraph repeated 3+ times
  if (
    len > ABOUT_FLOOD_CHARS ||
    (len > ABOUT_MAX_CHARS && uniqueRatio < 0.35) ||
    headRepeats >= 3
  ) {
    return {
      verdict: 'reject',
      cleaned: capLength(collapseCharRuns(text)),
      reason: `egregious about: len=${len} uniqueRatio=${uniqueRatio.toFixed(2)} headRepeats=${headRepeats}`,
    };
  }

  // Mild → truncate/clean but keep visible.
  if (len > ABOUT_MAX_CHARS || hasCharRun) {
    return {
      verdict: 'truncate',
      cleaned: capLength(collapseCharRuns(text)),
      reason: `over-cap about: len=${len} charRun=${hasCharRun}`,
    };
  }

  return { verdict: 'ok', cleaned: text };
}

/**
 * READ-path helper for DETAIL views (public-profile, match-profile): returns the
 * about text to display. Egregious abuse is blanked (null) so the profile still
 * loads but the abusive blob never renders.
 */
export function sanitizeAboutForDetail(raw: unknown): string | null {
  const a = analyzeAbout(raw);
  if (a.verdict === 'reject') return null;
  return a.cleaned || null;
}

// ── Identity field abuse (name / age) ──────────────────────────────────────────
// first_name + age are written client-side straight to verified_vibe_users
// (mobile saveIdentity → direct Supabase update), so there is NO server write
// endpoint to cap them — the read-gate is the only reliable defense. A garbage
// name like "@(+#-$+#1331" or an absurd age like 204637343 marks a bad-faith /
// test account; we hide the whole profile rather than try to salvage it.

/** True when a display name is clearly not a name (symbol/digit soup, overlong). */
export function isAbusiveName(raw: unknown): boolean {
  if (typeof raw !== 'string') return false; // null/missing → fallback handles it
  const name = raw.trim();
  if (!name) return false;
  if (name.length > 40) return true;
  const compact = name.replace(/\s/g, '');
  if (!compact) return true;
  const letters = (compact.match(/\p{L}/gu) || []).length;
  // Real names are overwhelmingly letters (allow a few hyphens/apostrophes/dots);
  // require ≥2 letters and a strong majority letters.
  if (letters < 2) return true;
  if (letters / compact.length < 0.6) return true;
  return false;
}

/** True when an age is present but outside any plausible human range. */
export function isAbusiveAge(raw: unknown): boolean {
  if (raw == null) return false; // missing age is not abuse (feed defaults it)
  const age = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(age)) return false;
  return age < 18 || age > 120;
}

/** Count of unicode letters in a string (handles non-Latin scripts). */
function letterCount(s: string): number {
  return (s.match(/\p{L}/gu) || []).length;
}

/** True when a city is symbol/digit soup or absurdly long. More lenient than
 * names — cities legitimately carry commas/periods ("Kolkata, India"). */
export function isAbusiveCity(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const city = raw.trim();
  if (!city) return false; // empty/missing is not abuse
  if (city.length > 60) return true;
  const compact = city.replace(/\s/g, '');
  if (!compact) return true;
  if (letterCount(compact) / compact.length < 0.5) return true;
  return false;
}

/**
 * Clean a list of display chips (vibe words, archetype chips, lifestyle tags):
 * trim, cap each item's length, drop empties / symbol-soup / duplicates, and cap
 * the total count. Defends the detail view against section-overload via arrays.
 */
export function cleanChipList(arr: unknown, maxItems = 12, maxLen = 50): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    let s = item.trim();
    if (!s) continue;
    if (s.length > maxLen) s = s.slice(0, maxLen);
    const compact = s.replace(/\s/g, '');
    if (compact && letterCount(compact) / compact.length < 0.5) continue; // junk chip
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Single decision for whether a profile should be hidden from Discover entirely,
 * across every abuse vector we gate. Extend here as new fields get abused.
 */
const DEFAULT_PLACEHOLDER_NAMES = ['new member', 'user', 'new user'];

export function profileHideReason(p: {
  firstName?: unknown;
  age?: unknown;
  city?: unknown;
  about?: unknown;
}): string | null {
  if (isAbusiveName(p.firstName)) return 'abusive name';
  if (typeof p.firstName === 'string' && DEFAULT_PLACEHOLDER_NAMES.includes(p.firstName.toLowerCase().trim())) return 'default name not updated';
  if (isAbusiveAge(p.age)) return 'invalid age';
  if (isAbusiveCity(p.city)) return 'abusive city';
  if (analyzeAbout(p.about).verdict === 'reject') return 'abusive about';
  return null;
}
