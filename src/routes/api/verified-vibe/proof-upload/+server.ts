/**
 * POST /api/verified-vibe/proof-upload
 *
 * Analyses proof uploads per Show-Off / Proof Connection category via Claude Vision.
 * Returns an array of insights (up to 5) so the boost tab can list them individually.
 *
 * Categories: lifestyle | hosting | discipline | social_proof |
 *             linkedin  | instagram | twitter | habit_tracker | intro
 *
 * Special handling:
 *  - intro:     audio/video — auto-verified, no Vision call
 *  - linkedin:  accepts profile_url (FormData field) for URL-only verification
 *               AND/OR image screenshot / PDF (PDF treated as auto-verified intent)
 *  - instagram, twitter: same — URL-only auto-verifies; screenshot runs Vision
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-6';

// ── Per-category prompts (all return insights array) ─────────────────────────

const PROMPTS: Record<string, string> = {
  lifestyle: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Lifestyle" section.
Analyse ALL the images. Look for distinct lifestyle signals: luxury travel, fine dining, premium experiences, events, hotels, flights, etc.
Extract UP TO 5 specific insights — one per distinct lifestyle signal you can confirm.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Business-class traveler'","emoji":"single emoji"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  hosting: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Hosting" section.
Analyse ALL images. Look for evidence of hosting dinners, celebrations, gatherings.
Extract UP TO 5 distinct hosting signals.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Hosts dinner parties'","emoji":"single emoji"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  discipline: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Discipline" section.
Analyse ALL images. Look for gym sessions, fitness tracking, reading streaks, sleep data, learning logs.
Extract UP TO 5 distinct discipline signals.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Consistent gym goer'","emoji":"single emoji"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  social_proof: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Social Proof" section.
Analyse ALL images. Look for real friendships, social activities, group events, community involvement.
Extract UP TO 5 distinct social signals.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Active social circle'","emoji":"single emoji"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  linkedin: `You are reviewing a LinkedIn profile screenshot or a CV/resume for a dating-app career verification step.
Does this show a GENUINE established professional with clear work history?
Extract 1–2 insights about their role and career.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Senior software engineer'","emoji":"💼"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  instagram: `You are reviewing an Instagram profile screenshot for a dating-app social verification step.
Does this show a GENUINE, active Instagram account with real social activity?
Extract 1–2 insights about their social personality.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Active lifestyle sharer'","emoji":"📸"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  twitter: `You are reviewing a Twitter/X profile screenshot for a dating-app social verification step.
Does this show a GENUINE, active account with real engagement and interests?
Extract 1–2 insights.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Tech community voice'","emoji":"🐦"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  habit_tracker: `You are reviewing a habit-tracker screenshot for a dating-app verification step.
Does this show GENUINE consistent habit tracking with meaningful streaks or data?
Extract 1–2 insights.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Daily fitness tracker'","emoji":"📊"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,
};

// intro + URL-only social categories are auto-verified without Vision
const AUTO_VERIFY = '__auto_verify__';
PROMPTS['intro'] = AUTO_VERIFY;

const CATEGORY_PTS: Record<string, number> = {
  lifestyle:    8,
  hosting:      6,
  discipline:   4,
  social_proof: 4,
  linkedin:     5,
  instagram:    3,
  twitter:      2,
  habit_tracker: 2,
  intro:        8,
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
  } catch { return null; }
}

async function persistInsight(userId: string, category: string, pts: number, data: object) {
  try {
    const supabase = getSupabase();
    await (supabase as any)
      .from('verified_vibe_verification')
      .upsert(
        { user_id: userId, step: `proof_${category}`, status: 'completed', data, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,step' }
      );
  } catch (e) { console.warn(`proof-upload DB persist failed (${category}):`, e); }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData   = await request.formData();
    const category   = (formData.get('category') as string | null)?.trim() ?? '';
    const profileUrl = (formData.get('profile_url') as string | null)?.trim() ?? '';
    const files      = formData.getAll('files') as File[];

    if (!PROMPTS[category]) {
      return json({ error: `Unknown category: ${category}` }, { status: 400 });
    }

    const pts = CATEGORY_PTS[category] ?? 4;

    // ── 1. Voice/video intro → auto-verify ───────────────────────────────────
    if (PROMPTS[category] === AUTO_VERIFY) {
      const hasAudio = files.some(f => f.type.startsWith('audio/'));
      const hasVideo = files.some(f => f.type.startsWith('video/'));
      const label = hasAudio && hasVideo ? 'Voice & video intro'
                  : hasAudio             ? 'Voice intro recorded'
                  : hasVideo             ? 'Video intro recorded'
                  :                        'Intro uploaded';
      const insights = [{ label, emoji: hasVideo ? '🎥' : '🎙️' }];
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, pts_awarded: pts });
      return json({ verified: true, insights, pts_awarded: pts, photo_count: files.length, confidence: 1.0, reason: 'Intro files accepted' });
    }

    // ── 2. URL-only verification (no files) ───────────────────────────────────
    if (profileUrl && files.length === 0) {
      const URL_LABELS: Record<string, { label: string; emoji: string }> = {
        linkedin:  { label: 'LinkedIn connected',   emoji: '💼' },
        instagram: { label: 'Instagram connected',  emoji: '📸' },
        twitter:   { label: 'Twitter/X connected',  emoji: '🐦' },
      };
      const lbl = URL_LABELS[category] ?? { label: 'Profile connected', emoji: '🔗' };
      const insights = [lbl];
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, profile_url: profileUrl, pts_awarded: pts });
      return json({ verified: true, insights, pts_awarded: pts, photo_count: 0, confidence: 0.9, reason: `${lbl.label} via URL` });
    }

    // ── 3. PDF → intent-verified (can't Vision-analyse PDFs) ─────────────────
    const hasPdf = files.some(f => f.type === 'application/pdf');
    if (hasPdf && category === 'linkedin') {
      const insights = [{ label: 'CV uploaded', emoji: '📄' }];
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, pts_awarded: pts });
      return json({ verified: true, insights, pts_awarded: pts, photo_count: 1, confidence: 0.85, reason: 'CV accepted as career proof' });
    }

    // ── 4. Dev bypass ─────────────────────────────────────────────────────────
    if (import.meta.env.VITE_SKIP_VERIFICATION === 'true') {
      const MOCK: Record<string, Array<{ label: string; emoji: string }>> = {
        lifestyle:    [{ label: 'International traveler', emoji: '✈️' }, { label: 'Fine dining regular', emoji: '🍽️' }],
        hosting:      [{ label: 'Hosts dinner parties',   emoji: '🍽️' }],
        discipline:   [{ label: 'Consistent gym goer',    emoji: '💪' }, { label: 'Early riser',         emoji: '⏰' }],
        social_proof: [{ label: 'Active social circle',   emoji: '🤝' }],
        linkedin:     [{ label: 'Tech industry pro',      emoji: '💼' }],
        instagram:    [{ label: 'Active lifestyle sharer',emoji: '📸' }],
        twitter:      [{ label: 'Tech community voice',   emoji: '🐦' }],
        habit_tracker:[{ label: 'Daily habit tracker',    emoji: '📊' }],
      };
      const insights = MOCK[category] ?? [{ label: 'Proof verified', emoji: '✅' }];
      return json({ verified: true, insights, pts_awarded: pts, photo_count: files.length, confidence: 0.95, reason: 'Dev mode bypass active' });
    }

    // ── 5. Claude Vision — up to 8 images per call ───────────────────────────
    if (files.length === 0) {
      return json({ error: 'At least one file or a profile URL is required' }, { status: 400 });
    }

    const imageBlocks: object[] = [];
    for (const file of files.slice(0, 8)) {          // cap at 8 per Vision call
      if (!file.type.startsWith('image/')) continue;
      const buf  = await file.arrayBuffer();
      const b64  = Buffer.from(buf).toString('base64');
      const mime = file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
    }

    if (imageBlocks.length === 0) {
      return json({ error: 'No valid images found (JPEG/PNG/WEBP)' }, { status: 400 });
    }

    const claudeResp = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 768,
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPTS[category] }] }]
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!claudeResp.ok) {
      console.error('Claude API error:', claudeResp.status);
      return json({ error: 'Vision API unavailable — try again' }, { status: 503 });
    }

    const claudeData = await claudeResp.json();
    const rawText    = (claudeData.content?.[0]?.text ?? '{}') as string;
    const cleaned    = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

    let result: { verified?: boolean; insights?: Array<{ label: string; emoji: string }>; confidence?: number; reason?: string };
    try { result = JSON.parse(cleaned); }
    catch { console.error('Non-JSON from Claude:', cleaned); return json({ error: 'Analysis returned unexpected format' }, { status: 500 }); }

    const verified = result.verified === true;
    const insights = (result.insights ?? []).filter(i => i.label && i.emoji).slice(0, 5);
    if (insights.length === 0 && verified) insights.push({ label: 'Proof verified', emoji: '✅' });

    if (verified) {
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, confidence: result.confidence, reason: result.reason, pts_awarded: pts, photo_count: files.length });
    }

    return json({
      verified,
      insights,
      pts_awarded:  verified ? pts : 0,
      photo_count:  files.length,
      confidence:   result.confidence ?? 0,
      reason:       result.reason ?? '',
    });

  } catch (error) {
    console.error('proof-upload handler error:', error);
    return json({ error: 'Failed to analyse proof — try again' }, { status: 500 });
  }
};
