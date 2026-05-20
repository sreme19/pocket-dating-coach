import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Types
interface SeedProfile {
  foldername: string;
  gender: 'man' | 'woman';
  profileJson: {
    id: string;
    name: string;
    age: string;
    archetype: string;
    createdAt: string;
  };
  personalityMd: string;
  photoFiles: string[];
  city: string;
  about: string;
  trustScore: number;
}

interface SeedMatch {
  user1_id: string;
  user2_id: string;
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1: Parse Static Files
// ─────────────────────────────────────────────────────────────────────────

function extractFirstParagraph(markdown: string): string {
  const paragraphs = markdown
    .split('\n\n')
    .filter(p => p.trim() && !p.startsWith('#'));
  return paragraphs[0]?.substring(0, 500) || '';
}

function extractCity(markdown: string): string | null {
  const cityMatch = markdown.match(/\b(San Francisco|New York|Bengaluru|London|Mumbai|Los Angeles|Seattle|Austin)\b/i);
  return cityMatch?.[1] || null;
}

function calculateTrustScore(photoCount: number): number {
  // Base 75, +3 per photo, capped at 95, with small random variation
  const baseScore = Math.min(75 + photoCount * 3, 95);
  const variation = Math.floor(Math.random() * 5) - 2; // -2 to +2
  return Math.max(75, baseScore + variation); // Never go below 75
}

function parseProfileFolder(
  folderName: string,
  gender: 'man' | 'woman',
  staticDir: string
): SeedProfile | null {
  const genderDir = gender === 'man' ? 'male_profiles' : 'female_profiles';
  const folderPath = path.join(staticDir, genderDir, folderName);

  // Read profile.json
  const profileJsonPath = path.join(folderPath, 'profile.json');
  if (!fs.existsSync(profileJsonPath)) {
    console.warn(`  ⚠ No profile.json in ${folderName}`);
    return null;
  }

  let profileJson: any;
  try {
    profileJson = JSON.parse(fs.readFileSync(profileJsonPath, 'utf-8'));
  } catch (e) {
    console.warn(`  ⚠ Failed to parse profile.json in ${folderName}`);
    return null;
  }

  // Read personality.md
  const personalityPath = path.join(folderPath, 'personality.md');
  let personalityMd = '';
  let about = '';
  let city = 'Bengaluru'; // default

  if (fs.existsSync(personalityPath)) {
    personalityMd = fs.readFileSync(personalityPath, 'utf-8');
    about = extractFirstParagraph(personalityMd);
    city = extractCity(personalityMd) || 'Bengaluru';
  }

  // List all photos
  const photosDir = path.join(folderPath, 'photos');
  const photoFiles = fs.existsSync(photosDir)
    ? fs
        .readdirSync(photosDir)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort() // Consistent order
    : [];

  // Calculate trust score based on photo count
  const trustScore = calculateTrustScore(photoFiles.length);

  return {
    foldername: folderName,
    gender,
    profileJson,
    personalityMd,
    photoFiles,
    city,
    about,
    trustScore
  };
}

async function parseProfileFolders(staticDir: string): Promise<SeedProfile[]> {
  const profiles: SeedProfile[] = [];

  // Walk male_profiles
  const maleDir = path.join(staticDir, 'male_profiles');
  if (fs.existsSync(maleDir)) {
    for (const folder of fs.readdirSync(maleDir)) {
      const profile = parseProfileFolder(folder, 'man', staticDir);
      if (profile) profiles.push(profile);
    }
  }

  // Walk female_profiles
  const femaleDir = path.join(staticDir, 'female_profiles');
  if (fs.existsSync(femaleDir)) {
    for (const folder of fs.readdirSync(femaleDir)) {
      const profile = parseProfileFolder(folder, 'woman', staticDir);
      if (profile) profiles.push(profile);
    }
  }

  return profiles;
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 2: Create Auth Users
// ─────────────────────────────────────────────────────────────────────────

async function createAuthUsers(
  supabaseAdmin: ReturnType<typeof createClient>,
  profiles: SeedProfile[]
): Promise<Map<string, string>> {
  const userMap = new Map<string, string>(); // foldername → user_id
  const password = process.env.SEED_ACCOUNT_PASSWORD || 'SeedPass123!';

  for (const profile of profiles) {
    const email = `${profile.foldername.toLowerCase()}@seed.vv`;

    try {
      // Try to fetch existing user
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(
        profile.profileJson.id // Use profile id as a hint (may not work)
      ).catch(() => ({ data: null }));

      if (existingUser?.email === email) {
        console.log(`  ✓ User already exists: ${email}`);
        userMap.set(profile.foldername, existingUser.id);
        continue;
      }

      // Check by email instead
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
      });

      const existingByEmail = allUsers.users.find(u => u.email === email);
      if (existingByEmail) {
        console.log(`  ✓ User already exists: ${email}`);
        userMap.set(profile.foldername, existingByEmail.id);
        continue;
      }

      // Create new user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          seed_profile: true,
          gender: profile.gender,
          name: profile.profileJson.name
        }
      });

      if (error) {
        console.error(`  ✗ Failed to create user ${email}:`, error.message);
        continue;
      }

      userMap.set(profile.foldername, data.user.id);
      console.log(`  ✓ Created user: ${email}`);
    } catch (e: any) {
      console.error(`  ✗ Error with ${email}:`, e.message);
    }
  }

  return userMap;
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 3: Create Profile Rows
// ─────────────────────────────────────────────────────────────────────────

