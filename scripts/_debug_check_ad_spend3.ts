import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
(async () => {
  const { data, error } = await db.from('verified_vibe_users' as any).select('id,email').ilike('email', '%ramu22tera%');
  console.log('lookup ramu22tera:', data, error?.message);
  const { data: any1 } = await db.from('verified_vibe_users' as any).select('id,email').limit(3);
  console.log('sample rows:', any1);
})();
