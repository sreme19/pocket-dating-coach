import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

(async () => {
  // sanity: does the pool table even respond, and what columns does it have?
  const { data: anyPoolRow, error: poolErr } = await db.from('vv_pool_profiles').select('*').limit(1);
  console.log('sample pool row / err:', poolErr?.message ?? JSON.stringify(anyPoolRow));

  const { data: anyRunRow, error: runErr } = await db.from('vv_matchmaker_runs').select('*').limit(3);
  console.log('sample run rows / err:', runErr?.message ?? JSON.stringify(anyRunRow));

  console.log('\n--- per-user detail: Ansh ---');
  const { data: ansh } = await db.from('verified_vibe_users').select('id').eq('first_name', 'Ansh').eq('gender','man').maybeSingle();
  console.log('ansh id:', ansh?.id);

  const { data: poolRow, error: poolRowErr } = await db.from('vv_pool_profiles').select('*').eq('user_id', ansh.id);
  console.log('ansh pool rows:', poolRowErr?.message ?? JSON.stringify(poolRow));

  const { data: steps, error: stepsErr } = await db.from('vv_verification_steps' as any).select('*').eq('user_id', ansh.id);
  console.log('ansh verification steps:', stepsErr?.message ?? JSON.stringify(steps));
})();
