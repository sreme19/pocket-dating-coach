import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { generateProfilePhotos } from '$lib/photo-enhance';

// Allow up to 90s — parallel fal.ai generations take ~25-35s
export const config = {
  maxDuration: 90
};

export const POST: RequestHandler = async ({ request }) => {
  if (!env.FAL_KEY) {
    throw error(500, 'Photo enhancement is not available at this time.');
  }

  const { referenceDataUrl, archetype, count } = await request.json();

  if (!referenceDataUrl) {
    throw error(400, 'referenceDataUrl is required');
  }

  if (!referenceDataUrl.startsWith('data:image/')) {
    throw error(400, 'referenceDataUrl must be a base64 image data URL');
  }

  const result = await generateProfilePhotos(
    {
      referenceDataUrl,
      archetype: archetype ?? 'casual_man',
      count: Math.min(count ?? 5, 5)
    },
    env.FAL_KEY
  );

  return json(result);
};
