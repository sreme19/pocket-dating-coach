import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
const uid = process.argv[2] || 'd947b796-b9bb-4b4a-9d2b-151de73c2d30';

(async () => {
  const { data: user } = await db.from('verified_vibe_users')
    .select('id,gender,archetype,first_name,trust_score,created_at').eq('id', uid).maybeSingle();
  console.log('=== verified_vibe_users ===\n', JSON.stringify(user, null, 2));

  const { data: ver, error: verErr } = await db.from('verified_vibe_verification')
    .select('step,status,completed_at,data').eq('user_id', uid);
  console.log('\n=== verified_vibe_verification ===');
  if (verErr) console.log('ERR', verErr.message);
  console.log('rows:', ver?.length ?? 0);
  for (const r of ver ?? []) {
    const keys = (r as any).data?.responses ? Object.keys((r as any).data.responses) : Object.keys((r as any).data ?? {});
    console.log(` - step=${(r as any).step} status=${(r as any).status} dataKeys=[${keys.join(', ')}]`);
  }

  const { data: master } = await db.from('user_master_profile' as any)
    .select('data').eq('user_id', uid).maybeSingle();
  const onb = (master as any)?.data?.onboarding;
  console.log('\n=== user_master_profile.onboarding ===');
  console.log('bags:', onb ? Object.keys(onb) : null);
  console.log('vv_qa_responses keys:', onb?.vv_qa_responses ? Object.keys(onb.vv_qa_responses) : null);

  const { data: w } = await db.from('vv_pool_wingmen' as any).select('preference_signals').eq('user_id', uid).maybeSingle();
  const { data: b } = await db.from('vv_pool_besties' as any).select('preference_model').eq('user_id', uid).maybeSingle();
  console.log('\n=== pool ===');
  console.log('wingman preference_signals:', JSON.stringify((w as any)?.preference_signals ?? null));
  console.log('bestie preference_model:', JSON.stringify((b as any)?.preference_model ?? null));
})();
