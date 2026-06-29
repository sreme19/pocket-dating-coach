/**
 * Public photo set for the Public Read.
 *
 * Single source of truth for the brand-premise photo rules (MVP spec
 * "Profile Owner Pictures" + "Layout in the Public Read"):
 *
 *  - Men are shown ONLY their AI-enhanced portraits (cap 3). A man's raw,
 *    un-enhanced upload is NEVER surfaced to anyone — not even as an avatar
 *    fallback — so until his AI portraits exist he has no public photo.
 *  - Women are shown their real photos (cap 6); none are AI-enhanced.
 *  - The hero is auto-selected by the app, not the owner: the photo tagged
 *    `lead` is the designated hero ("most flattering"); otherwise the first
 *    photo in the set. The hero is element [0] of the returned list.
 *  - Every photo carries an `ai` flag so viewers can be shown a clear
 *    "generated from verified photos" label on AI imagery.
 *
 * Both the authenticated match-profile API and the public-profile API build
 * their photo array from this helper so web + Flutter render an identical set.
 */

export interface PublicPhoto {
  url: string;
  /** true = AI-enhanced portrait (men); false = real uploaded photo (women). */
  ai: boolean;
  /** Slot role/label, e.g. 'lead' | 'warmth' | 'lifestyle' | 'extra-1'. */
  role: string;
}

const MAX_MEN = 3;
const MAX_WOMEN = 6;
const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);

/**
 * Build the gender-aware, hero-first, capped photo set a viewer should see.
 * `masterData` is the `user_master_profile.data` blob; photos live under
 * `aiPhotos` (`{ url, role }`) and `photos` (`{ dataUrl, label }`).
 */
export function buildPublicPhotos(
  masterData: Record<string, unknown>,
  gender: string | null | undefined
): PublicPhoto[] {
  const isMan = gender === 'man';
  const aiPhotos = Array.isArray(masterData.aiPhotos) ? masterData.aiPhotos : [];
  const rawPhotos = Array.isArray(masterData.photos) ? masterData.photos : [];

  const out: PublicPhoto[] = [];

  // AI-enhanced portraits first (the only thing men ever show).
  for (const p of aiPhotos as Array<Record<string, unknown>>) {
    if (p && isHttp(p.url)) out.push({ url: p.url, ai: true, role: String(p.role ?? '') });
  }

  // Women add their real uploads. Men's raw uploads are edit-only — never shown.
  if (!isMan) {
    for (const p of rawPhotos as Array<Record<string, unknown>>) {
      if (p && isHttp(p.dataUrl)) out.push({ url: p.dataUrl, ai: false, role: String(p.label ?? '') });
    }
  }

  // App-selected hero: float the `lead`-tagged photo to the front.
  const heroIdx = out.findIndex((p) => p.role === 'lead');
  if (heroIdx > 0) {
    const [hero] = out.splice(heroIdx, 1);
    out.unshift(hero);
  }

  return out.slice(0, isMan ? MAX_MEN : MAX_WOMEN);
}

/**
 * Pick the public hero URL from a built photo set, honouring the "never surface
 * a man's raw photo" rule: a man falls back to no photo (not avatar_url, which
 * may still hold his raw upload), while a woman may fall back to her avatar.
 */
export function pickHeroUrl(
  photos: PublicPhoto[],
  gender: string | null | undefined,
  avatarUrl: string | null | undefined
): string | null {
  if (photos.length > 0) return photos[0].url;
  if (gender !== 'man' && isHttp(avatarUrl)) return avatarUrl;
  return null;
}
