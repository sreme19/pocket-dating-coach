/**
 * generate-about-bios.ts
 *
 * Reads each seed user's personality.md (male) or preferences.md (female),
 * uses Claude to write a first-person dating profile bio (≤500 chars),
 * then updates the `about` column in verified_vibe_users.
 *
 * Run with:
 *   tsx --env-file=.env.local scripts/generate-about-bios.ts
 *
 * Flags:
 *   --dry-run    Print generated bios without writing to DB
 *   --name=luca  Only process the user whose first name matches
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NAME_FILTER = args.find(a => a.startsWith('--name='))?.split('=')[1]?.toLowerCase();

// ─── Bio generation ──────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function generateBio(
  firstName: string,
  gender: 'man' | 'woman',
  markdown: string
): Promise<string> {
  const persona = gender === 'man' ? 'man' : 'woman';
  const sourceLabel = gender === 'man' ? 'personality profile' : 'dating preferences profile';

  const prompt = `You are writing a first-person dating app bio for ${firstName}, a ${persona}.

Here is their ${sourceLabel}:

${markdown.slice(0, 3000)}

---

Write their dating profile "About Me" bio in the FIRST PERSON (as if ${firstName} wrote it themselves).

Rules:
- Maximum 500 characters (including spaces) — count carefully, this is strict
- First person: "I", "I'm", "I love" — never "She/He"
- Capture their genuine personality and what makes them interesting
- Hint at what they're looking for without being clinical or listing requirements
- Sound like a real person, not a marketing pitch
- Warm, authentic, slightly witty if it fits their character
- No emojis unless it genuinely fits their vibe
- No hashtags, no clichés like "love to laugh" or "fluent in sarcasm"

Return ONLY the bio text, no quotes, no labels, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  let bio = (response.content[0] as { type: string; text: string }).text.trim();

  // Strip any accidental markdown fences Claude might add
  bio = bio.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();

  // Hard cap at 500 chars — trim at last sentence boundary if possible
  if (bio.length > 500) {
    const trimmed = bio.slice(0, 500);
    const lastPeriod = trimmed.lastIndexOf('.');
    const lastBang = trimmed.lastIndexOf('!');
    const lastQuestion = trimmed.lastIndexOf('?');
    const sentenceEnd = Math.max(lastPeriod, lastBang, lastQuestion);
    bio = sentenceEnd > 400 ? trimmed.slice(0, sentenceEnd + 1) : trimmed.trimEnd();
  }

  return bio;
}

// ─── Static folder scan ───────────────────────────────────────────────────────

interface ProfileFolder {
  folderName: string;
  firstName: string;
  gender: 'man' | 'woman';
  markdownPath: string;
}

function scanFolders(staticDir: string): ProfileFolder[] {
  const result: ProfileFolder[] = [];

  for (const gender of ['man', 'woman'] as const) {
    const subDir = gender === 'man' ? 'male_profiles' : 'female_profiles';
    const mdFile = gender === 'man' ? 'personality.md' : 'preferences.md';
    const dir = path.join(staticDir, subDir);

    if (!fs.existsSync(dir)) continue;

    for (const folderName of fs.readdirSync(dir).sort()) {
      const mdPath = path.join(dir, folderName, mdFile);
      if (!fs.existsSync(mdPath)) continue;

      const firstName = folderName.split('_')[0].toLowerCase();

      if (NAME_FILTER && firstName !== NAME_FILTER) continue;

      result.push({ folderName, firstName, gender, markdownPath: mdPath });
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
  const anthropicKey = process.env.ANTHROPIC_API_KEY!;

  if (!supabaseUrl || !serviceKey) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  if (!anthropicKey) {
    console.error('✗ Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const staticDir = path.join(process.cwd(), 'static');

  const mode = DRY_RUN ? ' [DRY RUN]' : '';
  const filter = NAME_FILTER ? ` [filter: ${NAME_FILTER}]` : '';
  console.log('\n' + '='.repeat(62));
  console.log(`🖊  Generate About Bios${mode}${filter}`);
  console.log('='.repeat(62) + '\n');

  // Fetch all users so we can match by first_name + gender
  const { data: dbUsers, error: fetchErr } = await supabase
    .from('verified_vibe_users')
    .select('id, first_name, gender, about');

  if (fetchErr || !dbUsers) {
    console.error('✗ Failed to fetch users:', fetchErr?.message);
    process.exit(1);
  }

  const folders = scanFolders(staticDir);
  console.log(`Found ${folders.length} profile folder(s) to process\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const folder of folders) {
    const dbUser = dbUsers.find(
      u =>
        u.first_name?.toLowerCase() === folder.firstName &&
        u.gender === folder.gender
    );

    if (!dbUser) {
      console.log(`  ? No DB row for ${folder.folderName} — skipping`);
      skipped++;
      continue;
    }

    try {
      const markdown = fs.readFileSync(folder.markdownPath, 'utf-8');

      process.stdout.write(
        `  ✍  ${dbUser.first_name.padEnd(12)} (${folder.gender}) — generating... `
      );

      const bio = await generateBio(folder.firstName, folder.gender, markdown);

      console.log(`${bio.length} chars`);
      console.log(`     "${bio}"\n`);

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('verified_vibe_users')
          .update({ about: bio, updated_at: new Date().toISOString() })
          .eq('id', dbUser.id);

        if (updateErr) {
          console.error(`     ✗ DB update failed: ${updateErr.message}`);
          errors++;
          continue;
        }
      }

      updated++;
    } catch (err: any) {
      console.error(`\n  ✗ ${folder.folderName}: ${err.message}`);
      errors++;
    }
  }

  console.log('─'.repeat(62));
  console.log(
    `✓ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}   Skipped: ${skipped}   Errors: ${errors}`
  );
  if (DRY_RUN) {
    console.log('\n  Run without --dry-run to write bios to the database.');
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
