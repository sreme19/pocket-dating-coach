import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { generateProfilePhotos } from '$lib/photo-enhance';

// Allow up to 90s — parallel fal.ai generations take ~25-35s
export const config = {
  maxDuration: 90
};

// Mock photos for development (when FAL_KEY is not available)
function generateMockPhotos(count: number) {
  const roles = ['lead', 'warmth', 'lifestyle'];
  const scenes = ['professional', 'casual', 'outdoor'];
  const colors = [
    ['#FF6B6B', '#FF8E72'],
    ['#4ECDC4', '#44A5A5'],
    ['#95E1D3', '#4ECDC4'],
    ['#F9D56E', '#F7DC6F'],
    ['#BB8FCE', '#9B59B6']
  ];

  const photos = [];
  for (let i = 0; i < Math.min(count, 3); i++) {
    // Create a simple SVG placeholder with gradients
    const [color1, color2] = colors[i];
    const svgData = `<svg width="512" height="640" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="512" height="640" fill="url(#grad${i})"/>
      <circle cx="256" cy="200" r="80" fill="rgba(255,255,255,0.2)"/>
      <text x="256" y="450" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${scenes[i].toUpperCase()}</text>
      <text x="256" y="490" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="middle">(Mock - Dev Mode)</text>
    </svg>`;

    // Convert SVG to base64 data URL
    const base64Svg = Buffer.from(svgData).toString('base64');
    const dataUrl = 'data:image/svg+xml;base64,' + base64Svg;

    photos.push({
      url: dataUrl,
      scene: scenes[i],
      role: roles[i]
    });
  }

  return { photos, errors: [] };
}

export const POST: RequestHandler = async ({ request }) => {
  const { referenceDataUrl, archetype, count, rejectedPhotos } = await request.json();

  if (!referenceDataUrl) {
    throw error(400, 'referenceDataUrl is required');
  }

  if (!referenceDataUrl.startsWith('data:image/')) {
    throw error(400, 'referenceDataUrl must be a base64 image data URL');
  }

  // If FAL_KEY is not available, use mock implementation for development
  if (!env.FAL_KEY) {
    console.warn('FAL_KEY not configured, using mock photo enhancement');
    return json(generateMockPhotos(count ?? 3));
  }

  const result = await generateProfilePhotos(
    {
      referenceDataUrl,
      archetype: archetype ?? 'casual_man',
      count: Math.min(count ?? 3, 3),
      rejectedPhotos: rejectedPhotos ?? [],
    },
    env.FAL_KEY
  );

  return json(result);
};
