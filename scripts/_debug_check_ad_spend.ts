import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

(async () => {
  const { data: all, error } = await db
    .from('ad_spend_daily' as any)
    .select('network,date,creative_id,creative_name,campaign_id,ad_set_id')
    .order('date', { ascending: false })
    .limit(2000);
  if (error) { console.log('ERR', error.message); return; }
  const rows = all ?? [];
  console.log(`Total ad_spend_daily rows fetched (capped 2000): ${rows.length}`);

  const byNetwork: Record<string, number> = {};
  const byNetworkWithCreative: Record<string, number> = {};
  let maxDate = '';
  let minDate = '';
  for (const r of rows as any[]) {
    byNetwork[r.network] = (byNetwork[r.network] ?? 0) + 1;
    if (r.creative_id && r.creative_name) {
      byNetworkWithCreative[r.network] = (byNetworkWithCreative[r.network] ?? 0) + 1;
    }
    if (!maxDate || r.date > maxDate) maxDate = r.date;
    if (!minDate || r.date < minDate) minDate = r.date;
  }
  console.log('Rows by network:', byNetwork);
  console.log('Rows by network WITH creative_id+creative_name set:', byNetworkWithCreative);
  console.log('Date range:', minDate, 'to', maxDate);

  const snapCreative = (rows as any[]).filter(r => r.network === 'snap' && r.creative_id);
  console.log(`\nSnap rows with creative_id set: ${snapCreative.length}`);
  for (const r of snapCreative.slice(0, 10)) {
    console.log(`  ${r.date} campaign=${r.campaign_id} adset=${r.ad_set_id} creative_id=${r.creative_id} creative_name=${r.creative_name}`);
  }

  // Check recent users' ad ids vs what's in ad_spend_daily
  const { data: recentUsers } = await db
    .from('verified_vibe_users' as any)
    .select('id,first_name,created_at')
    .gte('created_at', '2026-08-19T00:00:00Z')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(`\nRecent users (since 08-19): ${recentUsers?.length}`);
})();

(async () => {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  const db2 = createClient(url, key);
  const { count } = await db2.from('user_acquisition' as any).select('*', { count: 'exact', head: true });
  console.log('\nuser_acquisition row count:', count);
})();
