/**
 * POST /api/verified-vibe/proof-upload
 *
 * Accepts uploaded proof images for Show-Off / Proof Connection categories.
 * Sends them to Claude Vision, which returns a structured insight label.
 * If verified, the result is returned to the client to persist in localStorage
 * (and best-effort to verified_vibe_verification table).
 *
 * Categories: lifestyle | hosting | discipline | social_proof | linkedin | habit_tracker
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-6';

// ── Per-category Claude prompts ───────────────────────────────────────────────

const PROMPTS: Record<string, string> = {
  lifestyle: `You are reviewing proof for a dating-app profile section called "Show-Off: Lifestyle".
Analyse the image(s). Do they provide GENUINE evidence of an active, quality lifestyle?
(luxury travel, fine dining, quality events, premium experiences, hotel stays, flights, concerts, etc.)

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words, e.g. 'Business-class traveler'","insight_emoji":"single emoji","confidence":0.0-1.0,"reason":"one sentence"}`,

  hosting: `You are reviewing proof for a dating-app profile section called "Show-Off: Hosting".
Analyse the image(s). Do they provide GENUINE evidence the user hosts dinners, celebrations, or gatherings?
(home dinner parties, table setups, group celebrations, restaurant reservations for groups, etc.)

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words, e.g. 'Hosts dinner parties'","insight_emoji":"single emoji","confidence":0.0-1.0,"reason":"one sentence"}`,

  discipline: `You are reviewing proof for a dating-app profile section called "Show-Off: Discipline".
Analyse the image(s). Do they provide GENUINE evidence of personal discipline / consistent healthy routines?
(gym sessions, fitness tracking, reading streaks, sleep tracking, learning logs, etc.)

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words, e.g. 'Consistent gym goer'","insight_emoji":"single emoji","confidence":0.0-1.0,"reason":"one sentence"}`,

  social_proof: `You are reviewing proof for a dating-app profile section called "Show-Off: Social Proof".
Analyse the image(s). Do they show GENUINE evidence of real friendships, social activities, or community involvement?
(group outings, friend gatherings, sports teams, clubs, community events, etc.)

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words, e.g. 'Active social circle'","insight_emoji":"single emoji","confidence":0.0-1.0,"reason":"one sentence"}`,

  linkedin: `You are reviewing a LinkedIn profile screenshot for a dating-app verification step.
Does this screenshot show a GENUINE, established LinkedIn profile with clear work history and professional identity?

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words based on their role, e.g. 'Tech industry professional'","insight_emoji":"💼","confidence":0.0-1.0,"reason":"one sentence"}`,

  habit_tracker: `You are reviewing a habit-tracker screenshot for a dating-app verification step.
Does this screenshot show GENUINE consistent habit tracking (gym, sleep, reading, wellness) with meaningful streaks or data?

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insight_label":"3-5 words, e.g. 'Daily fitness tracker'","insight_emoji":"📊","confidence":0.0-1.0,"reason":"one sentence"}`,
};

const CATEGORY_PTS: Record<string, number> = {
  lifestyle:    8,
  hosting:      6,
  discipline:   4,
  social_proof: 4,
  linkedin:     5,
  habit_tracker: 2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const category = (formData.get('category') as string | null)?.trim() ?? '';
    const files    = formData.getAll('files') as File[];

    if (!PROMPTS[category]) {
      return json({ error: `Unknown category: ${category}` }, { status: 400 });
    }
    if (files.length === 0) {
      return json({ error: 'At least one file is required' }, { status: 400 });
    }

    const pts = CATEGORY_PTS[category] ?? 4;

    // ── Dev mode bypass ───────────────────────────────────────────────────────
    if (import.meta.env.VITE_SKIP_VERIFICATION === 'true') {
      const MOCK: Record<string, { label: string; emoji: string }> = {
        lifestyle:    { label: 'International traveler',  emoji: '✈️' },
        hosting:      { label: 'Hosts dinner parties',    emoji: '🍽️' },
        discipline:   { label: 'Consistent gym goer',     emoji: '💪' },
        social_proof: { label: 'Active social circle',    emoji: '🤝' },
        linkedin:     { label: 'Tech industry pro',       emoji: '💼' },
        habit_tracker:{ label: 'Daily habit tracker',     emoji: '📊' },
      };
      const m = MOCK[category];
      return json({ verified: true, insight_label: m.label, insight_emoji: m.emoji, pts_awarded: pts, confidence: 0.95, reason: 'Dev mode — bypass active' });
    }

    // ── Convert files to base64 image blocks ──────────────────────────────────
    const imageBlocks: object[] = [];
    for (const file of files.slice(0, 3)) {
      if (!file.type.startsWith('image/')) continue; // skip non-images
      const buf    = await file.arrayBuffer();
      const b64    = Buffer.from(buf).toString('base64');
      const mime   = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
    }

    if (imageBlocks.length === 0) {
      return json({ error: 'No valid images found (JPEG/PNG/WEBP only)' }, { status: 400 });
    }

    // ── Call Claude Vision ────────────────────────────────────────────────────
    const claudeResp = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: PROMPTS[category] }
          ]
        }]
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!claudeResp.ok) {
      console.error('Claude API error:', claudeResp.status, await claudeResp.text());
      return json({ error: 'Vision API unavailable — try again' }, { status: 503 });
    }

    const claudeData = await claudeResp.json();
    const rawText    = (claudeData.content?.[0]?.text ?? '{}') as string;

    // Strip accidental code-fence wrapping (Claude 4.x sometimes adds them)
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let result: { verified?: boolean; insight_label?: string; insight_emoji?: string; confidence?: number; reason?: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error('Claude returned non-JSON:', cleaned);
      return json({ error: 'Analysis returned unexpected format' }, { status: 500 });
    }

    const verified = result.verified === true;

    // ── Best-effort DB persist ────────────────────────────────────────────────
    if (verified) {
      const userId = await getUserIdFromRequest(request);
      if (userId) {
        try {
          const supabase = getSupabase();
          await (supabase as any)
            .from('verified_vibe_verification')
            .upsert(
              {
                user_id:      userId,
                step:         `proof_${category}`,
                status:       'completed',
                data:         {
                  insight_label: result.insight_label,
                  insight_emoji: result.insight_emoji,
                  confidence:    result.confidence,
                  reason:        result.reason,
                  pts_awarded:   pts,
                },
                completed_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,step' }
            );
        } catch (e) {
          // Non-fatal — client will persist in localStorage as fallback
          console.warn('proof-upload DB persist failed (non-fatal):', e);
        }
      }
    }

    return json({
      verified,
      insight_label: result.insight_label ?? 'Proof reviewed',
      insight_emoji: result.insight_emoji ?? '✅',
      pts_awarded:   verified ? pts : 0,
      confidence:    result.confidence ?? 0,
      reason:        result.reason ?? '',
    });

  } catch (error) {
    console.error('proof-upload handler error:', error);
    return json({ error: 'Failed to analyse proof — try again' }, { status: 500 });
  }
};
