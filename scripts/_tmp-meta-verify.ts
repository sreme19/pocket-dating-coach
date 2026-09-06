import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const CAMP = 'RA_LEADS_GETW-APPLY_IN_PAN_TOF_202608';
(async () => {
  const { count: total } = await supabase.from('marketing_leads').select('*',{count:'exact',head:true}).eq('source','meta_lead_form');
  const { count: camp } = await supabase.from('marketing_leads').select('*',{count:'exact',head:true}).eq('source','meta_lead_form').eq('campaign',CAMP);
  const { count: audit } = await supabase.from('marketing_lead_submissions').select('*',{count:'exact',head:true}).eq('network','meta_lead_form').gte('created_at','2026-08-31T00:00:00Z');
  console.log(`META total=${total} campaign=${camp} auditToday=${audit}`);
})();
