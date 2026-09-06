import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
(async () => {
  const { data } = await db.from('verified_vibe_users')
    .select('id,trust_updated_at,is_seed').is('deleted_at', null).eq('is_seed', false);
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour
  const stale = (data||[]).filter(u => !u.trust_updated_at || u.trust_updated_at < cutoff);
  console.log(`real members: ${data?.length}   NOT normalized in the last hour: ${stale.length}`);
})();
(async () => {
  const { data } = await db.from('verified_vibe_users')
    .select('id,first_name,is_provisional,trust_updated_at,trust_score').is('deleted_at', null).eq('is_seed', false);
  const cutoff = new Date(Date.now() - 60*60*1000).toISOString();
  const stale = (data||[]).filter(u => !u.trust_updated_at || u.trust_updated_at < cutoff);
  console.log('stale breakdown — is_provisional true:', stale.filter(u=>u.is_provisional).length,
              ' false/null:', stale.filter(u=>!u.is_provisional).length);
  console.log('sample:', stale.slice(0,6).map(u=>`${u.first_name} prov=${u.is_provisional} score=${u.trust_score}`).join(' | '));
})();
