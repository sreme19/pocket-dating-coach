/**
 * Delete Snap ad spend rows with empty ad_set_id.
 *
 * Snap's campaign breakdown doesn't provide ad set or creative drill-down,
 * so those fields are empty. This script removes those rows if needed.
 *
 * Run: 
 *   npx vercel env pull --environment production .env.vercel
 *   source .env.vercel && npx tsx scripts/delete-empty-snap-rows.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  console.error('Run: npx vercel env pull --environment production .env.vercel');
  console.error('Then: source .env.vercel && npx tsx scripts/delete-empty-snap-rows.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Deleting Snap rows with empty ad_set_id...');

  const { data, error, count } = await supabase
    .from('ad_spend_daily')
    .delete({ count: 'exact' })
    .eq('network', 'snap')
    .eq('ad_set_id', '');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Deleted ${count ?? 0} rows`);
}

main();
