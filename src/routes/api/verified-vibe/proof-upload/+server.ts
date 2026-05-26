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
Write one punchy "aggregated" sentence (10–15 words) that combines ALL insights into a single profile-ready statement a man would be proud to show.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Business-class traveler'","emoji":"single emoji"},...],"locations":["country or city name","..."],"aggregated":"e.g. 'Travels internationally, explores cultural landmarks, and adventures solo'","confidence":0.0-1.0,"reason":"one sentence"}`,

  hosting: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Hosting" section.
Analyse ALL images. Look for evidence of hosting dinners, celebrations, gatherings.
Extract UP TO 5 distinct hosting signals.
Write one punchy "aggregated" sentence (10–15 words) combining ALL insights into a profile-ready statement.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Hosts dinner parties'","emoji":"single emoji"},...],"aggregated":"e.g. 'Hosts intimate dinners and celebrations with a real eye for detail'","confidence":0.0-1.0,"reason":"one sentence"}`,

  discipline: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Discipline" section.
Analyse ALL images. Look for gym sessions, fitness tracking, reading streaks, sleep data, learning logs.
Extract UP TO 5 distinct discipline signals.
Write one punchy "aggregated" sentence (10–15 words) combining ALL insights into a profile-ready statement.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Consistent gym goer'","emoji":"single emoji"},...],"aggregated":"e.g. 'Trains consistently, tracks his sleep, and reads daily — habits that show'","confidence":0.0-1.0,"reason":"one sentence"}`,

  social_proof: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Social Proof" section.
