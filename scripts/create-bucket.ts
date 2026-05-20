import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Creating profiles bucket...');

  const { data, error } = await supabase.storage.createBucket('profiles', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Bucket "profiles" already exists');
    } else {
      console.error('✗ Error creating bucket:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✓ Created bucket:', data);
  }
}

main().catch(console.error);
