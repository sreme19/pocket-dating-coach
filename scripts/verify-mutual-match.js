import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxOTkzNSwiZXhwIjoyMDkzMjk1OTM1fQ.3C6IwJGjMZ1DZupWqBtWdo1OgDKkbILQvcWxhmNbnGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMatch() {
  try {
    // Get Alex and Diana
    const { data: users } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, gender');

    const alex = users.find(u => u.first_name === 'Alex');
    const diana = users.find(u => u.first_name === 'Diana');

    console.log('Alex:', alex);
    console.log('Diana:', diana);

    if (!alex || !diana) {
      console.error('Could not find Alex or Diana');
      return;
    }

    // Get the match between them
    const { data: matches } = await supabase
      .from('verified_vibe_matches')
      .select('*')
      .or(`user1_id.eq.${alex.id},user2_id.eq.${alex.id}`)
      .or(`user1_id.eq.${diana.id},user2_id.eq.${diana.id}`);

    console.log('\nAll matches involving Alex or Diana:');
    matches?.forEach(m => {
      console.log(`  Match ID: ${m.id}`);
      console.log(`  User1: ${m.user1_id} (${m.user1_id === alex.id ? 'Alex' : m.user1_id === diana.id ? 'Diana' : 'Other'})`);
      console.log(`  User2: ${m.user2_id} (${m.user2_id === alex.id ? 'Alex' : m.user2_id === diana.id ? 'Diana' : 'Other'})`);
      console.log(`  Status: ${m.status}`);
      console.log('');
    });

    // Find the specific match between Alex and Diana
    const alexDianaMatch = matches?.find(
      m => (m.user1_id === alex.id && m.user2_id === diana.id) ||
           (m.user1_id === diana.id && m.user2_id === alex.id)
    );

    if (alexDianaMatch) {
      console.log('✅ Alex and Diana ARE matched!');
      console.log(`Match ID: ${alexDianaMatch.id}`);
      console.log(`Status: ${alexDianaMatch.status}`);

      // Get messages for this match
      const { data: messages } = await supabase
        .from('verified_vibe_messages')
        .select('*')
        .eq('match_id', alexDianaMatch.id);

      console.log(`\nMessages in match (${messages?.length || 0}):`);
      messages?.forEach(m => {
        console.log(`  - "${m.content}"`);
      });
    } else {
      console.log('❌ Alex and Diana are NOT matched');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

verifyMatch();
