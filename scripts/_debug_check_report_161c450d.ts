import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

const REPORT_ID = '161c450d-9f53-4964-9e3a-90fb5bcf9c3c';
const ABOUT_USER = 'b07cf0d0-e677-460c-b4ce-b58a67cd6555';
const REPORTED_BY = 'c92dd059-8a93-470e-ae73-ea2efe764962';

(async () => {
  const { data: report, error: reportErr } = await db
    .from('issue_reports' as any)
    .select('*')
    .eq('id', REPORT_ID)
    .maybeSingle();
  console.log('--- issue_reports row ---');
  if (reportErr) console.log('ERR', reportErr.message);
  console.log(JSON.stringify(report, null, 2));

  const { data: user, error: userErr } = await db
    .from('verified_vibe_users')
    .select('id,first_name,gender,archetype,trust_score,created_at,avatar_url')
    .eq('id', ABOUT_USER)
    .maybeSingle();
  console.log('\n--- about_user (reported profile) ---');
  if (userErr) console.log('ERR', userErr.message);
  console.log(JSON.stringify(user, null, 2));

  const { data: master } = await db
    .from('user_master_profile' as any)
    .select('data')
    .eq('user_id', ABOUT_USER)
    .maybeSingle();
  const d = (master as any)?.data ?? {};
  console.log('\n--- about_user master profile photos ---');
  console.log('raw photos:', JSON.stringify(d.photos ?? [], null, 2));
  console.log('ai photos:', JSON.stringify(d.aiPhotos ?? [], null, 2));
  console.log('bio/about fields present:', Object.keys(d).filter(k => /bio|about|prompt|intro/i.test(k)));

  const { data: reporter } = await db
    .from('verified_vibe_users')
    .select('id,first_name,gender,created_at')
    .eq('id', REPORTED_BY)
    .maybeSingle();
  console.log('\n--- reported_by (reporter) ---');
  console.log(JSON.stringify(reporter, null, 2));
})();
