import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────
// Parse preferences.md files and structure them as JSON
// ─────────────────────────────────────────────────────────────────────────

interface PreferencesJSON {
  lookingFor: string[];
  nonNegotiables: string[];
  strongPreferences: string[];
  openTo: string[];
  notLookingFor: string[];
  communicationStyle: string[];
  greenFlags: string[];
  yellowFlags: string[];
  redFlags: string[];
  interviewNotes: string;
}

function parsePreferencesMarkdown(markdown: string): PreferencesJSON {
  const prefs: PreferencesJSON = {
    lookingFor: [],
    nonNegotiables: [],
    strongPreferences: [],
    openTo: [],
    notLookingFor: [],
    communicationStyle: [],
    greenFlags: [],
    yellowFlags: [],
    redFlags: [],
    interviewNotes: ''
  };

  // Extract sections based on markdown headers
  const lines = markdown.split('\n');
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers
    if (line.startsWith('### ') || line.startsWith('## ')) {
      const header = line.replace(/^#+\s+/, '').toLowerCase();

      if (header.includes('non-negotiable')) {
        currentSection = 'nonNegotiables';
      } else if (header.includes('strong preference')) {
        currentSection = 'strongPreferences';
      } else if (header.includes('open to')) {
        currentSection = 'openTo';
      } else if (header.includes('not looking for')) {
        currentSection = 'notLookingFor';
      } else if (header.includes('green flag')) {
        currentSection = 'greenFlags';
      } else if (header.includes('yellow flag')) {
        currentSection = 'yellowFlags';
      } else if (header.includes('red flag')) {
        currentSection = 'redFlags';
      } else if (header.includes('communicate')) {
        currentSection = 'communicationStyle';
      } else if (header.includes('interview')) {
        currentSection = 'interviewNotes';
      } else if (header.includes('looking for')) {
        currentSection = 'lookingFor';
      }
    } else if (
      line.startsWith('- ') &&
      (currentSection === 'nonNegotiables' ||
        currentSection === 'strongPreferences' ||
        currentSection === 'openTo' ||
        currentSection === 'notLookingFor' ||
        currentSection === 'greenFlags' ||
        currentSection === 'yellowFlags' ||
        currentSection === 'redFlags' ||
        currentSection === 'communicationStyle')
    ) {
      const item = line.replace(/^- /, '').trim();
      if (item && !item.startsWith('**')) {
        prefs[currentSection as keyof PreferencesJSON].push(item);
      }
    } else if (currentSection === 'interviewNotes' && line && !line.startsWith('#')) {
      if (prefs.interviewNotes) {
        prefs.interviewNotes += ' ' + line;
      } else {
        prefs.interviewNotes = line;
      }
    }
  }

  return prefs;
}

function getProfileIdFromFolder(
  folderName: string,
  staticDir: string,
  gender: 'man' | 'woman'
): string | null {
  const genderDir = gender === 'man' ? 'male_profiles' : 'female_profiles';
  const profileJsonPath = path.join(staticDir, genderDir, folderName, 'profile.json');

  if (!fs.existsSync(profileJsonPath)) {
    return null;
  }

  try {
    const profileJson = JSON.parse(fs.readFileSync(profileJsonPath, 'utf-8'));
    return profileJson.id || null;
  } catch {
    return null;
  }
}

async function seedPreferences() {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const staticDir = path.join(process.cwd(), 'static');

  // Find all female profile folders
  const femaleDir = path.join(staticDir, 'female_profiles');
  if (!fs.existsSync(femaleDir)) {
    console.error('❌ female_profiles directory not found');
    process.exit(1);
  }

  const folders = fs.readdirSync(femaleDir);
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const folder of folders) {
    const preferencesPath = path.join(femaleDir, folder, 'preferences.md');

    if (!fs.existsSync(preferencesPath)) {
      console.warn(`⚠ No preferences.md for ${folder}`);
      skipCount++;
      continue;
    }

    // Get profile ID from profile.json
    const profileId = getProfileIdFromFolder(folder, staticDir, 'woman');
    if (!profileId) {
      console.warn(`⚠ Could not find profile ID for ${folder}`);
      skipCount++;
      continue;
    }

    try {
      // Parse preferences markdown
      const markdown = fs.readFileSync(preferencesPath, 'utf-8');
      const preferences = parsePreferencesMarkdown(markdown);

      // Update the database
      const { error } = await supabase
        .from('verified_vibe_users')
        .update({ preferences })
        .eq('id', profileId);

      if (error) {
        console.error(`✗ Failed to update preferences for ${folder}:`, error.message);
        errorCount++;
      } else {
        console.log(`✓ Updated preferences for ${folder}`);
        successCount++;
      }
    } catch (e: any) {
      console.error(`✗ Error processing ${folder}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  ✓ Updated: ${successCount}`);
  console.log(`  ⚠ Skipped: ${skipCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);
}

seedPreferences().catch(console.error);
