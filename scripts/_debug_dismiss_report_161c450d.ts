import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_KEY!;
const db = createClient(url, key);

const REPORT_ID = '161c450d-9f53-4964-9e3a-90fb5bcf9c3c';

(async () => {
  const { data, error } = await db
    .from('issue_reports' as any)
    .update({ status: 'dismissed' })
    .eq('id', REPORT_ID)
    .select('*')
    .maybeSingle();
  if (error) { console.log('ERR', error.message); return; }
  console.log(JSON.stringify(data, null, 2));
})();
