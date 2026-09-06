import { createClient } from '@supabase/supabase-js';
import { generateProfilePhotos } from '../src/lib/photo-enhance';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

async function fetchRefsFor(name: string) {
  const { data: user } = await db
    .from('verified_vibe_users')
    .select('id, archetype')
    .eq('first_name', name)
    .eq('gender', 'man')
    .maybeSingle();
  if (!user) throw new Error(`no user named ${name}`);
  const { data: master } = await db
    .from('user_master_profile' as any)
    .select('data')
    .eq('user_id', (user as any).id)
    .maybeSingle();
  const photos = ((master as any)?.data?.photos ?? []) as { dataUrl: string; label: string }[];
  return { userId: (user as any).id, archetype: (user as any).archetype, photos };
}

(async () => {
  const target = process.argv[2] ?? 'Ansh';
  const { userId, archetype, photos } = await fetchRefsFor(target);
  console.log(`user=${target} id=${userId} archetype=${archetype} storedPhotos=${photos.length}`);
  if (photos.length === 0) {
    console.log('no stored photos to reproduce with — bailing');
    return;
  }

  // These are already-hosted public URLs, not data URLs — fetch and re-encode
  // as data URLs so generateProfilePhotos accepts them (it expects data: refs).
  const refs: string[] = [];
  for (const p of photos.slice(0, 2)) {
    const res = await fetch(p.dataUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    refs.push(`data:${mime};base64,${buf.toString('base64')}`);
  }

  console.log(`Calling generateProfilePhotos with ${refs.length} refs, keys present: gemini=${!!process.env.GEMINI_API_KEY} fal=${!!process.env.FAL_KEY}`);

  const result = await generateProfilePhotos(
    { referenceDataUrl: refs[0], referenceDataUrls: refs, archetype: archetype ?? 'casual_man', count: 3 },
    { geminiKey: process.env.GEMINI_API_KEY, falKey: process.env.FAL_KEY }
  );

  console.log(`photos generated: ${result.photos.length}`);
  console.log('errors:', JSON.stringify(result.errors, null, 2));
})().catch((e) => {
  console.error('SCRIPT FAILED:', e);
});
