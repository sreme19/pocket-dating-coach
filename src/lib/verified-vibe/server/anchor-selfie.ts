/**
 * Anchor selfie — the user's verified reference face.
 *
 * Stored once during identity verification (onboarding liveness step, or the
 * ID-gate face-match in proof uploads) and reused wherever a later upload must
 * be confirmed to show the same person: government-ID matching and the
 * face-gated proof categories (lifestyle / discipline / social_proof).
 */

import { getSupabase } from '$lib/server/supabase';

const ANCHOR_BUCKET = 'profiles';

export const anchorSelfiePath = (userId: string) => `identity/${userId}/anchor_selfie.jpg`;

/** Upload the verified selfie to Storage as the anchor face. Returns the path or null. */
export async function storeAnchorSelfie(userId: string, base64: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const path = anchorSelfiePath(userId);
    const buffer = Buffer.from(base64, 'base64');
    const { error } = await supabase.storage
      .from(ANCHOR_BUCKET)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) { console.warn('anchor selfie upload failed (non-fatal):', error); return null; }
    return path;
  } catch (e) { console.warn('anchor selfie upload error (non-fatal):', e); return null; }
}

/** Download the stored anchor selfie as base64, or null if none exists. */
export async function loadAnchorSelfie(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(ANCHOR_BUCKET).download(anchorSelfiePath(userId));
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return buf.toString('base64');
  } catch { return null; }
}
