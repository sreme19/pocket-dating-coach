/**
 * photo-enhance — standalone face-consistent AI photo generation module
 *
 * Uses fal.ai FLUX PuLID to take reference photo(s) of a person and
 * generate new, flattering images of them in different scenes.
 *
 * Designed to be framework-agnostic and reusable across projects.
 */

import { fal } from '@fal-ai/client';
import { getScenesForArchetype } from './scenes';
import { generateSceneWithGemini, type GeminiPromptOpts } from './gemini';
import { analyzeReferences, scoreCandidate } from './vision';
import type {
  PhotoEnhanceInput,
  PhotoEnhanceResult,
  RejectedPhoto,
  GenerateProfilePhotosInput,
  GenerateProfilePhotosResult,
  PhotoRole
} from './types';

export type { PhotoEnhanceInput, PhotoEnhanceResult, RejectedPhoto, GenerateProfilePhotosInput, GenerateProfilePhotosResult, PhotoRole };
export { getScenesForArchetype } from './scenes';
export { generateSceneWithGemini, buildGeminiPrompt } from './gemini';

const FAL_MODEL = 'fal-ai/flux-pulid';

/**
 * Convert a base64 data URL to a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a reference photo to fal.ai storage and return its CDN URL.
 * This is required because FLUX PuLID expects an HTTP URL, not a data URL.
 */
async function uploadReferencePhoto(dataUrl: string, apiKey: string): Promise<string> {
  fal.config({ credentials: apiKey });
  const blob = dataUrlToBlob(dataUrl);
  const file = new File([blob], 'reference.jpg', { type: blob.type });
  const uploadedUrl = await fal.storage.upload(file);
  return uploadedUrl;
}

/**
 * Generate a single AI-enhanced photo of a person in a given scene.
 * Includes retry logic for robustness.
 *
 * @param input.referenceDataUrl — base64 data URL of the reference photo
 * @param input.scenePrompt      — description of the scene/setting to place the person in
 * @param apiKey                 — fal.ai API key
 * @param retries                — number of retries on failure (default 1)
 */
export async function generateEnhancedPhoto(
  input: PhotoEnhanceInput,
  apiKey: string,
  retries: number = 1
): Promise<string> {
  fal.config({ credentials: apiKey });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const referenceUrl = await uploadReferencePhoto(input.referenceDataUrl, apiKey);

      const result = await fal.run(FAL_MODEL, {
        input: {
          reference_image_url: referenceUrl,
          prompt: `photorealistic portrait, ${input.scenePrompt}, professional photography, high quality, sharp focus`,
          negative_prompt: [
            input.negativePrompt ?? 'blurry, low quality, distorted face, ugly, bad anatomy, watermark',
            input.negativePromptExtra ?? '',
          ].filter(Boolean).join(', '),
          num_inference_steps: 20,
          guidance_scale: 4,
          true_cfg: 1,
          id_weight: input.idWeight ?? 1.0,
          num_images: 1
        } as any
      }) as { data: { images: { url: string }[] } };

      return result.data.images[0].url;
    } catch (err) {
      const errMsg = err && typeof err === 'object' && 'body' in err
        ? JSON.stringify((err as any).body)
        : (err instanceof Error ? err.message : String(err));
      lastError = new Error(errMsg);
      if (attempt < retries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to generate photo');
}

/**
 * Generate a full set of profile photos for a user.
 *
 * Primary engine: **Gemini 2.5 Flash Image** with multi-reference + edit-framing
 * (the bake-off winner — realistic, identity-preserving, ~$0.04/img, no training).
 * **Fallback per scene: fal.ai FLUX-PuLID** if Gemini errors / is unconfigured.
 *
 * Phase-2 guardrails (Gemini only): one upfront vision read auto-SELECTS the usable
 * reference photos, reads the man's appearance, and derives styling-by-feature
 * (hat for bald, blazer for heavier) + an older/grey guard. Each scene then generates
 * N candidates and the best (identity + flattering, no artifacts) is picked.
 *
 * Gemini results are base64 data URLs (the caller hosts them durably); fal results
 * are fal-CDN URLs. Scenes (and candidates within a scene) run in parallel.
 *
 * @param keys.geminiKey — GEMINI_API_KEY (primary). @param keys.falKey — FAL_KEY (fallback).
 */
export async function generateProfilePhotos(
  input: GenerateProfilePhotosInput,
  keys: { geminiKey?: string; falKey?: string }
): Promise<GenerateProfilePhotosResult> {
  const scenes = getScenesForArchetype(input.archetype, input.count ?? 3);
  const allRefs = input.referenceDataUrls?.length ? input.referenceDataUrls : [input.referenceDataUrl];
  const N = Math.max(1, Math.min(input.candidatesPerScene ?? 2, 4)); // candidates per scene

  // Build a negative-prompt suffix (fal only) from rejected photos so we avoid
  // repeating looks, settings, or styles the user already dismissed.
  const rejected: RejectedPhoto[] = input.rejectedPhotos ?? [];
  const negativePromptExtra = rejected.length > 0
    ? `avoid repeating these rejected styles: ${rejected.map(r => r.scene).join(', ')}`
    : '';

  // Phase-2 upfront vision read (Gemini): reference selection + appearance + styling.
  let refs = allRefs;
  let promptOpts: GeminiPromptOpts = {};
  if (keys.geminiKey) {
    try {
      const a = await analyzeReferences(allRefs, keys.geminiKey);
      if (a.usableRefs.length) refs = a.usableRefs;
      promptOpts = a.opts;
    } catch (err) {
      console.warn('[photo-enhance] analyzeReferences failed, using all refs:', err instanceof Error ? err.message : err);
    }
  }

  const results = await Promise.allSettled(
    scenes.map(async (scene): Promise<PhotoEnhanceResult> => {
      // 1) Gemini edit-framing (primary) — generate N candidates, pick the best
      if (keys.geminiKey) {
        try {
          const settled = await Promise.allSettled(
            Array.from({ length: N }, () => generateSceneWithGemini(refs, scene.prompt, keys.geminiKey!, promptOpts, 1))
          );
          const candidates = settled.filter((s) => s.status === 'fulfilled').map((s) => (s as PromiseFulfilledResult<string>).value);
          if (candidates.length === 1) {
            return { url: candidates[0], scene: scene.label, role: scene.role };
          }
          if (candidates.length > 1) {
            const scores = await Promise.all(candidates.map((c) => scoreCandidate(refs, c, keys.geminiKey!).catch(() => null)));
            let best = candidates[0], bestScore = -Infinity;
            candidates.forEach((c, i) => { const s = scores[i]?.score ?? 0; if (s > bestScore) { bestScore = s; best = c; } });
            return { url: best, scene: scene.label, role: scene.role };
          }
        } catch (err) {
          console.warn(`[photo-enhance] Gemini failed for ${scene.role}, falling back to fal:`,
            err instanceof Error ? err.message : err);
        }
      }
      // 2) fal.ai FLUX-PuLID (fallback)
      if (keys.falKey) {
        const url = await generateEnhancedPhoto(
          { referenceDataUrl: input.referenceDataUrl, scenePrompt: scene.prompt, negativePromptExtra: negativePromptExtra || undefined },
          keys.falKey,
          1
        );
        return { url, scene: scene.label, role: scene.role };
      }
      throw new Error('no photo provider configured (need GEMINI_API_KEY or FAL_KEY)');
    })
  );

  const photos: PhotoEnhanceResult[] = [];
  const errors: { role: PhotoRole; error: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      photos.push(result.value);
    } else {
      errors.push({
        role: scenes[i].role,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });

  return { photos, errors };
}
