/**
 * photo-enhance/server — server-only orchestration around the framework-agnostic
 * `generateProfilePhotos` core.
 *
 * Wraps the generation core with the two concerns that need a server context:
 *   1. the Claude face pre-flight (drop faceless refs; refuse if none has a face)
 *   2. durable hosting of Gemini base64 results in Supabase Storage
 *
 * Both the HTTP endpoint (`/api/photo-enhance/generate`) and the onboarding
 * photos step (`verify-step`) call this, so the "a man's raw photo is never
 * shown — only the AI portrait" rule is enforced the same way regardless of
 * which client saved the photos.
 */
import { env } from '$env/dynamic/private';
import { generateProfilePhotos, type PhotoEnhanceResult, type RejectedPhoto } from '$lib/photo-enhance';
import { getSupabase } from '$lib/server/supabase';
import { detectFaceInPhotosWithClaude } from '$lib/verified-vibe/server/verification';

export interface EnhanceAndHostInput {
  /** Reference photos as base64 data URLs (`data:image/...;base64,...`). */
  refs: string[];
  archetype?: string;
  count?: number;
  rejectedPhotos?: RejectedPhoto[];
}

export interface EnhanceAndHostResult {
  photos: { url: string; role: string; scene: string }[];
  errors: unknown[];
  /** No configured provider (GEMINI_API_KEY / FAL_KEY) — nothing real was generated. */
  noProvider?: boolean;
  /** None of the references contained a recognizable face. */
  noFace?: boolean;
}

/**
 * Gemini returns base64 data URLs; host them durably in Supabase Storage and swap
 * in the public URL. fal results are already CDN URLs and pass through untouched.
 */
export async function hostDataUrls(photos: PhotoEnhanceResult[]): Promise<PhotoEnhanceResult[]> {
  const supabase = getSupabase() as any;
  return Promise.all(photos.map(async (p) => {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(p.url);
    if (!m) return p; // already a hosted URL (fal)
    try {
      const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
      const buf = Buffer.from(m[2], 'base64');
      const path = `ai-photos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profiles')
        .upload(path, buf, { contentType: m[1], upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('profiles').getPublicUrl(path);
      return { ...p, url: data.publicUrl };
    } catch (e) {
      console.error('[photo-enhance] failed to host generated image:', e);
      return p; // leave the data URL as a last resort
    }
  }));
}

/**
 * Run the full server-side generation pipeline: face pre-flight → generate → host.
 *
 * Returns `{ noProvider: true }` when neither API key is set (caller decides
 * whether to mock or skip) and `{ noFace: true }` when no reference has a face.
 * Never throws for those two expected outcomes; provider/generation errors do
 * throw so the caller can decide how to surface them.
 */
export async function enhanceAndHostPhotos(input: EnhanceAndHostInput): Promise<EnhanceAndHostResult> {
  const refs = (input.refs ?? []).filter((r) => typeof r === 'string' && r.startsWith('data:image/'));
  if (refs.length === 0) {
    throw new Error('enhanceAndHostPhotos: at least one base64 image data URL is required');
  }

  // No provider configured → let the caller decide (mock in dev, skip in prod).
  if (!env.GEMINI_API_KEY && !env.FAL_KEY) {
    return { photos: [], errors: [], noProvider: true };
  }

  // Face pre-flight: the image models hallucinate a random person from a
  // reference that has no face, so DROP any faceless reference and generate only
  // from the ones that show the user's face. If none has a face, refuse.
  // Fail-open on Claude API errors (a broken face check must not block everything).
  let genRefs = refs;
  try {
    const parsed = refs
      .map((ref) => {
        const m = /^data:([^;]+);base64,(.+)$/.exec(ref);
        return m ? { ref, mime: m[1], data: m[2] } : null;
      })
      .filter((x): x is { ref: string; mime: string; data: string } => x !== null);

    const { faces } = await detectFaceInPhotosWithClaude(parsed.map(({ mime, data }) => ({ mime, data })));
    const withFace = parsed.filter((_, i) => faces[i]).map((p) => p.ref);
    if (withFace.length === 0) {
      return { photos: [], errors: [], noFace: true };
    }
    genRefs = withFace;
  } catch (e) {
    console.warn('[photo-enhance] face pre-flight failed (fail-open):', e);
  }

  const result = await generateProfilePhotos(
    {
      referenceDataUrl: genRefs[0],
      referenceDataUrls: genRefs,
      archetype: input.archetype ?? 'casual_man',
      count: Math.min(input.count ?? 3, 3),
      rejectedPhotos: input.rejectedPhotos ?? [],
    },
    { geminiKey: env.GEMINI_API_KEY, falKey: env.FAL_KEY }
  );

  const hosted = await hostDataUrls(result.photos);
  return {
    photos: hosted.map((p) => ({ url: p.url, role: p.role, scene: p.scene })),
    errors: result.errors ?? [],
  };
}
