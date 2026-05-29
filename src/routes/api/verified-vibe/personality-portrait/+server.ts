import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { fal } from '@fal-ai/client';

/**
 * Use Claude Vision to check if the person in the image has bald or noticeably
 * thinning hair. Returns true when a hat/cap should be added to the portrait.
 */
async function detectBaldness(imageUrl: string, imageBase64?: string, mimeType?: string): Promise<boolean> {
  try {
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return false;

    const imageContent = imageBase64
      ? { type: 'base64' as const, media_type: (mimeType ?? 'image/jpeg') as any, data: imageBase64 }
      : { type: 'url' as const, url: imageUrl };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 16,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: imageContent },
            {
              type: 'text',
              text: 'Look at the hair on top of this person\'s head. Is the person bald or does their hair appear very thin / noticeably receding on the crown? Answer only "yes" or "no".'
            }
          ]
        }]
      })
    });

    if (!res.ok) return false;
    const data = await res.json() as { content: { text: string }[] };
    const answer = data.content?.[0]?.text?.toLowerCase().trim() ?? '';
    return answer.startsWith('yes');
  } catch {
    return false; // non-critical — never block portrait generation
  }
}

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
    const { referenceImageUrl, referenceImageBase64, mimeType, personalityTraits, sceneOverride } = body as {
      referenceImageUrl?: string;
      referenceImageBase64?: string;
      mimeType?: string;
      personalityTraits: PersonalityTrait[];
      sceneOverride?: string;
    };

    if (!referenceImageUrl && !referenceImageBase64) {
      return json({ error: 'Reference image is required' }, { status: 400 });
    }

    fal.config({ credentials: FAL_KEY });

    // Resolve to an HTTP URL fal.ai can fetch
    let resolvedUrl: string;
    if (referenceImageUrl) {
      resolvedUrl = referenceImageUrl;
    } else {
      const mime = mimeType ?? 'image/jpeg';
      const ext  = mime.split('/')[1] ?? 'jpg';
      const dataUrl = referenceImageBase64!.startsWith('data:')
        ? referenceImageBase64!
        : `data:${mime};base64,${referenceImageBase64}`;
      const b64    = dataUrl.split(',')[1];
      const binary = Buffer.from(b64, 'base64');
      const blob   = new Blob([binary], { type: mime });
      const file   = new File([blob], `reference.${ext}`, { type: mime });
      resolvedUrl  = await fal.storage.upload(file);
    }

    // Detect bald/thinning hair — add a stylish cap to the scene if so
    const isBald = await detectBaldness(
      resolvedUrl,
      referenceImageBase64?.startsWith('data:') ? referenceImageBase64.split(',')[1] : referenceImageBase64,
      mimeType
    );

    let scenePrompt = sceneOverride ?? buildScenePrompt(personalityTraits ?? []);
    if (isBald) {
      // Prepend so the model sees it early in the prompt
      scenePrompt = `wearing a stylish fitted cap, ${scenePrompt}`;
    }

    const result = await fal.run('fal-ai/flux-pulid', {
      input: {
        reference_image_url: resolvedUrl,
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
