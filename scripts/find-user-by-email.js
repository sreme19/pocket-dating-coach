import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stikoktiaxqtcsohcxzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aWtva3RpYXhxdGNzb2hjeHpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcxOTkzNSwiZXhwIjoyMDkzMjk1OTM1fQ.3C6IwJGjMZ1DZupWqBtWdo1OgDKkbILQvcWxhmNbnGA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUser() {
  try {
    // Get auth user by email
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    const targetEmail = 'alex_monogamish_t9n2cw@seed.vv';
    const authUser = users.find(u => u.email === targetEmail);

    if (authUser) {
      console.log(`Found auth user: ${authUser.email}`);
      console.log(`Auth ID: ${authUser.id}`);

      // Now find the profile user
      const { data: profileUsers } = await supabase
        .from('verified_vibe_users')
        .select('*');

      console.log('\nAll profile users:');
      profileUsers?.forEach(u => {
        console.log(`  ${u.first_name} (${u.gender}): ${u.id}`);
      });
    } else {
      console.log(`Auth user not found: ${targetEmail}`);
      console.log('\nAll auth users:');
      users.forEach(u => {
        if (u.email?.includes('seed')) {
          console.log(`  ${u.email}`);
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

findUser();
