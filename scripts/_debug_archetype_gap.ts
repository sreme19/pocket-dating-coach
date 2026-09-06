import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const VALID = new Set(['casual_generous_man','hopeless_romantic_man','rebound_healing_man','untouched_heart_man','forever_focused_man','traditional_matrimony_man','second_chapter_man','just_friends_man','spoiled_casual_woman','hopeless_romantic_woman','rebound_healing_woman','untouched_heart_woman','forever_focused_woman','traditional_matrimony_woman','second_chapter_woman','just_friends_woman']);
(async () => {
  const { data } = await db.from('verified_vibe_users')
    .select('id,first_name,gender,archetype,is_seed,is_provisional').is('deleted_at', null).eq('is_seed', false);
  const rows = data || [];
  const nulls = rows.filter(r => r.archetype === null);
  const empty = rows.filter(r => r.archetype === '');
  const invalid = rows.filter(r => r.archetype && !VALID.has(r.archetype));
  console.log(`real members: ${rows.length}`);
  console.log(`  archetype NULL:          ${nulls.length}   → card '||' gives casual_man, detail '??' gives casual_man  (agree, both invalid)`);
  console.log(`  archetype EMPTY STRING:  ${empty.length}   → card '||' gives casual_man, detail '??' KEEPS ''        (DISAGREE)`);
  console.log(`  archetype set but not a known key: ${invalid.length}`);
  if (invalid.length) console.log('   ', [...new Set(invalid.map(r=>r.archetype))].join(', '));
  // gender mismatch: a man carrying a woman archetype (or vice versa)
  const crossed = rows.filter(r => r.archetype && VALID.has(r.archetype) &&
    ((r.gender==='man' && r.archetype.endsWith('_woman')) || (r.gender==='woman' && r.archetype.endsWith('_man'))));
  console.log(`  gender/archetype crossed: ${crossed.length}`);
})();
(async () => {
  const { data } = await db.from('verified_vibe_users')
    .select('id,archetype,is_provisional').is('deleted_at', null).eq('is_seed', false);
  const empty = (data||[]).filter(r => r.archetype === '');
  console.log(`\nof the ${empty.length} empty-archetype members, is_provisional: ${empty.filter(r=>r.is_provisional).length}`);
})();
