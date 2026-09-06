import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

// Reproduce all three formulas against real rows, to see how far apart the
// two surfaces actually are today.
const CAT_PTS: Record<string, number> = { lifestyle:8,hosting:6,discipline:4,social_proof:4,linkedin:5,instagram:3,twitter:2,habit_tracker:2,intro:8,spending:10,assets:10,wealth:12,travel:8 };

(async () => {
  const { data: users, error } = await db
    .from('verified_vibe_users')
    .select('id,trust_score,gender,is_seed')
    .is('deleted_at', null);
  if (error) { console.log('ERR', error.message); return; }
  const { data: steps, error: e2 } = await db
    .from('verified_vibe_verification')
    .select('user_id,step,status');
  if (e2) { console.log('ERR2', e2.message); return; }

  const byUser = new Map<string, any[]>();
  for (const s of steps || []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const nulls = (users||[]).filter(u => u.trust_score === null).length;
  console.log(`users: ${users?.length}  trust_score NULL: ${nulls}`);

  let disagree = 0, maxGap = 0; const samples: string[] = [];
  for (const u of users || []) {
    const rows = byUser.get(u.id) || [];
    const done = (n: string) => rows.some(r => r.step === n && r.status === 'completed');
    // Formula B — discovery feed card
    const feed = Math.min(100, rows.filter(r => r.status === 'completed' && ['id','liveness','photos','spending_or_qa'].includes(r.step)).length * 25);
    // Formula C — mobile detail view
    const vPts = (done('id')?10:0)+(done('liveness')?10:0)+(done('photos')?15:0)+(done('spending_or_qa')?10:0);
    let proofPts = 0;
    for (const r of rows) {
      if (r.step?.startsWith('proof_') && r.status === 'completed') proofPts += CAT_PTS[r.step.replace('proof_','')] ?? 4;
    }
    const detail = Math.min(100, vPts + proofPts);
    // Formula D — public-profile endpoint, the OTHER-member detail view the
    // ledger actually observed (core*20 + proof*4, stored value only as an
    // || fallback when that computes to 0).
    const coreCount = rows.filter(r => r.status === 'completed' && ['id','liveness','photos','spending_or_qa'].includes(r.step)).length;
    const proofCount = rows.filter(r => r.status === 'completed' && r.step?.startsWith('proof_')).length;
    const pub = Math.min(100, coreCount * 20 + proofCount * 4) || (u.trust_score ?? 0);
    const stored = u.trust_score;
    if (feed !== pub) {
      disagree++;
      const gap = Math.abs(feed - pub);
      if (gap > maxGap) maxGap = gap;
      if (samples.length < 8) samples.push(`  ${u.id.slice(0,8)} card=${feed} detail=${pub} selfView=${detail} stored=${stored} gap=${gap}`);
    }
  }
  console.log(`profiles where CARD vs PUBLIC-PROFILE DETAIL disagree: ${disagree} / ${users?.length}  (max gap ${maxGap} pts)`);
  console.log(samples.join('\n'));
})();
