/**
 * upload-profile-photos.ts
 *
 * Uploads photos for specific profiles to Supabase Storage and sets avatar_url.
 * Handles .avif files (which the main seed script skips).
 *
 * Run with:
 *   tsx --env-file=.env.local scripts/upload-profile-photos.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const TARGET_PROFILES = [
  'rohan_Family_Pressure_Registrant_t6f3xp',
  'tyler_Nice_Guy_Overextended_h7b5nk',
  'victor_Sugar_Daddy_e6p4rl',
];

// .avif excluded — Supabase Storage rejects image/avif; convert to jpg first
const PHOTO_FILTER = /\.(jpg|jpeg|png|webp)$/i;

function getContentType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  return map[ext.toLowerCase()] ?? 'image/jpeg';
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const staticDir = path.join(process.cwd(), 'static');

  console.log('\n' + '='.repeat(50));
  console.log('Upload Profile Photos');
  console.log('='.repeat(50) + '\n');

  // Fetch all auth users once
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error('Failed to list auth users:', listError.message);
    process.exit(1);
  }

  for (const folderName of TARGET_PROFILES) {
    console.log(`\n── ${folderName}`);

    const photosDir = path.join(staticDir, 'male_profiles', folderName, 'photos');

    if (!fs.existsSync(photosDir)) {
      console.log('  ⚠ No photos directory found');
      continue;
    }

    const photoFiles = fs.readdirSync(photosDir)
      .filter(f => PHOTO_FILTER.test(f))
      .sort();

    if (photoFiles.length === 0) {
      console.log('  ⚠ No supported photos found (jpg/jpeg/png/webp/avif)');
      continue;
    }

    console.log(`  Photos: ${photoFiles.join(', ')}`);

    // Look up auth user by seed email convention
    const email = `${folderName.toLowerCase()}@seed.vv`;
    const authUser = users.find(u => u.email === email);

    if (!authUser) {
      console.log(`  ⚠ No auth user for ${email} — run seed-profiles.ts first`);
      continue;
    }

    const userId = authUser.id;
    console.log(`  User ID: ${userId}`);

    let avatarUrl: string | null = null;
    let uploadedCount = 0;

    for (let i = 0; i < photoFiles.length; i++) {
      const fileName = photoFiles[i];
      const filePath = path.join(photosDir, fileName);
      const ext = path.extname(fileName).slice(1).toLowerCase();
      const contentType = getContentType(ext);

      // Always store as avatar.jpg / photo_N.jpg regardless of source extension
      const uploadPath = i === 0
        ? `seed/${userId}/avatar.jpg`
        : `seed/${userId}/photo_${i}.jpg`;

      const fileBuffer = fs.readFileSync(filePath);

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(uploadPath, fileBuffer, { contentType, upsert: true });

      if (uploadError) {
        console.warn(`    ⚠ Failed to upload ${fileName}: ${uploadError.message}`);
        continue;
      }

      if (i === 0) {
        const { data: urlData } = supabase.storage
          .from('profiles')
          .getPublicUrl(uploadPath);
        avatarUrl = urlData.publicUrl;
        console.log(`    ✓ avatar → ${fileName}`);
      } else {
        console.log(`    ✓ photo_${i} → ${fileName}`);
      }

      uploadedCount++;
    }

    if (!avatarUrl) {
      console.log('  ⚠ No avatar URL — skipping DB update');
      continue;
    }

    const { error: updateError } = await supabase
      .from('verified_vibe_users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error(`  ✗ Failed to update avatar_url: ${updateError.message}`);
    } else {
      console.log(`  ✓ avatar_url set (${uploadedCount}/${photoFiles.length} photos uploaded)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Done!');
  console.log('='.repeat(50) + '\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
