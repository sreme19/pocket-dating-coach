/**
 * Backfill AI profile portraits for men who uploaded reference photos before the
 * server-side auto-generation trigger existed (so they have raw photos but no
 * `user_master_profile.data.aiPhotos`). Their raw selfie must never be shown, so
 * every such man needs generated portraits.
 *
 * Reuses the shipped, provider-backed `/api/photo-enhance/generate` endpoint for
 * generation, then persists results (aiPhotos + personalityPortraitUrl) and flips
 * the avatar to the AI lead — the same writes verify-step now does inline.
 *
 * Usage:
 *   # dry run — list who would be backfilled, generate nothing:
 *   set -a; source .env.local; set +a; npx tsx scripts/backfill-ai-photos.ts
 *
 *   # execute against a running origin (prod by default):
 *   set -a; source .env.local; set +a; \
 *     npx tsx scripts/backfill-ai-photos.ts --apply --origin=https://pocket-dating-coach.vercel.app
 *
 *   # single user:
 *   ... npx tsx scripts/backfill-ai-photos.ts --apply --user=<uuid>
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ORIGIN = (args.find((a) => a.startsWith('--origin='))?.split('=')[1]) ?? 'https://pocket-dating-coach.vercel.app';
const ONLY_USER = args.find((a) => a.startsWith('--user='))?.split('=')[1] ?? null;

async function toDataUrl(photoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

(async () => {
  // Men with a master profile
  let q = db
    .from('verified_vibe_users')
    .select('id, first_name, archetype, avatar_url')
    .eq('gender', 'man');
  if (ONLY_USER) q = q.eq('id', ONLY_USER);
  const { data: men, error } = await q;
  if (error) throw error;

  const targets: Array<{ id: string; name: string; archetype: string; photos: any[] }> = [];
  for (const m of men ?? []) {
    const { data: master } = await db
      .from('user_master_profile' as any)
      .select('data')
      .eq('user_id', (m as any).id)
      .maybeSingle();
    const d = (master as any)?.data ?? {};
    const hasAi = Array.isArray(d.aiPhotos) && d.aiPhotos.length > 0;
    const photos = Array.isArray(d.photos) ? d.photos : [];
    if (!hasAi && photos.length > 0) {
      targets.push({ id: (m as any).id, name: (m as any).first_name, archetype: (m as any).archetype ?? 'casual_man', photos });
    }
  }

  console.log(`Found ${targets.length} man/men with reference photos but no AI portraits:`);
  for (const t of targets) console.log(`  - ${t.id}  ${t.name}  (${t.photos.length} ref photos)`);

  if (!APPLY) {
    console.log('\nDRY RUN — pass --apply to generate + persist. Nothing was changed.');
    return;
  }

  for (const t of targets) {
    console.log(`\n=== ${t.id} (${t.name}) ===`);
    const refs: string[] = [];
    for (const p of t.photos.slice(0, 3)) {
      const purl = p?.dataUrl ?? p?.url;
      if (!purl) continue;
      const du = await toDataUrl(purl);
      if (du) refs.push(du);
    }
    if (refs.length === 0) { console.log('  ! no downloadable reference photos, skipping'); continue; }

    const res = await fetch(`${ORIGIN}/api/photo-enhance/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ referenceDataUrl: refs[0], referenceDataUrls: refs, archetype: t.archetype, count: 3 }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      console.log(`  ! generation failed (${res.status}):`, (b as any)?.message ?? (b as any)?.error);
      continue;
    }
    const out = await res.json() as { photos?: { url: string; role: string; scene: string }[] };
    const aiPhotos = (out.photos ?? []).map((p) => ({ url: p.url, role: p.role, scene: p.scene }));
    if (aiPhotos.length === 0) { console.log('  ! generation returned no photos, skipping'); continue; }
    const lead = aiPhotos.find((p) => p.role === 'lead') ?? aiPhotos[0];

    const { data: master } = await db.from('user_master_profile' as any).select('data').eq('user_id', t.id).maybeSingle();
    const prev = (master as any)?.data ?? {};
    await db.from('user_master_profile' as any).upsert(
      { user_id: t.id, data: { ...prev, aiPhotos, personalityPortraitUrl: lead.url }, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    await db.from('verified_vibe_users').update({ avatar_url: lead.url }).eq('id', t.id);
    console.log(`  ✓ generated ${aiPhotos.length} portraits; avatar → AI lead`);
  }
  console.log('\nDone.');
})();
