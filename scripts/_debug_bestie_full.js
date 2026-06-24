import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    .split('\n').map((l)=>l.trim()).filter((l)=>l&&!l.startsWith('#')&&l.includes('='))
    .map((l)=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const MATCH_ID='e23a82eb-5255-427f-922c-b846950fdc86';
const { data: msgs } = await supabase.from('verified_vibe_messages')
  .select('id, sender_id, content, is_ai, ai_signal, ai_read, created_at')
  .eq('match_id', MATCH_ID).order('created_at',{ascending:true});
for (const m of msgs??[]) {
  console.log('---'); console.log('is_ai:', m.is_ai, ' signal:', m.ai_signal, ' read:', m.ai_read);
  console.log('content:', m.content);
}
console.log('\n=== TIMINGS ===');
const { data: t, error } = await supabase.from('vv_ai_response_timings').select('*').eq('match_id', MATCH_ID);
console.log(error ? ('timings err: '+error.message) : JSON.stringify(t, null, 2));
