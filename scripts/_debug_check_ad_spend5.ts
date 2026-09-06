import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
(async () => {
  const names = ['Piyush','Harry','Roshan','Sameer','Mohsin','Ajeet'];
  const { data: users, error } = await db.from('verified_vibe_users' as any)
    .select('id,first_name,created_at')
    .in('first_name', names)
    .gte('created_at', '2026-08-19T00:00:00Z');
  if (error) { console.log('ERR', error.message); return; }
  console.log('users:', users);
  for (const u of (users ?? []) as any[]) {
    const { data: acq } = await db.from('user_acquisition' as any).select('*').eq('user_id', u.id).maybeSingle();
    console.log(`${u.first_name} -> acquisition: ${acq ? JSON.stringify(acq) : 'NONE'}`);
  }
})();
