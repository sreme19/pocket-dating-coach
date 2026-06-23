#!/usr/bin/env tsx
/**
 * Read-only verification for vv_pool_profiles after the migration is applied.
 * Confirms row counts line up with the two source tables and that the merged
 * fields are present. Makes NO changes.
 *
 * Usage: tsx --env-file=.env.local scripts/verify-pool-profiles.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const headCount = (t: string, col?: string, val?: string) => {
  let q = db.from(t).select('*', { count: 'exact', head: true });
  if (col && val) q = q.eq(col, val);
  return q.then((r) => r.count ?? 0);
};

async function main() {
  console.log(`\n📍 ${SUPABASE_URL}\n`);

  const { error: existsErr } = await db.from('vv_pool_profiles').select('user_id').limit(1);
  if (existsErr) {
    console.error(`❌ vv_pool_profiles not reachable: ${existsErr.message}`);
    console.error(`   (Has the migration been applied in the SQL editor yet?)`);
    process.exit(2);
  }

  const [srcW, srcB, total, wm, bs] = await Promise.all([
    headCount('vv_pool_wingmen'),
    headCount('vv_pool_besties'),
    headCount('vv_pool_profiles'),
    headCount('vv_pool_profiles', 'assistant_type', 'wingman'),
    headCount('vv_pool_profiles', 'assistant_type', 'bestie'),
  ]);

  console.log('── Row counts ─────────────────────────────────');
  console.log(`vv_pool_wingmen : ${srcW}  →  profiles(wingman): ${wm}  ${srcW === wm ? '✅' : '⚠️ mismatch'}`);
  console.log(`vv_pool_besties : ${srcB}  →  profiles(bestie) : ${bs}  ${srcB === bs ? '✅' : '⚠️ mismatch'}`);
  console.log(`vv_pool_profiles total: ${total}`);

  const expectedProfileKeys = ['publicIntro','headline','intentStatement','personalityDescriptors','values','compatibilitySignals','conversationHooks','lifestyleTags','countriesTraveled','topProofSignals','proofCategories'];
  const expectedPrefKeys = ['lookingFor','dealbreakers','emotionalSignals','lifestyleSignals','maturitySignals'];

  for (const t of ['wingman', 'bestie']) {
    const { data } = await db.from('vv_pool_profiles')
      .select('user_id, match_profile, preferences').eq('assistant_type', t).limit(1);
    const row = data?.[0];
    if (!row) { console.log(`\n(no ${t} rows to sample)`); continue; }
    const mpKeys = Object.keys(row.match_profile ?? {});
    const prKeys = Object.keys(row.preferences ?? {});
    const missingMp = expectedProfileKeys.filter((k) => !mpKeys.includes(k));
    const missingPr = expectedPrefKeys.filter((k) => !prKeys.includes(k));
    console.log(`\n── Sample ${t} (${row.user_id}) ──`);
    console.log(`  match_profile keys: ${mpKeys.join(', ')}`);
    console.log(`  preferences  keys: ${prKeys.join(', ')}`);
    if (missingMp.length) console.log(`  ⚠️ missing match_profile keys: ${missingMp.join(', ')}`);
    if (missingPr.length) console.log(`  ⚠️ missing preferences keys: ${missingPr.join(', ')}`);
    console.log(`  lookingFor: ${JSON.stringify(row.preferences?.lookingFor)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
