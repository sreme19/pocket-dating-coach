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
Also identify any specific countries or cities visible in the photos (from landmarks, signs, menus, boarding passes, etc.).
Extract UP TO 5 specific insights — one per distinct lifestyle signal you can confirm.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Business-class traveler'","emoji":"single emoji"},...],"locations":["country or city name","..."],"confidence":0.0-1.0,"reason":"one sentence"}`,

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

  spending: `You are reviewing 1–5 receipts or spending screenshots for a dating-app "Generosity Signal" verification.
Analyse ALL images. Look for spending evidence: restaurant bills, hotel or travel receipts, premium experiences, event tickets, generous gestures.
Extract 1–3 distinct signals about their generosity and lifestyle.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Fine dining regular'","emoji":"💳"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,

  assets: `You are reviewing ownership documents for a dating-app "Assets" verification.
Check if the document shows genuine ownership of a car, property, or company. The name on the document must match the government-verified identity.
Extract 1–2 specific insights about what they own.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Property owner'","emoji":"🏠"},...],"confidence":0.0-1.0,"reason":"one sentence"}`,
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
  spending:     10,
  assets:       10,
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
    // Recalculate and persist CG trust score after proof update
    await recalculateAndSaveTrustScore(userId);
  } catch (e) { console.warn(`proof-upload DB persist failed (${category}):`, e); }
}

// ── Proof boost map (mirrors CasualGenerousBoostTab) ─────────────────────────
const PROOF_BOOST_MAP: Record<string, { key: string; boost: number }> = {
  lifestyle:    { key: 'lifestyleDepth',    boost: 30 },
  hosting:      { key: 'lifestyleDepth',    boost: 20 },
  discipline:   { key: 'emotionalSafety',   boost: 35 },
  social_proof: { key: 'socialLegitimacy',  boost: 30 },
  linkedin:     { key: 'socialLegitimacy',  boost: 50 },
  instagram:    { key: 'socialLegitimacy',  boost: 25 },
  twitter:      { key: 'socialLegitimacy',  boost: 15 },
  habit_tracker:{ key: 'socialLegitimacy',  boost: 20 },
  intro:        { key: 'emotionalSafety',   boost: 45 },
  spending:     { key: 'generositySignals', boost: 30 },
  assets:       { key: 'generositySignals', boost: 35 },
};

function photoMultiplier(count: number): number {
  if (count <= 4)  return 0.40;
  if (count <= 9)  return 0.65;
  if (count <= 14) return 0.85;
  return 1.0;
}

const SHOW_OFF_CATS = new Set(['lifestyle', 'hosting', 'discipline', 'social_proof']);

async function recalculateAndSaveTrustScore(userId: string) {
  try {
    const supabase = getSupabase();
    // Fetch all proof records for this user
    const { data: proofRows } = await (supabase as any)
      .from('verified_vibe_verification')
      .select('step, data')
      .eq('user_id', userId)
      .like('step', 'proof_%');

    // Fetch base verification records (id, liveness, photos, spending_or_qa)
    const { data: baseRows } = await (supabase as any)
      .from('verified_vibe_verification')
      .select('step, data')
      .eq('user_id', userId)
      .not('step', 'like', 'proof_%');

    // Base CG subscores from verification records
    const baseScores: Record<string, number> = {
      identity: 0, lifestyleDepth: 0, generositySignals: 0, emotionalSafety: 0, socialLegitimacy: 0
    };

    if (baseRows) {
      const idRec    = baseRows.find((r: any) => r.step === 'id');
      const livRec   = baseRows.find((r: any) => r.step === 'liveness');
      const photoRec = baseRows.find((r: any) => r.step === 'photos');
      const qaRec    = baseRows.find((r: any) => r.step === 'spending_or_qa');
      const idScore  = idRec    ? (idRec.data?.confidenceScore    ?? 100) : 0;
      const livScore = livRec   ? (livRec.data?.confidenceScore   ?? 100) : 0;
      const phScore  = photoRec ? (photoRec.data?.confidenceScore ?? 100) : 0;
      const qaScore  = qaRec    ? 100 : 0;
      baseScores.identity          = Math.round((idScore + livScore) / 2);
      baseScores.lifestyleDepth    = phScore;
      baseScores.generositySignals = qaScore;
    }

    // Apply proof boosts
    if (proofRows) {
      for (const row of proofRows) {
        const cat = (row.step as string).replace('proof_', '');
        const boost = PROOF_BOOST_MAP[cat];
        if (!boost) continue;
        const photoCount = row.data?.photo_count ?? 0;
        const multiplier = SHOW_OFF_CATS.has(cat) ? photoMultiplier(photoCount) : 1;
        baseScores[boost.key] = Math.min(100, baseScores[boost.key] + Math.round(boost.boost * multiplier));
      }
    }

    // CG total: Identity 20% · Lifestyle 25% · Generosity 30% · Safety 15% · Social 10%
    const cgTotal = Math.min(100, Math.round(
      baseScores.identity          * 0.20 +
      baseScores.lifestyleDepth    * 0.25 +
      baseScores.generositySignals * 0.30 +
      baseScores.emotionalSafety   * 0.15 +
      baseScores.socialLegitimacy  * 0.10
    ));

    await (supabase as any)
      .from('verified_vibe_users')
      .update({ trust_score: cgTotal, updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (e) { console.warn('recalculateAndSaveTrustScore failed (non-fatal):', e); }
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

    let result: { verified?: boolean; insights?: Array<{ label: string; emoji: string }>; locations?: string[]; confidence?: number; reason?: string };
    try { result = JSON.parse(cleaned); }
    catch { console.error('Non-JSON from Claude:', cleaned); return json({ error: 'Analysis returned unexpected format' }, { status: 500 }); }

    const verified  = result.verified === true;
    const insights  = (result.insights ?? []).filter(i => i.label && i.emoji).slice(0, 5);
    const locations = (result.locations ?? []).filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
    if (insights.length === 0 && verified) insights.push({ label: 'Proof verified', emoji: '✅' });

    if (verified) {
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, locations, confidence: result.confidence, reason: result.reason, pts_awarded: pts, photo_count: files.length });
    }

    return json({
      verified,
      insights,
      locations,
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
