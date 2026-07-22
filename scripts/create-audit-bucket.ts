import { createClient } from '@supabase/supabase-js';

// Creates the PRIVATE `upload-audit` bucket used to retain user uploads for
// admin review. Unlike the public `profiles` bucket, this one is private —
// admins view its contents only through short-lived signed URLs. It accepts
// documents (PDF) and media (audio/video), not just images, because it backs
// every upload surface.
//
// Run once per environment:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/create-audit-bucket.ts

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Creating private upload-audit bucket...');

  const { data, error } = await supabase.storage.createBucket('upload-audit', {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm', 'audio/ogg',
      'video/mp4', 'video/quicktime', 'video/webm',
    ],
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Bucket "upload-audit" already exists');
    } else {
      console.error('✗ Error creating bucket:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✓ Created bucket:', data);
  }
}

main().catch(console.error);
