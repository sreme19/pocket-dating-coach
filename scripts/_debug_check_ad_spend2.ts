import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

(async () => {
  const { data: acq, error } = await db
    .from('user_acquisition' as any)
    .select('user_id,network,campaign,utm,created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.log('ERR', error.message); return; }
  console.log('Most recent user_acquisition rows:');
  for (const r of (acq ?? []) as any[]) {
    console.log(`  ${r.created_at} network=${r.network} campaign=${r.campaign} utm=${JSON.stringify(r.utm)}`);
  }

  const emails = ['ramu22tera@gmail.com','harishankarsunani759@gmail.com','mknaik1059@gmail.com','rksinghagri@gmail.com','sameersatpute7@gmail.com','siddiquiabdulaziz83@gmail.com','gaamwalagujjar@gmail.com','rahim2105rj@gmail.com','rohittiwari101.rt@gmail.com'];
  const { data: users } = await db.from('verified_vibe_users' as any).select('id,email,first_name,created_at').in('email', emails);
  console.log('\nMatched users:', (users ?? []).length);
  for (const u of (users ?? []) as any[]) {
    const { data: a } = await db.from('user_acquisition' as any).select('*').eq('user_id', u.id).maybeSingle();
    console.log(`  ${u.first_name} (${u.email}) created=${u.created_at} acquisition=${a ? JSON.stringify(a) : 'NONE'}`);
  }
})();
