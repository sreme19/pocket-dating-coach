import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

(async () => {
  const { data: men, error } = await db
    .from('verified_vibe_users')
    .select('id,first_name,archetype,trust_score,created_at,avatar_url')
    .eq('gender', 'man')
    .gte('created_at', '2026-08-15T00:00:00Z')
    .order('created_at', { ascending: true });
  if (error) { console.log('ERR', error.message); return; }
  console.log(`Men created since 2026-08-15: ${men?.length}\n`);
  for (const m of men ?? []) {
    const { data: master } = await db
      .from('user_master_profile' as any)
      .select('data')
      .eq('user_id', (m as any).id)
      .maybeSingle();
    const d = (master as any)?.data ?? {};
    const hasAi = Array.isArray(d.aiPhotos) && d.aiPhotos.length > 0;
    const hasRaw = Array.isArray(d.photos) && d.photos.length > 0;
    console.log(
      `${(m as any).created_at}  ${(m as any).first_name?.padEnd(12)} archetype=${(m as any).archetype?.padEnd(28)} avatar_url=${(m as any).avatar_url ? 'SET' : 'null'.padEnd(4)} rawPhotos=${hasRaw} aiPhotos=${hasAi}`
    );
  }
})();
