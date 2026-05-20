import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createRandomMatches() {
  try {
    console.log('🔄 Fetching all users...');

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('verified_vibe_users')
      .select('id, gender, first_name');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error('No users found in database');
      process.exit(1);
    }

    // Separate by gender
    const maleUsers = users.filter(u => u.gender === 'man');
    const femaleUsers = users.filter(u => u.gender === 'woman');

    console.log(`👨 Found ${maleUsers.length} male users`);
    console.log(`👩 Found ${femaleUsers.length} female users`);

    if (maleUsers.length === 0 || femaleUsers.length === 0) {
      console.error('Need at least one male and one female user');
      process.exit(1);
    }

    // Create 10 random mutual matches
    const matchCount = Math.min(10, maleUsers.length, femaleUsers.length);
    const matches: Array<{ user1_id: string; user2_id: string }> = [];

    // Shuffle arrays for randomness
    const shuffledMales = [...maleUsers].sort(() => Math.random() - 0.5);
    const shuffledFemales = [...femaleUsers].sort(() => Math.random() - 0.5);

    for (let i = 0; i < matchCount; i++) {
      matches.push({
        user1_id: shuffledMales[i].id,
        user2_id: shuffledFemales[i].id
      });
    }

    console.log(`\n✨ Creating ${matchCount} mutual matches...`);

    // Insert matches
    const { data: createdMatches, error: matchError } = await supabase
      .from('verified_vibe_matches')
      .insert(
        matches.map(m => ({
          user1_id: m.user1_id,
          user2_id: m.user2_id,
          status: 'mutual'
        }))
      )
      .select();

    if (matchError) {
      console.error('Error creating matches:', matchError);
      process.exit(1);
    }

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
      "Tell me something interesting about yourself!"
    ];

    let messageCount = 0;

    for (const match of createdMatches || []) {
      // Get the users in this match
      const user1 = users.find(u => u.id === match.user1_id);
      const user2 = users.find(u => u.id === match.user2_id);

      if (!user1 || !user2) continue;

      // Create 2-4 messages per match
      const messageCountForMatch = Math.floor(Math.random() * 3) + 2;
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

      if (messageError) {
        console.error(`Error creating messages for match ${match.id}:`, messageError);
      } else {
        messageCount += messagesToInsert.length;
      }
    }

    console.log(`✅ Created ${messageCount} sample messages`);

    console.log('\n🎉 Random matches created successfully!');
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

createRandomMatches();
