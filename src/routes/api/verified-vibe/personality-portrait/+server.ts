import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { fal } from '@fal-ai/client';

interface PersonalityTrait {
  name: string;
  level: string;
  percentage: number;
}

function buildScenePrompt(traits: PersonalityTrait[]): string {
  const byName = Object.fromEntries(traits.map(t => [t.name.toLowerCase(), t.percentage]));

  const parts: string[] = ['cinematic portrait of a man'];

  const decisiveness = byName['decisiveness'] ?? 0;
  const warmth = byName['warmth'] ?? 0;
  const openness = byName['openness'] ?? 0;
  const stability = byName['stability'] ?? 0;

  if (decisiveness >= 85)  parts.push('commanding confident gaze, decisive posture');
  else if (decisiveness >= 65) parts.push('calm confident expression');

  if (warmth >= 75)  parts.push('warm approachable smile, inviting energy');
  else if (warmth >= 55) parts.push('friendly expression');

  if (openness >= 70) parts.push('thoughtful intellectual curiosity in expression');

  if (stability >= 75) parts.push('grounded assured presence');

  // Scene: upscale but relaxed
  parts.push('sophisticated urban setting, soft natural side lighting, shallow depth of field, photorealistic, 85mm portrait lens, high-end magazine photography');

  return parts.join(', ');
}

export const POST: RequestHandler = async ({ request }) => {
  const FAL_KEY = env.FAL_KEY;
  if (!FAL_KEY) {
    return json({ error: 'Portrait generation not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { referenceImageUrl, personalityTraits } = body as {
      referenceImageUrl: string;
      personalityTraits: PersonalityTrait[];
    };

    if (!referenceImageUrl) {
      return json({ error: 'Reference image URL is required' }, { status: 400 });
    }

    fal.config({ credentials: FAL_KEY });

    const scenePrompt = buildScenePrompt(personalityTraits ?? []);

    const result = await fal.run('fal-ai/flux-pulid', {
      input: {
        reference_image_url: referenceImageUrl,
        prompt: `photorealistic portrait, ${scenePrompt}, professional photography, high quality, sharp focus`,
        negative_prompt: 'blurry, low quality, distorted face, ugly, bad anatomy, watermark, text, logo, cartoon, illustration',
        num_inference_steps: 28,
        guidance_scale: 4,
        true_cfg: 1,
        id_weight: 1.0,
        num_images: 1,
      } as any,
    }) as { data: { images: { url: string }[] } };

    const imageUrl = result.data.images[0]?.url;
    if (!imageUrl) return json({ error: 'No image returned' }, { status: 500 });

    return json({ imageUrl });
  } catch (err) {
    console.error('personality-portrait error:', err);
    return json({ error: 'Failed to generate portrait' }, { status: 500 });
  }
};
