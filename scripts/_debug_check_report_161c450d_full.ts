import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

(async () => {
  const { data: master } = await db
    .from('user_master_profile' as any)
    .select('data')
    .eq('user_id', 'b07cf0d0-e677-460c-b4ce-b58a67cd6555')
    .maybeSingle();
  console.log(JSON.stringify(master, null, 2));
})();
