import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { fal } from '@fal-ai/client';

const INTERIOR_KEYWORDS = ['interior', 'dashboard', 'cockpit', 'cabin', 'seat', 'steering', 'instrument', 'inside'];

function isInterior(text: string): boolean {
  const lower = text.toLowerCase();
  return INTERIOR_KEYWORDS.some(kw => lower.includes(kw));
}

export const GET: RequestHandler = async ({ url }) => {
  const make  = (url.searchParams.get('make')  ?? '').trim();
  const model = (url.searchParams.get('model') ?? '').trim();

  if (!make || !model) return json({ imageUrl: null });

  const UA = 'PocketDatingCoach/1.0';

  // 1. Wikipedia summary — main article image is usually an exterior shot
  const slugCandidates = [
    `${make}_${model}`,
    `${make}_${model.replace(/\s+EV$/i, '')}`,
    `${make}_${model.split(' ')[0]}`,
  ];

  for (const slug of slugCandidates) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
        { headers: { 'User-Agent': UA } }
      );
      if (res.ok) {
        const data = await res.json() as { thumbnail?: { source: string } };
        const src = data.thumbnail?.source;
        if (src && !isInterior(src)) {
          return json({ imageUrl: src.replace(/\/\d+px-/, '/800px-') });
        }
      }
    } catch { /* try next */ }
  }

  // 2. Wikimedia Commons — search for exterior images, filter out interiors
  const searchTerms = [
    `${make} ${model} exterior`,
    `${make} ${model} front`,
    `${make} ${model}`,
  ];

  for (const q of searchTerms) {
    try {
      const searchRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=6&srlimit=10&format=json&origin=*`,
        { headers: { 'User-Agent': UA } }
      );
      if (!searchRes.ok) continue;
      const sd = await searchRes.json() as { query?: { search?: Array<{ title: string }> } };
      const hits = (sd.query?.search ?? []).filter(h => !isInterior(h.title));

      for (const hit of hits.slice(0, 5)) {
        try {
          const infoRes = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`,
            { headers: { 'User-Agent': UA } }
          );
          if (!infoRes.ok) continue;
          const id = await infoRes.json() as {
            query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
          };
          for (const page of Object.values(id.query?.pages ?? {})) {
            const imgUrl = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url;
            if (imgUrl && !isInterior(imgUrl)) return json({ imageUrl: imgUrl });
          }
        } catch { /* try next hit */ }
      }
    } catch { /* try next search term */ }
  }

  // 3. Fall back to AI-generated 3D render via fal.ai FLUX
  const FAL_KEY = env.FAL_KEY;
  if (FAL_KEY) {
    try {
      fal.config({ credentials: FAL_KEY });
      const result = await fal.run('fal-ai/flux/dev', {
        input: {
          prompt: `photorealistic 3D render of a ${make} ${model} car, exterior view, front three-quarter angle, dramatic studio lighting, dark luxury showroom background, automotive advertisement photography, ultra realistic, high detail, premium quality, cinematic`,
          negative_prompt: 'interior, dashboard, steering wheel, seats, people, text, watermark, blurry, low quality, cartoon',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          image_size: 'landscape_4_3',
        } as any,
      }) as { data: { images: Array<{ url: string }> } };

      const imageUrl = result.data.images[0]?.url;
      if (imageUrl) return json({ imageUrl, generated: true });
    } catch (err) {
      console.error('Car image AI generation failed:', err);
    }
  }

  return json({ imageUrl: null });
};
