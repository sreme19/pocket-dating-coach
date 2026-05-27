import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const make  = (url.searchParams.get('make')  ?? '').trim();
  const model = (url.searchParams.get('model') ?? '').trim();

  if (!make || !model) return json({ imageUrl: null });

  const UA = 'PocketDatingCoach/1.0 (contact@pocketdatingcoach.com)';

  // Try Wikipedia summary with a few title variations
  const titleCandidates = [
    `${make}_${model}`,
    `${make}_${model.replace(/\s+EV$/i, '')}`,
    `${make}_${model.split(' ')[0]}`,
  ];

  for (const slug of titleCandidates) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
        { headers: { 'User-Agent': UA } }
      );
      if (res.ok) {
        const data = await res.json() as { thumbnail?: { source: string } };
        if (data.thumbnail?.source) {
          const bigger = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
          return json({ imageUrl: bigger });
        }
      }
    } catch { /* try next */ }
  }

  // Try Wikimedia Commons file search
  try {
    const q = encodeURIComponent(`${make} ${model}`);
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&srlimit=8&format=json&origin=*`,
      { headers: { 'User-Agent': UA } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json() as {
        query?: { search?: Array<{ title: string }> };
      };
      const hits = searchData.query?.search ?? [];
      for (const hit of hits) {
        try {
          const infoRes = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`,
            { headers: { 'User-Agent': UA } }
          );
          if (!infoRes.ok) continue;
          const infoData = await infoRes.json() as {
            query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
          };
          const pages = Object.values(infoData.query?.pages ?? {});
          for (const page of pages) {
            const imgUrl = page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url;
            if (imgUrl) return json({ imageUrl: imgUrl });
          }
        } catch { /* try next hit */ }
      }
    }
  } catch { /* Commons unavailable */ }

  return json({ imageUrl: null });
};
