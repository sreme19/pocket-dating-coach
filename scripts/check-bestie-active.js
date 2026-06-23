// Reports AI Bestie activation state across matches.
// Usage: node scripts/check-bestie-active.js
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const { data: matches, error } = await supabase
  .from('verified_vibe_matches')
  .select('id, user1_id, user2_id, status, ai_bestie_active, created_at')
  .order('created_at', { ascending: false });

if (error) { console.error('Query failed:', error); process.exit(1); }

const on = matches.filter((m) => m.ai_bestie_active === true).length;
const off = matches.length - on;
console.log(`\nTotal matches: ${matches.length}  |  bestie ON: ${on}  |  bestie OFF/null: ${off}\n`);

// Show the 15 most recent with the names + genders so we can spot matchmaker matches.
const ids = [...new Set(matches.flatMap((m) => [m.user1_id, m.user2_id]))];
const { data: users } = await supabase
  .from('verified_vibe_users')
  .select('id, first_name, gender')
  .in('id', ids);
const byId = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
const name = (id) => { const u = byId[id]; return u ? `${u.first_name}(${u.gender ?? '?'})` : id.slice(0, 8); };

console.log('Most recent 15 matches:');
for (const m of matches.slice(0, 15)) {
  console.log(`  ${m.ai_bestie_active ? '✅ ON ' : '⬜ OFF'}  ${name(m.user1_id)} ↔ ${name(m.user2_id)}  [${m.status}]  ${m.created_at?.slice(0, 10)}`);
}