Analyse ALL images. Look for real friendships, social activities, group events, community involvement.
Extract UP TO 5 distinct social signals.
Write one punchy "aggregated" sentence (10–15 words) combining ALL insights into a profile-ready statement.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Active social circle'","emoji":"single emoji"},...],"aggregated":"e.g. 'Has a real social life — group trips, events, and genuine friendships'","confidence":0.0-1.0,"reason":"one sentence"}`,

  linkedin: `You are reviewing a LinkedIn profile screenshot or a CV/resume for a dating-app career verification step.
Does this show a GENUINE established professional with clear work history?
Extract 1–2 insights about their role and career.
Write one punchy "aggregated" sentence (8–12 words) suitable for a profile.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Senior software engineer'","emoji":"💼"},...],"aggregated":"e.g. 'A senior engineer with a decade of real industry experience'","confidence":0.0-1.0,"reason":"one sentence"}`,

  instagram: `You are reviewing an Instagram profile screenshot for a dating-app social verification step.
Does this show a GENUINE, active Instagram account with real social activity?
Extract 1–2 insights about their social personality.
Write one punchy "aggregated" sentence (8–12 words) suitable for a profile.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Active lifestyle sharer'","emoji":"📸"},...],"aggregated":"e.g. 'Genuinely active online — shares real moments, not a curated fantasy'","confidence":0.0-1.0,"reason":"one sentence"}`,

  twitter: `You are reviewing a Twitter/X profile screenshot for a dating-app social verification step.
Does this show a GENUINE, active account with real engagement and interests?
Extract 1–2 insights.
Write one punchy "aggregated" sentence (8–12 words) suitable for a profile.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Tech community voice'","emoji":"🐦"},...],"aggregated":"e.g. 'Has real opinions and engages meaningfully in the topics he cares about'","confidence":0.0-1.0,"reason":"one sentence"}`,

  habit_tracker: `You are reviewing a habit-tracker screenshot for a dating-app verification step.
Does this show GENUINE consistent habit tracking with meaningful streaks or data?
Extract 1–2 insights.
Write one punchy "aggregated" sentence (8–12 words) suitable for a profile.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Daily fitness tracker'","emoji":"📊"},...],"aggregated":"e.g. 'Tracks his habits daily — proof he follows through, not just talks'","confidence":0.0-1.0,"reason":"one sentence"}`,

  spending: `You are reviewing 1–5 receipts or spending screenshots for a dating-app "Money Matters" verification.
Analyse ALL images. Look for spending evidence: restaurant bills, hotel or travel receipts, luxury purchases, premium experiences, event tickets, generous gestures.

For each receipt or screenshot, extract:
1. The spending CATEGORY (use these exact labels where possible: "Fine Dining", "Travel", "Luxury Shopping", "Experiences & Events", "Hotels & Stays", "Nightlife", "Gifting", "Wellness & Fitness")
2. The amount visible on the receipt/screenshot (exact figure if clear)
3. An emoji for the category

Write one punchy "aggregated" sentence (8–12 words) that captures their overall spending personality.

Return ONLY raw JSON — no markdown, no code fences:
{
  "verified": true/false,
  "insights": [{"label": "3-5 words e.g. 'Fine dining regular'", "emoji": "💳"}],
  "aggregated": "e.g. 'Spends generously on real experiences — dining, travel, and meaningful moments'",
  "spendingBreakdown": [
    {
      "category": "Fine Dining",
      "emoji": "🍽️",
      "amountLabel": "£320 / evening",
      "estimatedMonthly": 1200
    },
    {
      "category": "Travel",
      "emoji": "✈️",
      "amountLabel": "Business class confirmed",
      "estimatedMonthly": 3000
    }
  ],
  "confidence": 0.0-1.0,
  "reason": "one sentence"
}
Only include categories you can actually see evidence for in the images.`,

  assets: `You are reviewing documents for a dating-app "Assets" verification.
Accept ANY of these documents — ownership OR authorisation:
• Car Registration Certificate (RC) / vehicle title — proves ownership
• Driving Licence (DL) — proves authorisation to drive that vehicle class (MCWG/LMV/HMV); set verified=true and use "Licensed [vehicle class] driver" as insight
• Property deed, mortgage statement, or utility bill with address — proves property
• Company registration or GST certificate — proves business ownership

CRITICAL — always set verified=true if the document is genuine and readable, even if it is a DL rather than an RC.

For car RC or title: extract make, model, year, color, vehicleType ("sedan"/"SUV"/"hatchback"/"coupe"/"EV"/"motorcycle").
For DL: extract the vehicle classes (COV field) and use a label like "Licensed LMV & motorcycle driver".
For property: city, type (apartment/villa/commercial).
For company: company name, type (Pvt Ltd / LLP / LLC).

Write one punchy "aggregated" sentence (8–12 words) suitable for a dating profile.

YOU MUST return ONLY raw JSON — no explanation, no preamble, no markdown, no code fences. Start your response with { and end with }:
{"verified":true,"insights":[{"label":"3-5 words e.g. 'BMW X5 owner'","emoji":"🚗"}],"aggregated":"e.g. 'Licensed driver with multi-vehicle authorisation across India'","assets":[{"type":"car","make":"","model":"","year":"","color":"","vehicleType":""}],"confidence":0.0-1.0,"reason":"one sentence"}
Only populate fields you can actually read. For a DL with no RC, omit make/model and set type to "car" with vehicleType matching the COV class.`,
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
    const db = supabase as any;

    // 1. Save proof record
    await db
      .from('verified_vibe_verification')
      .upsert(
        { user_id: userId, step: `proof_${category}`, status: 'completed', data, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,step' }
      );

    // 2. Merge proof insights into user_master_profile (primary) and
    //    ai_assistant_profiles (legacy — keeps auto-fill working)
    try {
      const d = data as Record<string, unknown>;
      const newEntry = {
        category,
        insights:    d.insights   ?? [],
        aggregated:  d.aggregated ?? '',
        locations:   d.locations  ?? [],
        verified_at: new Date().toISOString(),
      };

      // ── 2a. user_master_profile (source of truth) ──────────────────────────
      const { data: masterRow } = await db
        .from('user_master_profile')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      const masterData = (masterRow?.data as Record<string, unknown>) ?? {};
      const prevProofs: unknown[] = Array.isArray(masterData.verifiedProofs)
        ? masterData.verifiedProofs as unknown[]
        : [];
      const mergedProofs = [...prevProofs.filter((p: any) => p.category !== category), newEntry];

      // Also union-merge locations into countriesTraveled
      const prevCountries: string[] = Array.isArray(masterData.countriesTraveled)
        ? masterData.countriesTraveled as string[]
        : [];
      const newLocations: string[] = Array.isArray(d.locations) ? d.locations as string[] : [];
      const mergedCountries = Array.from(new Set([...prevCountries, ...newLocations]));

      const updatedMaster = {
        ...masterData,
        verifiedProofs:    mergedProofs,
        countriesTraveled: mergedCountries,
        lastSynced:        new Date().toISOString(),
      };

      if (masterRow) {
        await db
          .from('user_master_profile')
          .update({ data: updatedMaster, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      } else {
        await db
          .from('user_master_profile')
          .insert({ user_id: userId, data: updatedMaster });
      }

      // ── 2b. ai_assistant_profiles (kept for auto-fill backward compat) ──────
      const { data: aiExisting } = await db
        .from('ai_assistant_profiles')
        .select('id, data, version')
        .eq('user_id', userId)
        .eq('profile_type', 'personality')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (aiExisting) {
        const prev: unknown[] = Array.isArray((aiExisting.data as any)?.verifiedProofs)
          ? (aiExisting.data as any).verifiedProofs
          : [];
        const merged = [...prev.filter((p: any) => p.category !== category), newEntry];
        await db
          .from('ai_assistant_profiles')
          .update({ data: { ...(aiExisting.data as object), verifiedProofs: merged }, version: (aiExisting.version ?? 1) + 1 })
          .eq('id', aiExisting.id);
      } else {
        await db
          .from('ai_assistant_profiles')
          .insert({ user_id: userId, profile_type: 'personality', data: { verifiedProofs: [newEntry] }, version: 1, reason: 'proof_upload' });
      }
    } catch (e) { console.warn('master profile / ai_assistant_profiles sync failed (non-fatal):', e); }

    // 3. Recalculate and persist CG trust score after proof update
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

    // Strip code fences if Claude added them (memory note: Claude 4.x sometimes wraps JSON)
    let cleaned = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

    // Fallback: extract first {...} block even if Claude prefixed explanation text
    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }

    let result: {
      verified?: boolean;
      insights?: Array<{ label: string; emoji: string }>;
      locations?: string[];
      aggregated?: string;
      assets?: Array<Record<string, string>>;
      spendingBreakdown?: Array<{ category: string; emoji: string; amountLabel: string; estimatedMonthly?: number }>;
      confidence?: number;
      reason?: string;
    };
    try { result = JSON.parse(cleaned); }
    catch {
      console.error('Non-JSON from Claude:', cleaned);
      // Last resort: return a graceful failure rather than a hard error
      return json({ error: 'Analysis returned unexpected format', hint: 'Try a clearer photo of the document' }, { status: 422 });
    }

    const verified          = result.verified === true;
    const insights          = (result.insights ?? []).filter(i => i.label && i.emoji).slice(0, 5);
    const locations         = (result.locations ?? []).filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
    const aggregated        = typeof result.aggregated === 'string' ? result.aggregated.trim() : '';
    const assets            = Array.isArray(result.assets) ? result.assets : [];
    const spendingBreakdown = Array.isArray(result.spendingBreakdown) ? result.spendingBreakdown : [];
    if (insights.length === 0 && verified) insights.push({ label: 'Proof verified', emoji: '✅' });

    if (verified) {
      const userId = await getUserIdFromRequest(request);
      if (userId) await persistInsight(userId, category, pts, { insights, locations, aggregated, assets, spendingBreakdown, confidence: result.confidence, reason: result.reason, pts_awarded: pts, photo_count: files.length });
    }

    return json({
      verified,
      insights,
      locations,
      aggregated,
      assets,
      spendingBreakdown,
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
