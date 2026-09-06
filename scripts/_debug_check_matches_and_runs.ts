import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

(async () => {
  const names = ['Mickey','Anmol Chauhan','Ansh','Raj','Sahas','Rahul','Aquban','Vineeth','Salman','Vrushabh','Munna'];
  const { data: men } = await db
    .from('verified_vibe_users')
    .select('id, first_name')
    .in('first_name', names)
    .eq('gender', 'man');

  console.log('--- matches per user (corrected columns) ---');
  for (const m of men ?? []) {
    const { data: matches } = await db
      .from('verified_vibe_matches')
      .select('id, created_at')
      .or(`user1_id.eq.${m.id},user2_id.eq.${m.id}`);
    console.log(`${m.first_name.padEnd(15)} matches=${matches?.length ?? 0}`);
  }

  console.log('\n--- pool market composition ---');
  const { data: activeMen } = await db.from('vv_pool_profiles').select('user_id, verified_vibe_users!inner(gender)' as any).eq('availability_status', 'active').eq('verified_vibe_users.gender', 'man');
  const { data: activeWomen } = await db.from('vv_pool_profiles').select('user_id, verified_vibe_users!inner(gender)' as any).eq('availability_status', 'active').eq('verified_vibe_users.gender', 'woman');
  console.log(`active men in pool: ${activeMen?.length ?? 'ERR'}, active women in pool: ${activeWomen?.length ?? 'ERR'}`);

  const { count: totalMatches } = await db.from('verified_vibe_matches').select('*', { count: 'exact', head: true });
  console.log(`total matches ever created: ${totalMatches}`);
})();
