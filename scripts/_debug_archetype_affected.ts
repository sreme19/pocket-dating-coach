import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
(async () => {
  const { data } = await db.from('verified_vibe_users')
    .select('id,gender,archetype,is_provisional').is('deleted_at', null).eq('is_seed', false);
  const rows = (data||[]).filter(r => !r.is_provisional);
  const hit = rows.filter(r => r.archetype === 'casual_generous_man' || r.archetype === 'spoiled_casual_woman');
  console.log(`feed-eligible members: ${rows.length}`);
  console.log(`carrying a mismatched archetype: ${hit.length}`);
  const byA: Record<string, number> = {};
  for (const r of hit) byA[r.archetype!] = (byA[r.archetype!]||0)+1;
  console.log(' ', JSON.stringify(byA));
})();
