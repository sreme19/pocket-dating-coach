import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

(async () => {
  const { data, error } = await db
    .from('verified_vibe_users')
    .select('id, first_name, archetype, created_at')
    .eq('gender', 'man')
    .is('avatar_url', null)
    .not('archetype', 'is', null)
    .order('created_at');
  if (error) return console.error(error);
  console.log('candidates:', data.length);
  data.forEach((d: any) => console.log(d.created_at, d.first_name, d.archetype));
})();
