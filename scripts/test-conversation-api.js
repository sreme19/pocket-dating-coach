import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTk5MzUsImV4cCI6MjA5MzI5NTkzNX0.L-yF5jGPqP59RzqKfr8hnhByuTy4sx_xbjvAKcNtIKQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConversationAPI() {
  try {
    // Login as Alex
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'alex_monogamish_t9n2cw@seed.vv',
      password: 'SeedPass123!'
    });

    if (loginError || !session) {
      console.error('Login error:', loginError);
      return;
    }

    console.log('✅ Logged in as Alex');
    console.log('Access token:', session.access_token.substring(0, 20) + '...');

    // Get the match ID
    const { data: users } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name');

    const alex = users.find(u => u.first_name === 'Alex');
    const diana = users.find(u => u.first_name === 'Diana');

    const { data: matches } = await supabase
      .from('verified_vibe_matches')
      .select('id')
      .or(`user1_id.eq.${alex.id},user2_id.eq.${alex.id}`);

    if (!matches || matches.length === 0) {
      console.error('No matches found');
      return;
    }

    const matchId = matches[0].id;
    console.log('Match ID:', matchId);

    // Test the API
    const response = await fetch(`http://localhost:5175/api/verified-vibe/chat/${matchId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const text = await response.text();
    console.log('Response body (first 500 chars):', text.substring(0, 500));

    if (response.ok) {
      const data = JSON.parse(text);
      console.log('✅ API response:', data);
    } else {
      console.error('❌ API error');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testConversationAPI();
