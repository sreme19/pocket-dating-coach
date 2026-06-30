import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { generateProfilePhotos, type PhotoEnhanceResult } from '$lib/photo-enhance';
import { getSupabase } from '$lib/server/supabase';

// Gemini returns base64 data URLs; host them durably in Supabase Storage and swap
// in the public URL (fal results are already CDN URLs and pass through untouched).
async function hostDataUrls(photos: PhotoEnhanceResult[]): Promise<PhotoEnhanceResult[]> {
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
  const { referenceDataUrl, referenceDataUrls, archetype, count, rejectedPhotos } = await request.json();

  // Accept either a single reference or a multi-reference array (multi-ref preferred for Gemini).
  const refs: string[] = Array.isArray(referenceDataUrls) && referenceDataUrls.length
    ? referenceDataUrls
    : (referenceDataUrl ? [referenceDataUrl] : []);
  const primaryRef = referenceDataUrl ?? refs[0];

  if (!primaryRef) {
    throw error(400, 'referenceDataUrl or referenceDataUrls is required');
  }
  if (!refs.every((r) => typeof r === 'string' && r.startsWith('data:image/'))) {
    throw error(400, 'references must be base64 image data URLs');
  }

  // No provider configured → mock (dev only)
  if (!env.GEMINI_API_KEY && !env.FAL_KEY) {
    console.warn('No GEMINI_API_KEY or FAL_KEY configured, using mock photo enhancement');
    return json(generateMockPhotos(count ?? 3));
  }

  const result = await generateProfilePhotos(
    {
      referenceDataUrl: primaryRef,
      referenceDataUrls: refs,
      archetype: archetype ?? 'casual_man',
      count: Math.min(count ?? 3, 3),
      rejectedPhotos: rejectedPhotos ?? [],
    },
    { geminiKey: env.GEMINI_API_KEY, falKey: env.FAL_KEY }
  );

  // Host any Gemini base64 results durably (Supabase Storage), keep fal URLs as-is.
  result.photos = await hostDataUrls(result.photos);

  return json(result);
};