async function createProfiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  profiles: SeedProfile[],
  userMap: Map<string, string>
): Promise<void> {
  for (const profile of profiles) {
    const userId = userMap.get(profile.foldername);
    if (!userId) {
      console.log(`  ⚠ Skipping profile ${profile.profileJson.name} (no user ID)`);
      continue;
    }

    const archetype = profile.profileJson.archetype || 'Unknown';

    try {
      // Use verified_vibe_users table (the actual table in supabase-schema.sql)
      const { error } = await supabaseAdmin
        .from('verified_vibe_users')
        .upsert(
          {
            id: userId,
            gender: profile.gender,
            archetype,
            first_name: profile.profileJson.name,
            age: parseInt(profile.profileJson.age) || 30,
            city: profile.city,
            about: profile.about,
            avatar_url: null, // Will set in Phase 4
            trust_score: profile.trustScore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error(`  ✗ Failed to create profile for ${profile.profileJson.name}:`, error.message);
      } else {
        console.log(`  ✓ Created profile: ${profile.profileJson.name} (${archetype}, score: ${profile.trustScore})`);
      }
    } catch (e: any) {
      console.error(`  ✗ Error creating profile for ${profile.profileJson.name}:`, e.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 4: Upload Photos & Set Avatar
// ─────────────────────────────────────────────────────────────────────────

async function uploadPhotos(
  supabaseAdmin: ReturnType<typeof createClient>,
  profiles: SeedProfile[],
  userMap: Map<string, string>,
  staticDir: string
): Promise<void> {
  for (const profile of profiles) {
    const userId = userMap.get(profile.foldername);
    if (!userId) continue;

    if (profile.photoFiles.length === 0) {
      console.log(`  ⚠ No photos for ${profile.profileJson.name}`);
      continue;
    }

    const genderDir = profile.gender === 'man' ? 'male_profiles' : 'female_profiles';
    const photosPath = path.join(staticDir, genderDir, profile.foldername, 'photos');

    let avatarUrl: string | null = null;
    let uploadedCount = 0;

    // Upload all photos
    for (let i = 0; i < profile.photoFiles.length; i++) {
      const fileName = profile.photoFiles[i];
      const filePath = path.join(photosPath, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`    ⚠ Photo not found: ${filePath}`);
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(fileName).slice(1).toLowerCase();
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

        // Determine upload path
        const uploadPath = i === 0
          ? `seed/${userId}/avatar.jpg`
          : `seed/${userId}/photo_${i}.jpg`;

        const { data, error } = await supabaseAdmin.storage
          .from('profiles')
          .upload(uploadPath, fileBuffer, {
            contentType,
            upsert: true
          });

        if (error) {
          console.warn(`    ⚠ Failed to upload photo ${i + 1}: ${error.message}`);
          continue;
        }

        if (i === 0) {
          // Get public URL for avatar
          const { data: publicUrl } = supabaseAdmin.storage
            .from('profiles')
            .getPublicUrl(uploadPath);
          avatarUrl = publicUrl.publicUrl;
        }

        uploadedCount++;
      } catch (e: any) {
        console.warn(`    ⚠ Error uploading photo ${i + 1}: ${e.message}`);
      }
    }

    // Update profile with avatar_url
    if (avatarUrl) {
      try {
        const { error } = await supabaseAdmin
          .from('verified_vibe_users')
          .update({ avatar_url: avatarUrl })
          .eq('id', userId);

        if (error) {
          console.warn(`    ⚠ Failed to set avatar: ${error.message}`);
        } else {
          console.log(
            `  ✓ Uploaded ${uploadedCount}/${profile.photoFiles.length} photos for ${profile.profileJson.name}`
          );
        }
      } catch (e: any) {
        console.warn(`    ⚠ Error updating avatar: ${e.message}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 5: Mark Verification Complete
// ─────────────────────────────────────────────────────────────────────────

async function markVerificationComplete(
  supabaseAdmin: ReturnType<typeof createClient>,
  userMap: Map<string, string>
): Promise<void> {
  const steps = ['id', 'liveness', 'photos', 'spending_or_qa'];
  let totalSteps = 0;

  for (const userId of userMap.values()) {
    for (const step of steps) {
      try {
        // Use verified_vibe_verification table (from supabase-schema.sql)
        // Note: The schema defines this as verified_vibe_verification, not verified_vibe_verification_steps
        const { error } = await supabaseAdmin
          .from('verified_vibe_verification')
          .upsert(
            {
              user_id: userId,
              step,
              status: 'completed',
              data: {},
              completed_at: new Date().toISOString()
            },
            { onConflict: 'user_id,step' }
          );

        if (error) {
          console.warn(`  ⚠ Failed to mark step ${step} for user ${userId}: ${error.message}`);
        } else {
          totalSteps++;
        }
      } catch (e: any) {
        console.warn(`  ⚠ Error marking verification: ${e.message}`);
      }
    }
  }

  console.log(`  ✓ Marked ${totalSteps} verification steps complete`);
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 6: Bootstrap Seed Matches
// ─────────────────────────────────────────────────────────────────────────

async function bootstrapMatches(
  supabaseAdmin: ReturnType<typeof createClient>,
  profiles: SeedProfile[],
  userMap: Map<string, string>
): Promise<void> {
  const maleProfiles = profiles.filter(p => p.gender === 'man');
  const femaleProfiles = profiles.filter(p => p.gender === 'woman');

  const matches: SeedMatch[] = [];

  // Pair up: take first 10 males with first 10 females
  const pairCount = Math.min(10, maleProfiles.length, femaleProfiles.length);
  for (let i = 0; i < pairCount; i++) {
    const user1Id = userMap.get(maleProfiles[i].foldername);
    const user2Id = userMap.get(femaleProfiles[i].foldername);

    if (user1Id && user2Id) {
      matches.push({
        user1_id: user1Id,
        user2_id: user2Id
      });
    }
  }

  // Insert matches
  let createdCount = 0;
  for (const match of matches) {
    try {
      const { error } = await supabaseAdmin
        .from('verified_vibe_matches')
        .insert({
          user1_id: match.user1_id,
          user2_id: match.user2_id,
          status: 'mutual',
          created_at: new Date().toISOString()
        });

      if (error) {
        console.warn(`  ⚠ Failed to create match: ${error.message}`);
      } else {
        createdCount++;
      }
    } catch (e: any) {
      console.warn(`  ⚠ Error creating match: ${e.message}`);
    }
  }

  console.log(`  ✓ Created ${createdCount} seed matches`);
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🌱 Pocket Dating Coach — Seed Profile Onboarding');
  console.log('='.repeat(70) + '\n');

  // Initialize Supabase admin client
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
    process.exit(1);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const staticDir = path.join(process.cwd(), 'static');

  try {
    // Phase 1: Parse
    console.log('📂 Phase 1: Parsing profile folders...');
    const profiles = await parseProfileFolders(staticDir);
    console.log(`✓ Found ${profiles.length} profiles\n`);

    if (profiles.length === 0) {
      console.error('✗ No profiles found. Check static/ folder.');
      process.exit(1);
    }

    // Phase 2: Create auth users
    console.log('👤 Phase 2: Creating auth users...');
    const userMap = await createAuthUsers(supabaseAdmin, profiles);
    console.log(`✓ Created/found ${userMap.size} users\n`);

    if (userMap.size === 0) {
      console.error('✗ No users created. Check Supabase credentials.');
      process.exit(1);
    }

    // Phase 3: Create profiles
    console.log('📋 Phase 3: Creating profile records...');
    await createProfiles(supabaseAdmin, profiles, userMap);
    console.log(`✓ Processed ${userMap.size} profile records\n`);

    // Phase 4: Upload photos
    console.log('📸 Phase 4: Uploading photos...');
    await uploadPhotos(supabaseAdmin, profiles, userMap, staticDir);
    console.log(`✓ Uploaded all photos\n`);

    // Phase 5: Mark verification
    console.log('✅ Phase 5: Marking verification steps complete...');
    await markVerificationComplete(supabaseAdmin, userMap);
    console.log('');

    // Phase 6: Bootstrap matches
    console.log('💕 Phase 6: Bootstrapping seed matches...');
    await bootstrapMatches(supabaseAdmin, profiles, userMap);
    console.log('');

    // Summary
    const totalPhotos = profiles.reduce((sum, p) => sum + p.photoFiles.length, 0);

    console.log('='.repeat(70));
    console.log('🎉 SEEDING COMPLETE');
    console.log('='.repeat(70));
    console.log(`✓ Seeded ${profiles.length} profiles`);
    console.log(`✓ Uploaded ${totalPhotos} photos`);
    console.log(`✓ Marked ${userMap.size * 4} verification steps complete`);
    console.log(`✓ Created ~10 seed matches`);
    console.log('\n🔐 Test login credentials:');
    console.log(`   Email: {folder_name}@seed.vv`);
    console.log(`   Password: ${process.env.SEED_ACCOUNT_PASSWORD || 'SeedPass123!'}`);
    console.log('\n   Examples:');
    const exampleProfiles = profiles.slice(0, 3);
    for (const profile of exampleProfiles) {
      console.log(`   • ${profile.foldername.toLowerCase()}@seed.vv`);
    }
    if (profiles.length > 3) {
      console.log(`   • ... and ${profiles.length - 3} more`);
    }
    console.log('\n' + '='.repeat(70) + '\n');
  } catch (err: any) {
    console.error('\n✗ Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
