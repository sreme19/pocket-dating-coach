import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxOTkzNSwiZXhwIjoyMDkzMjk1OTM1fQ.3C6IwJGjMZ1DZupWqBtWdo1OgDKkbILQvcWxhmNbnGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMatches() {
  try {
    // Find all users
    const { data: allUsers } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, gender');

    console.log('All users:');
    allUsers?.forEach(u => {
      console.log(`  ${u.first_name} (${u.gender}): ${u.id}`);
    });

    // Find Alex
    const { data: alexUsers } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, gender')
      .ilike('first_name', '%alex%');

    console.log('\n\nAlex users:', alexUsers);

    if (alexUsers && alexUsers.length > 0) {
      const alexId = alexUsers[0].id;
      console.log(`\nAlex ID: ${alexId}`);

      // Get matches for Alex
      const { data: matches } = await supabase
        .from('verified_vibe_matches')
        .select('*')
        .or(`user1_id.eq.${alexId},user2_id.eq.${alexId}`);

      console.log(`\nMatches for Alex (${matches?.length || 0}):`);
      matches?.forEach(m => {
        console.log(`  - Match ID: ${m.id}, Status: ${m.status}`);
        console.log(`    User1: ${m.user1_id}, User2: ${m.user2_id}`);
      });

      // Get messages for first match
      if (matches && matches.length > 0) {
        const matchId = matches[0].id;
        const { data: messages } = await supabase
          .from('verified_vibe_messages')
          .select('*')
          .eq('match_id', matchId);

        console.log(`\nMessages in first match (${matchId}):`);
        console.log(`  Total: ${messages?.length || 0}`);
        messages?.slice(0, 3).forEach(m => {
          console.log(`    - "${m.content}"`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMatches();
