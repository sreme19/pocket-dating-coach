import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

(async () => {
  const { data: dupes } = await db
    .from('verified_vibe_users')
    .select('id, first_name, gender, created_at')
    .eq('first_name', 'Ansh');
  console.log('all rows named Ansh:', JSON.stringify(dupes, null, 2));

  const knownId = '6e3fb321-4ee1-42a0-8d5d-819f4234ec8a';
  for (let i = 0; i < 3; i++) {
    const { data: pool, error } = await db.from('vv_pool_profiles').select('*').eq('user_id', knownId).maybeSingle();
    console.log(`attempt ${i}: pool=${error ? 'ERR:' + error.message : JSON.stringify(pool)}`);
  }
})();
