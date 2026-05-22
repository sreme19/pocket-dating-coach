/**
 * refresh-seed-profiles.ts
 *
 * Reads each seed user's preferences.md (female) or personality.md (male)
 * from the static folder and upserts the structured data into ai_assistant_profiles.
 *
 * Run with:
 *   tsx --env-file=.env.local scripts/refresh-seed-profiles.ts
 *
 * Safe to run multiple times — uses upsert.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreferencesProfile {
  emotionalSignals: string[];
  lifestyleSignals: string[];
  maturitySignals: string[];
  boundaries: string[];
  dealbreakers: string[];
  privateCompatibilityNotes: string[];
  updatedAt: number;
}

interface PersonalityProfile {
  communicationStyle: string;
  personalityVibe: string;
  mattersMost: string;
  values: string[];
  datingPatterns: string[];
  redFlagsToAvoid: string[];
  updatedAt: number;
}

// ─── Markdown parsing ─────────────────────────────────────────────────────────

function getSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  let inSection = false;
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.slice(3).trim() === heading) {
        inSection = true;
        continue;
      }
    }
    if (inSection) out.push(line);
  }

  return out.join('\n');
}

function getSubSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  let inSection = false;
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inSection) break;
      if (line.slice(4).trim() === heading) {
        inSection = true;
        continue;
      }
    } else if (line.startsWith('## ') && inSection) {
      break;
    }
    if (inSection) out.push(line);
  }

  return out.join('\n');
}

function bullets(section: string, max = 99): string[] {
  return section
    .split('\n')
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(l => l.length > 4 && !l.startsWith('#') && !l.startsWith('**'))
    .slice(0, max);
}

function firstParagraph(section: string): string {
  return section
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 20 && !p.startsWith('#') && !p.startsWith('-'))[0] ?? '';
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parsePreferences(markdown: string): PreferencesProfile {
  return {
    emotionalSignals: bullets(getSection(markdown, "Green Flags in a Match"), 5),
    lifestyleSignals: bullets(getSubSection(markdown, "Strong preferences"), 5),
    maturitySignals: bullets(getSubSection(markdown, "Non-negotiables"), 4),
    boundaries: bullets(getSection(markdown, "What She's Not Looking For"), 4),
    dealbreakers: bullets(getSection(markdown, "Red Flags"), 5),
    privateCompatibilityNotes: bullets(getSection(markdown, "Notes for Interview"), 5),
    updatedAt: Date.now()
  };
}

function parsePersonality(markdown: string): PersonalityProfile {
  const whoHeIs = getSection(markdown, "Who He Is");
  const greenFlags = bullets(getSection(markdown, "Green Flags"), 5);
  const howHeShows = bullets(getSection(markdown, "How He Shows Up in an Interview"), 3);

  return {
    personalityVibe: firstParagraph(whoHeIs).slice(0, 300),
    communicationStyle: howHeShows[0] ?? greenFlags[0] ?? '',
    mattersMost: bullets(getSection(markdown, "What He's Looking For"), 1)[0] ?? '',
    values: greenFlags,
    datingPatterns: bullets(getSection(markdown, "Yellow Flags"), 4),
    redFlagsToAvoid: bullets(getSection(markdown, "Red Flags"), 5),
    updatedAt: Date.now()
  };
}

// ─── Static folder scan ───────────────────────────────────────────────────────

interface SeedFolder {
  folderName: string;
  firstName: string;
  gender: 'man' | 'woman';
  markdownPath: string;
}

function scanStaticFolders(staticDir: string): SeedFolder[] {
  const result: SeedFolder[] = [];

  for (const gender of ['man', 'woman'] as const) {
    const subDir = gender === 'man' ? 'male_profiles' : 'female_profiles';
    const mdFile = gender === 'man' ? 'personality.md' : 'preferences.md';
    const dir = path.join(staticDir, subDir);

    if (!fs.existsSync(dir)) continue;

    for (const folderName of fs.readdirSync(dir)) {
      const mdPath = path.join(dir, folderName, mdFile);
      if (!fs.existsSync(mdPath)) continue;

      result.push({
        folderName,
        firstName: folderName.split('_')[0].toLowerCase(),
        gender,
        markdownPath: mdPath
      });
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const staticDir = path.join(process.cwd(), 'static');

  console.log('\n' + '='.repeat(60));
  console.log('Refresh Seed Profiles — ai_assistant_profiles');
  console.log('='.repeat(60) + '\n');

  // 1. Fetch all seed users from DB
  const { data: dbUsers, error: fetchError } = await supabase
    .from('verified_vibe_users')
    .select('id, first_name, gender');

  if (fetchError || !dbUsers) {
    console.error('Failed to fetch users:', fetchError?.message);
    process.exit(1);
  }

  console.log(`DB users: ${dbUsers.length}`);

  // 2. Scan static folders
  const folders = scanStaticFolders(staticDir);
  console.log(`Static folders: ${folders.length}\n`);

  // 3. Match by first name (lowercase)
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const folder of folders) {
    const dbUser = dbUsers.find(
      u => u.first_name?.toLowerCase() === folder.firstName &&
           ((u.gender === 'man') === (folder.gender === 'man'))
    );

    if (!dbUser) {
      console.log(`  ? No DB match for ${folder.folderName}`);
      skipped++;
      continue;
    }

    try {
      const markdown = fs.readFileSync(folder.markdownPath, 'utf-8');
      const profileType = folder.gender === 'woman' ? 'preferences' : 'personality';
      const data = folder.gender === 'woman'
        ? parsePreferences(markdown)
        : parsePersonality(markdown);

      // Find existing current version
      const { data: existing } = await supabase
        .from('ai_assistant_profiles')
        .select('id, version')
        .eq('user_id', dbUser.id)
        .eq('profile_type', profileType)
        .eq('is_current', true)
        .maybeSingle();

      const nextVersion = (existing?.version ?? 0) + 1;

      // Mark old version non-current
      if (existing) {
        await supabase
          .from('ai_assistant_profiles')
          .update({ is_current: false })
          .eq('id', existing.id);
      }

      // Insert new current version
      const { error: insertError } = await supabase
        .from('ai_assistant_profiles')
        .insert({
          user_id: dbUser.id,
          profile_type: profileType,
          data,
          version: nextVersion,
          reason: 'Refreshed from static markdown file',
          is_current: true
        });

      if (insertError) {
        console.error(`  ✗ ${dbUser.first_name}: ${insertError.message}`);
        errors++;
        continue;
      }

      console.log(`  ✓ ${dbUser.first_name} (${profileType} v${nextVersion})`);
      updated++;
    } catch (err: any) {
      console.error(`  ✗ ${folder.folderName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone — updated: ${updated}, skipped: ${skipped}, errors: ${errors}\n`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
