import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

(async () => {
  const { data: runs, error } = await db
    .from('vv_matchmaker_runs')
    .select('*')
    .gte('created_at', '2026-08-15T00:00:00Z')
    .order('created_at', { ascending: true });
  if (error) { console.log('vv_matchmaker_runs ERROR:', error.message); }
  else {
    console.log(`vv_matchmaker_runs since 2026-08-15: ${runs.length}`);
    runs.forEach((r: any) => console.log(JSON.stringify(r)));
  }

  console.log('\n--- pool status for the affected men ---');
  const names = ['Mickey','Anmol Chauhan','Ansh','Raj','Sahas','Rahul','Aquban','Vineeth','Salman','Vrushabh','Munna'];
  const { data: men } = await db
    .from('verified_vibe_users')
    .select('id, first_name, created_at')
    .in('first_name', names)
    .eq('gender', 'man');

  for (const m of men ?? []) {
    const { data: pool } = await db
      .from('vv_pool_profiles')
      .select('availability_status, updated_at')
      .eq('user_id', (m as any).id)
      .maybeSingle();
    const { data: vec } = await db
      .from('vv_user_vectors' as any)
      .select('updated_at')
      .eq('user_id', (m as any).id)
      .maybeSingle();
    console.log(`${(m as any).first_name}: pool=${pool ? JSON.stringify(pool) : 'NO ROW'} vector=${vec ? 'present' : 'MISSING'}`);
  }
})();
