// READ-ONLY. Distribution of the canonical trust_score, to see whether pointing
// the Discover feed at it would visibly change what members see.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;
const real = (q: any) => q.eq('is_seed', false).eq('is_provisional', false);
async function c(label: string, build: (q: any) => any) {
  const { count: n } = await build(db.from('verified_vibe_users').select('*', { count: 'exact', head: true }));
  console.log(label.padEnd(34), n);
}
(async () => {
  console.log('=== canonical trust_score, real members ===');
  const ranges: [number, number][] = [[0,0],[1,24],[25,25],[26,49],[50,50],[51,74],[75,75],[76,99],[100,100]];
  for (const [lo, hi] of ranges) {
    await c(lo === hi ? `exactly ${lo}` : `${lo}-${hi}`, (q: any) => real(q).gte('trust_score', lo).lte('trust_score', hi));
  }
  await c('on a feed-representable value', (q: any) => real(q).in('trust_score', [0,25,50,75,100]));
  console.log('\n(the feed formula can ONLY ever emit 0, 25, 50, 75 or 100)');
})();
