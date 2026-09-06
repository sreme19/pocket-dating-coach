import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

// What the LIVE feed now renders: displayTrustScore(row) = clamp(round(trust_score)).
const display = (t: any) => (typeof t !== 'number' || Number.isNaN(t)) ? 0 : Math.min(100, Math.max(0, Math.round(t)));

(async () => {
  // The feed's own population: real members (is_seed false), not deleted.
  const { data: users, error } = await db
    .from('verified_vibe_users')
    .select('id,first_name,gender,trust_score,raw_trust,identity_verified,trust_updated_at,is_seed,archetype')
    .is('deleted_at', null)
    .eq('is_seed', false);
  if (error) { console.log('ERR', error.message); return; }

  const { data: steps } = await db
    .from('verified_vibe_verification').select('user_id,step,status');
  const byUser = new Map<string, any[]>();
  for (const s of steps || []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }
  const CORE = ['id','liveness','photos','spending_or_qa'];

  for (const g of ['man','woman']) {
    const pool = (users||[]).filter(u => u.gender === g);
    const now = pool.map(u => display(u.trust_score));
    const before = pool.map(u => Math.min(100, (byUser.get(u.id)||[]).filter((r:any)=>r.status==='completed'&&CORE.includes(r.step)).length*25));
    const band = (v:number)=> v>=75?'High':v>=50?'Trusted':v>=25?'Building':'Low';
    const bands: Record<string,number> = {High:0,Trusted:0,Building:0,Low:0};
    now.forEach(v=>bands[band(v)]++);
    const zeros = now.filter(v=>v===0).length;
    const over = now.filter(v=>v>100||v<0).length;
    console.log(`\n=== ${g} (feed pool, real members): ${pool.length} ===`);
    console.log(`  now  min ${Math.min(...now)} max ${Math.max(...now)} median ${now.slice().sort((a,b)=>a-b)[Math.floor(now.length/2)]}`);
    console.log(`  was  min ${Math.min(...before)} max ${Math.max(...before)} median ${before.slice().sort((a,b)=>a-b)[Math.floor(before.length/2)]}`);
    console.log(`  bands: ${JSON.stringify(bands)}   zeros: ${zeros}   out-of-range: ${over}`);
    // Top of feed by the live comparator's final key
    const top = pool.map(u=>({n:u.first_name,now:display(u.trust_score)})).sort((a,b)=>b.now-a.now).slice(0,5);
    console.log('  top by trust:', top.map(t=>`${t.n}=${t.now}`).join(', '));
    const noId = pool.filter(u => !u.identity_verified).length;
    const stale = pool.filter(u => !u.trust_updated_at).length;
    const rawNull = pool.filter(u => u.raw_trust === null).length;
    const raws = pool.map(u => u.raw_trust ?? 0);
    console.log(`  identity_verified FALSE: ${noId}/${pool.length} (each halves the score)`);
    console.log(`  never normalized (no trust_updated_at): ${stale}   raw_trust NULL: ${rawNull}`);
    console.log(`  raw_trust  min ${Math.min(...raws)} max ${Math.max(...raws)} median ${raws.slice().sort((a,b)=>a-b)[Math.floor(raws.length/2)]}`);
  }
})();
// Appended: is identity_verified accurate, or stale?
(async () => {
  const { data: users } = await db.from('verified_vibe_users')
    .select('id,gender,identity_verified,trust_score').is('deleted_at', null).eq('is_seed', false);
  const { data: steps } = await db.from('verified_vibe_verification').select('user_id,step,status');
  const done = new Map<string, Set<string>>();
  for (const s of steps || []) {
    if (s.status !== 'completed') continue;
    if (!done.has(s.user_id)) done.set(s.user_id, new Set());
    done.get(s.user_id)!.add(s.step);
  }
  let bothDone = 0, bothDoneButFlagFalse = 0, flagTrueNoSteps = 0;
  for (const u of users || []) {
    const d = done.get(u.id) || new Set();
    const hasBoth = d.has('id') && d.has('liveness');
    if (hasBoth) bothDone++;
    if (hasBoth && !u.identity_verified) bothDoneButFlagFalse++;
    if (!hasBoth && u.identity_verified) flagTrueNoSteps++;
  }
  console.log(`\n=== identity_verified accuracy (real members: ${users?.length}) ===`);
  console.log(`  actually completed BOTH id+liveness: ${bothDone}`);
  console.log(`  ...but flagged identity_verified=false (STALE, wrongly penalized): ${bothDoneButFlagFalse}`);
  console.log(`  flagged true without both steps: ${flagTrueNoSteps}`);
})();
