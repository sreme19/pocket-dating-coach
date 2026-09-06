// READ-ONLY. Does the replacement guarantee actually FIRE in production?
// Reading handoff-clock.ts proves the code exists. This asks whether it has run.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;
const n = async (label: string, b: (q: any) => any) => {
  const { count, error } = await b(db.from('verified_vibe_matches').select('*', { count: 'exact', head: true }));
  console.log(`${label.padEnd(44)} ${error ? 'ERR ' + error.message : count}`);
  return count as number;
};
(async () => {
  console.log('=== verified_vibe_matches ===');
  await n('total matches', (q: any) => q);
  const replaced = await n('matches REPLACED (replaced_by_match_id set)', (q: any) => q.not('replaced_by_match_id', 'is', null));
  await n('matches expired (expired_at set)', (q: any) => q.not('expired_at', 'is', null));

  console.log('\n=== how matches were created (source) ===');
  const { data } = await db.from('verified_vibe_matches').select('source, status, expired_at, replaced_by_match_id');
  const bySource: Record<string, number> = {};
  for (const m of data || []) bySource[m.source ?? '(null)'] = (bySource[m.source ?? '(null)'] || 0) + 1;
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(20)} ${v}`);

  console.log('\n=== VERDICT ===');
  console.log(replaced > 0
    ? `The replacement guarantee has FIRED ${replaced} time(s) in production. Not just implemented — exercised.`
    : 'Code exists and the cron is scheduled, but NO replacement has ever fired. Implemented, never exercised.');
})();
