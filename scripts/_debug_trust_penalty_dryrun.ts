import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

// Mirrors normalizeScore in src/lib/server/trust-normalize.ts. READ ONLY —
// this writes nothing; it predicts what normalizeAll would produce.
const COLD_START_FULL_N = 30, PENALTY = 0.5;
function normalizeScore(raw: number, livenessVerified: boolean, cohort: number[]) {
  const n = cohort.length;
  const percentile = n > 0 ? (cohort.filter(r => r <= raw).length / n) * 100 : raw;
  const w = Math.min(1, n / COLD_START_FULL_N);
  const blended = w * percentile + (1 - w) * raw;
  const penalized = livenessVerified ? blended : blended * PENALTY;
  return Math.round(Math.max(0, Math.min(100, penalized)));
}

(async () => {
  const { data: users } = await db.from('verified_vibe_users')
    .select('id,first_name,gender,trust_score,raw_trust,last_active_at')
    .is('deleted_at', null).eq('is_seed', false);
  const { data: steps } = await db.from('verified_vibe_verification')
    .select('user_id,step,status').eq('step','liveness').eq('status','completed');
  const live = new Set((steps||[]).map(s => s.user_id));

  const cutoff = new Date(Date.now() - 7*864e5).toISOString();
  const cohorts: Record<string, number[]> = {};
  for (const u of users||[]) {
    if ((u.last_active_at ?? '') >= cutoff) (cohorts[u.gender] = cohorts[u.gender]||[]).push(u.raw_trust ?? 0);
  }

  for (const g of ['man','woman']) {
    const pool = (users||[]).filter(u => u.gender === g);
    const cohort = cohorts[g]?.length ? cohorts[g] : [0];
    const rows = pool.map(u => ({
      n: u.first_name, before: u.trust_score ?? 0,
      after: normalizeScore(u.raw_trust ?? 0, live.has(u.id), cohort),
      liveness: live.has(u.id),
    }));
    const med = (a: number[]) => a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
    const band = (v:number)=> v>=75?'High':v>=50?'Trusted':v>=25?'Building':'Low';
    const b: Record<string,number> = {High:0,Trusted:0,Building:0,Low:0};
    rows.forEach(r=>b[band(r.after)]++);
    console.log(`\n=== ${g} (${pool.length}) — cohort n=${cohort.length} ===`);
    console.log(`  median  before ${med(rows.map(r=>r.before))}  →  after ${med(rows.map(r=>r.after))}`);
    console.log(`  bands after: ${JSON.stringify(b)}`);
    console.log(`  has liveness: ${rows.filter(r=>r.liveness).length}/${pool.length}  (the rest are still halved, correctly)`);
    console.log('  biggest movers:', rows.map(r=>({...r,d:r.after-r.before})).sort((a,b2)=>b2.d-a.d).slice(0,4).map(r=>`${r.n} ${r.before}→${r.after}`).join(', '));
  }
})();
