import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxOTkzNSwiZXhwIjoyMDkzMjk1OTM1fQ.3C6IwJGjMZ1DZupWqBtWdo1OgDKkbILQvcWxhmNbnGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createComprehensiveMatches() {
  try {
    console.log('🧹 Cleaning up old matches and messages...');

    // Delete all messages
    await supabase
      .from('verified_vibe_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // Delete all matches
    await supabase
      .from('verified_vibe_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ Cleaned up old data');

    console.log('\n🔄 Fetching all users...');

    // Get all users
    const { data: users } = await supabase
      .from('verified_vibe_users')
      .select('id, gender, first_name');

    // Separate by gender
    const maleUsers = users.filter(u => u.gender === 'man');
    const femaleUsers = users.filter(u => u.gender === 'woman');

    console.log(`👨 Found ${maleUsers.length} male users`);
    console.log(`👩 Found ${femaleUsers.length} female users`);

    // Create matches: pair each male with a female (cycling if needed)
    const matches = [];
    const maxMatches = Math.max(maleUsers.length, femaleUsers.length);

    for (let i = 0; i < maxMatches; i++) {
      const maleIdx = i % maleUsers.length;
      const femaleIdx = i % femaleUsers.length;

      // Skip if we've already paired these two
      const alreadyPaired = matches.some(
        m => (m.user1_id === maleUsers[maleIdx].id && m.user2_id === femaleUsers[femaleIdx].id) ||
             (m.user1_id === femaleUsers[femaleIdx].id && m.user2_id === maleUsers[maleIdx].id)
      );

      if (!alreadyPaired) {
        matches.push({
          user1_id: maleUsers[maleIdx].id,
          user2_id: femaleUsers[femaleIdx].id
        });
      }

      if (matches.length >= 21) break; // Create matches for all users
    }

    console.log(`\n✨ Creating ${matches.length} mutual matches...`);

    // Insert matches
    const { data: createdMatches } = await supabase
      .from('verified_vibe_matches')
      .insert(
        matches.map(m => ({
          user1_id: m.user1_id,
          user2_id: m.user2_id,
          status: 'mutual'
        }))
      )
      .select();

    console.log(`✅ Created ${createdMatches?.length || 0} matches`);

    // Create sample messages for each match
    console.log('\n💬 Creating sample messages for matches...');

    const sampleMessages = [
      "Hey! How's your day going?",
      "I really enjoyed your profile! Would love to chat more.",
      "What brings you to the app?",
      "Any fun plans for the weekend?",
      "I love your energy! Tell me more about yourself.",
      "What's your ideal first date?",
      "I'm really drawn to your vibe. Let's get to know each other!",
      "What are you passionate about?",
      "I think we could have great chemistry. What do you think?",
      "Tell me something interesting about yourself!",
      "I'm excited to get to know you better!",
      "Your profile caught my attention. Let's chat!",
      "What's something you're looking forward to?",
      "I'd love to hear your story.",
      "You seem really interesting. Tell me more!"
    ];

    let messageCount = 0;

    for (const match of createdMatches || []) {
      // Get the users in this match
      const user1 = users.find(u => u.id === match.user1_id);
      const user2 = users.find(u => u.id === match.user2_id);

      if (!user1 || !user2) continue;

      // Create 3-5 messages per match for a more realistic conversation
      const messageCountForMatch = Math.floor(Math.random() * 3) + 3;
      const messagesToInsert = [];

      for (let i = 0; i < messageCountForMatch; i++) {
        const sender = i % 2 === 0 ? match.user1_id : match.user2_id;
        const messageText = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];

        messagesToInsert.push({
          match_id: match.id,
          sender_id: sender,
          content: messageText
        });
      }

      const { error: messageError } = await supabase
        .from('verified_vibe_messages')
        .insert(messagesToInsert);

      if (!messageError) {
        messageCount += messagesToInsert.length;
      }
    }

    console.log(`✅ Created ${messageCount} sample messages`);

    console.log('\n🎉 Comprehensive matches created successfully!');
    console.log(`\nMatches created:`);
    createdMatches?.forEach((match, idx) => {
      const user1 = users.find(u => u.id === match.user1_id);
      const user2 = users.find(u => u.id === match.user2_id);
      console.log(`  ${idx + 1}. ${user1?.first_name} ↔️ ${user2?.first_name}`);
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

createComprehensiveMatches();
