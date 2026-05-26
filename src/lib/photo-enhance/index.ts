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
 * Runs all generations in parallel for speed (~25s total vs 25s × N).
 * Includes retry logic for failed photos.
 *
 * @param input.referenceDataUrl — best reference photo of the user
 * @param input.archetype        — user's dating archetype (drives scene selection)
 * @param input.count            — number of photos to generate (default 5)
 * @param apiKey                 — fal.ai API key
 */
export async function generateProfilePhotos(
  input: GenerateProfilePhotosInput,
  apiKey: string
): Promise<GenerateProfilePhotosResult> {
  const scenes = getScenesForArchetype(input.archetype, input.count ?? 3);

  // Build a negative-prompt suffix from rejected photos so Claude avoids
  // repeating looks, settings, or styles the user already dismissed.
  const rejected: RejectedPhoto[] = input.rejectedPhotos ?? [];
  const negativePromptExtra = rejected.length > 0
    ? `avoid repeating these rejected styles: ${rejected.map(r => r.scene).join(', ')}`
    : '';

  const results = await Promise.allSettled(
    scenes.map(async (scene): Promise<PhotoEnhanceResult> => {
      const url = await generateEnhancedPhoto(
        {
          referenceDataUrl: input.referenceDataUrl,
          scenePrompt: scene.prompt,
          negativePromptExtra: negativePromptExtra || undefined,
        },
        apiKey,
        1 // Retry once on failure
      );
      return { url, scene: scene.label, role: scene.role };
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
