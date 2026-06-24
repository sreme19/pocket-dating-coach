import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    .split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const MATCH_ID = 'e23a82eb-5255-427f-922c-b846950fdc86';
const TRIGGER_ACCT = '792698c6-fe26-4de5-a08a-7e188710aded';

const { data: match } = await supabase
  .from('verified_vibe_matches').select('*').eq('id', MATCH_ID).single();
console.log('MATCH ROW:', JSON.stringify(match, null, 2));

const ids = [match.user1_id, match.user2_id];
const { data: users } = await supabase
  .from('verified_vibe_users').select('id, first_name, gender, archetype').in('id', ids);
console.log('\nUSERS:');
for (const u of users) {
  const role = u.id === match.user1_id ? 'user1' : 'user2';
  const trig = u.id === TRIGGER_ACCT ? '  <-- triggered find-match' : '';
  console.log(`  [${role}] ${u.first_name}  gender=${JSON.stringify(u.gender)} archetype=${u.archetype}  ${u.id}${trig}`);
}

const { data: msgs } = await supabase
  .from('verified_vibe_messages')
  .select('id, sender_id, content, is_ai, ai_signal, created_at')
  .eq('match_id', MATCH_ID).order('created_at', { ascending: true });
console.log(`\nMESSAGES (${msgs?.length ?? 0}):`);
for (const m of msgs ?? []) {
  const who = m.sender_id === match.user1_id ? 'user1' : 'user2';
  console.log(`  [${who}] ai=${m.is_ai ?? false} signal=${m.ai_signal ?? '-'}  "${m.content?.slice(0, 60)}"  ${m.created_at}`);
}
