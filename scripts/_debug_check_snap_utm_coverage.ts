import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);
(async () => {
  const { data, error } = await db
    .from('user_acquisition' as any)
    .select('user_id,network,utm,landing_page,created_at')
    .eq('network', 'snapchat')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) { console.log('ERR', error.message); return; }
  const rows = (data ?? []) as any[];
  console.log(`Total snapchat-network user_acquisition rows: ${rows.length}`);
  let withTerm = 0, withId = 0, bareDefault = 0;
  for (const r of rows) {
    const utm = r.utm ?? {};
    if (utm.utm_term) withTerm++;
    if (utm.utm_id) withId++;
    if (!utm.utm_term && !utm.utm_id && utm.utm_campaign === 'get_lp') bareDefault++;
  }
  console.log(`with utm_term (ad set macro present): ${withTerm}`);
  console.log(`with utm_id (ad id present): ${withId}`);
  console.log(`bare DEFAULT_UTM fallback (get_lp, no term/id): ${bareDefault}`);
  console.log(`date range: ${rows[rows.length-1]?.created_at} to ${rows[0]?.created_at}`);

  // show a few non-default ones for contrast, if any
  const nonDefault = rows.filter(r => r.utm?.utm_term || r.utm?.utm_id);
  console.log(`\nSample non-default snap rows (${nonDefault.length} total):`);
  for (const r of nonDefault.slice(0, 5)) console.log(' ', r.created_at, JSON.stringify(r.utm));
})();
