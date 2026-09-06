import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
const out = process.argv[2];
(async () => {
  const { data, error } = await db.from('verified_vibe_users')
    .select('id,first_name,gender,trust_score,normalized_trust,raw_trust,identity_verified,trust_updated_at')
    .is('deleted_at', null);
  if (error) { console.log('ERR', error.message); process.exit(1); }
  writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(`snapshot: ${data!.length} rows → ${out}`);
})();
