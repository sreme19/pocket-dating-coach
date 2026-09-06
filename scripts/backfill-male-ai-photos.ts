import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { generateProfilePhotos, type PhotoEnhanceResult } from '../src/lib/photo-enhance';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key) as any;

async function hostDataUrls(photos: PhotoEnhanceResult[]): Promise<PhotoEnhanceResult[]> {
  return Promise.all(photos.map(async (p) => {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(p.url);
    if (!m) return p;
    try {
      const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
      const buf = Buffer.from(m[2], 'base64');
      const path = `ai-photos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await db.storage.from('profiles').upload(path, buf, { contentType: m[1], upsert: true });
      if (upErr) throw upErr;
      const { data } = db.storage.from('profiles').getPublicUrl(path);
      return { ...p, url: data.publicUrl };
    } catch (e) {
      console.error('  failed to host generated image:', e);
      return p;
    }
  }));
}

(async () => {
  const { data: men, error } = await db
    .from('verified_vibe_users')
    .select('id, first_name, archetype')
    .eq('gender', 'man')
    .is('avatar_url', null)
    .not('archetype', 'is', null)
    .order('created_at', { ascending: true });
  if (error) { console.error('ERR', error.message); return; }

  console.log(`Found ${men?.length} men with null avatar_url + an archetype (candidates for backfill)\n`);

  for (const m of men ?? []) {
    const { data: master } = await db.from('user_master_profile').select('data').eq('user_id', m.id).maybeSingle();
    const masterData = master?.data ?? {};
    const photos: { dataUrl: string; label: string }[] = Array.isArray(masterData.photos) ? masterData.photos : [];

    if (photos.length === 0) {
      console.log(`SKIP ${m.first_name ?? m.id} — no stored reference photos`);
      continue;
    }

    console.log(`Processing ${m.first_name ?? m.id} (${m.id}, ${m.archetype}) — ${photos.length} refs`);

    const refs: string[] = [];
    for (const p of photos.slice(0, 3)) {
      try {
        const res = await fetch(p.dataUrl);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') ?? 'image/jpeg';
        refs.push(`data:${mime};base64,${buf.toString('base64')}`);
      } catch {
        // skip
      }
    }

    if (refs.length === 0) {
      console.log(`  SKIP — could not download any reference photo`);
      continue;
    }

    const result = await generateProfilePhotos(
      { referenceDataUrl: refs[0], referenceDataUrls: refs, archetype: m.archetype ?? 'casual_man', count: 3 },
      { geminiKey: process.env.GEMINI_API_KEY, falKey: process.env.FAL_KEY }
    );

    if (result.photos.length === 0) {
      console.log(`  FAILED — errors:`, JSON.stringify(result.errors));
      continue;
    }

    const hosted = await hostDataUrls(result.photos);
    const aiPhotos = hosted.map((p) => ({ url: p.url, role: p.role, scene: p.scene }));
    const leadPhoto = aiPhotos.find((p) => p.role === 'lead') ?? aiPhotos[0];

    await db.from('user_master_profile').upsert(
      { user_id: m.id, data: { ...masterData, aiPhotos, personalityPortraitUrl: leadPhoto.url } },
      { onConflict: 'user_id' }
    );
    await db.from('verified_vibe_users').update({ avatar_url: leadPhoto.url }).eq('id', m.id);

    console.log(`  OK — ${aiPhotos.length} photos generated, avatar_url set`);
  }

  console.log('\nDone.');
})();
