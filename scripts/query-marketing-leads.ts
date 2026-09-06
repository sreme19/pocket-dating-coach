import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function queryMarketingLeads() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: 'select source, count(*) from public.marketing_leads group by source;'
  });

  if (error) {
    console.error('RPC Error:', error);
    
    // Fallback: fetch all and group in JS
    console.log('\nFalling back to client-side grouping...');
    const { data: allData, error: fetchError } = await supabase
      .from('marketing_leads')
      .select('source');
    
    if (fetchError) {
      console.error('Fetch Error:', fetchError);
      process.exit(1);
    }
    
    // Group by source
    const grouped = (allData || []).reduce((acc: any, row: any) => {
      const source = row.source || 'null';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nResults:');
    console.log('source | count');
    console.log('-------|------');
    Object.entries(grouped)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .forEach(([source, count]) => {
        console.log(`${source} | ${count}`);
      });
    
    console.log(`\nTotal: ${allData?.length || 0} leads`);
    return;
  }

  console.log('Results:', data);
}

queryMarketingLeads();
