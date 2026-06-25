/**
 * POST /api/verified-vibe/proof-upload
 *
 * Analyses proof uploads per Show-Off / Proof Connection category via Claude Vision.
 * Returns an array of insights (up to 5) so the boost tab can list them individually.
 *
 * Categories: lifestyle | hosting | discipline | social_proof |
 *             linkedin  | instagram | twitter | habit_tracker | intro |
 *             spending  | wealth | assets | travel
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
import { recomputeAndNormalize } from '$lib/server/trust-normalize';
// pdf-parse kept as dep for potential future text pre-processing;
// primary PDF analysis now goes through Anthropic's native PDF document type

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-sonnet-4-6';

/**
 * Fetch with automatic retry on transient Claude API errors (503, 529, 5xx).
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, init);
      // Retry on Anthropic overload (529) or server errors (5xx), but not 4xx
      if (resp.status === 529 || (resp.status >= 500 && attempt < maxAttempts)) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.warn(`Claude API ${resp.status} on attempt ${attempt}/${maxAttempts} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`Claude API network error on attempt ${attempt}/${maxAttempts} — retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError ?? new Error('Claude API unreachable after retries');
}

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
A single photo is enough to verify. Accept ANY visual evidence of physical or mental discipline — gym selfies, sport or training shots (swimming, running, cycling, martial arts, etc.), workout equipment at home, a book or course in progress, a clean workspace, meal prep, early morning scenes, or fitness app screenshots. You do NOT need tracking data, streaks, or logs — the activity itself is proof.

Set verified=true whenever the image clearly shows someone engaged in or prepared for a disciplined activity. Only set verified=false if the image has zero connection to any form of discipline or routine.

Extract UP TO 5 distinct discipline signals.
Write one punchy "aggregated" sentence (10–15 words) combining ALL insights into a profile-ready statement.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Consistent gym goer'","emoji":"single emoji"},...],"aggregated":"e.g. 'Trains consistently and shows up for himself every day'","confidence":0.0-1.0,"reason":"one sentence"}`,

  social_proof: `You are reviewing 1–20 proof photos for a dating-app "Show-Off: Social Proof" section.
Analyse ALL images. Look for real friendships, social activities, group events, community involvement.
Extract UP TO 5 distinct social signals.
Write one punchy "aggregated" sentence (10–15 words) combining ALL insights into a profile-ready statement.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Active social circle'","emoji":"single emoji"},...],"aggregated":"e.g. 'Has a real social life — group trips, events, and genuine friendships'","confidence":0.0-1.0,"reason":"one sentence"}`,

  linkedin: `You are reviewing a LinkedIn profile screenshot OR raw CV/resume text for a dating-app career verification step.
Does this show a GENUINE established professional with clear work history?

Extract UP TO 4 insights in this priority order:
- Current job title and seniority level (e.g. "Senior Product Manager", "Director of Engineering")
- Industry or domain area (e.g. "ML / Legal Tech", "Fintech", "SaaS") — NEVER a company name
- Years of experience or career breadth (e.g. "12+ years in tech", "5 startups", "serial founder")
- Education: ONLY include this if the person attended one of these exact Ivy League schools — Harvard, Yale, Princeton, Columbia, UPenn, Brown, Dartmouth, Cornell. If Ivy League, use a label like "Harvard alumnus" or "Yale graduate" with emoji 🎓. If the school is NOT in this list, OMIT education entirely.

IMPORTANT: Do NOT include any company or employer names in the insights or aggregated line.

Write one punchy "aggregated" sentence (8–12 words) that would look great on a dating profile — no company names.

Also extract documentName: the full name of the person the CV/résumé belongs to (usually the header), or null if not present.

YOU MUST return ONLY raw JSON — no explanation, no preamble, no markdown:
{"verified":true/false,"documentName":"full name on CV or null","insights":[{"label":"3-5 words e.g. 'Senior software engineer'","emoji":"💼"},...],"aggregated":"e.g. 'A senior engineer with a decade of real industry experience'","confidence":0.0-1.0,"reason":"one sentence"}
If the document has no clear career information, set verified=false.`,

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

If the image is a credit-card or bank statement, also extract documentName: the cardholder / account holder name printed on it, or null. For anonymous receipts with no name, use null.

Return ONLY raw JSON — no markdown, no code fences:
{
  "verified": true/false,
  "documentName": "full name on statement or null",
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

  wealth: `You are reviewing financial documents for a dating-app "Wealth" verification. Input may be raw text extracted from a PDF OR a screenshot image.

Accepted document types: bank statement, credit card statement, salary slip/payslip, ITR/Form 16, investment portfolio screenshot.

Extract evidence of financial health. NEVER expose exact account numbers, exact salary figures, or exact balances — ranges and tiers only.

From the document(s) extract:
- Document type: "bank statement" / "credit card statement" / "salary slip" / "investment portfolio" / "tax return"
- Income tier: "entry-level" / "professional" / "senior professional" / "high income" / "affluent"
- Employer or institution name if clearly present (e.g. "HDFC Bank", "Infosys", "Zerodha", "ICICI Credit")
- Estimated RANGE only — e.g. "₹5–10L/year", "₹2–5L/month", "₹50L+ portfolio", "₹1Cr+ net worth"
- documentName: the full name printed on the document (account holder / employee / taxpayer), or null if not visible

SPENDING PATTERNS — extract for bank statements AND credit card statements:
Look for recurring debits, EMIs, card charges, UPI spends, SIP investments, subscriptions, travel bookings, dining.
For credit card statements especially: group merchant categories into lifestyle buckets.
Return up to 6 spending categories. For each:
- category name (e.g. "Home Loan EMI", "Credit Card Spend", "Investments & SIP", "Dining & Lifestyle", "Travel", "Subscriptions")
- emoji that fits
- amountLabel: RANGE only (e.g. "₹40–60K/month", "₹10–15K/month") — never exact
- estimatedMonthly: rough integer in INR (e.g. 50000) — for proportional bar chart only

Write one punchy "aggregated" sentence (8–12 words) for the profile — aspirational but honest.

IMPORTANT: ITR "Gross Total Income" → range tier only, never exact figure.

YOU MUST return ONLY raw JSON — no explanation, no preamble, no markdown:
{
  "verified": true,
  "documentName": "full name on document or null",
  "insights": [{"label": "3-5 words", "emoji": "💰"}],
  "aggregated": "8-12 word profile sentence",
  "spendingBreakdown": [
    {"category": "Home Loan EMI", "emoji": "🏡", "amountLabel": "₹40–60K/month", "estimatedMonthly": 50000}
  ],
  "confidence": 0.0-1.0,
  "reason": "one sentence"
}
spendingBreakdown may be [] if the document has no transaction data (e.g. ITR-only, salary slip only).
If the document contains no readable income/wealth signal, set verified=false.`,

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

Also extract documentName: the full name of the owner / licensee / authorised signatory printed on the document, or null if not visible.

Write one punchy "aggregated" sentence (8–12 words) suitable for a dating profile.

YOU MUST return ONLY raw JSON — no explanation, no preamble, no markdown, no code fences. Start your response with { and end with }:
{"verified":true,"documentName":"full name on document or null","insights":[{"label":"3-5 words e.g. 'BMW X5 owner'","emoji":"🚗"}],"aggregated":"e.g. 'Licensed driver with multi-vehicle authorisation across India'","assets":[{"type":"car","make":"","model":"","year":"","color":"","vehicleType":""}],"confidence":0.0-1.0,"reason":"one sentence"}
Only populate fields you can actually read. For a DL with no RC, omit make/model and set type to "car" with vehicleType matching the COV class.`,

  travel: `You are reviewing 1–20 travel proof images for a dating-app "Travel Magnets" section.
Images may include: passport pages (entry/exit stamps), boarding passes, visa stickers, hotel booking confirmations, travel itineraries, airport photos, or any document showing travel to a country.
Analyse ALL images. For each image, identify every country or city that appears — from passport stamps, visa labels, boarding pass destinations, hotel names/addresses, airport codes, or visible landmarks.

Extract UP TO 5 insights about the person's travel style or history (e.g. "Frequent Asia traveller", "Business-class flyer", "Multi-continent explorer").
List ALL distinct countries or cities you can confirm — be thorough, include every country from every stamp or boarding pass visible.
Write one punchy "aggregated" sentence (10–15 words) that captures their travel personality.

Return ONLY raw JSON — no markdown, no code fences:
{"verified":true/false,"insights":[{"label":"3-5 words e.g. 'Multi-continent traveller'","emoji":"single emoji"},...],"locations":["Country or City","..."],"aggregated":"e.g. 'Has explored 12+ countries across Asia, Europe and the Americas'","confidence":0.0-1.0,"reason":"one sentence"}`,
};

// ── Cross-section extraction ────────────────────────────────────────────────
// A single upload often shows evidence relevant to OTHER public-read sections
// (a Lifestyle photo with a passport stamp → Travel; a fine-dining bill → Money;
// a car in the driveway → Garage). We ask Claude to surface those too, tagged
// with the target section, and propagate them — clearly marked as inferred — so
// the public profile gets richer without the user re-uploading per section.
//
// Valid target sections (must line up with the public-profile reader + the
// CROSS_SECTION_BOOST_MAP in trust-recompute.ts):
//   travel | money | garage | health | social | career | lifestyle | hosting
const CROSS_SIGNAL_SUFFIX = `

── ALSO: cross-section signals ──
Beyond the primary insights above, scan the SAME image(s) for evidence that belongs to OTHER dating-profile sections. ONLY include something you can DIRECTLY SEE — never guess, never infer beyond what is visible. Omit a section if you see nothing for it.
Target sections and the visible evidence that qualifies:
- "travel": a recognisable country/city/landmark, passport stamp, visa, boarding pass, or hotel — add a "locations" array of place names.
- "money": a visible luxury spend, premium brand, business/first-class seat, or fine-dining/hotel bill — add a "spendingBreakdown" array entry {"category","emoji","amountLabel","estimatedMonthly"}.
- "garage": a clearly owned vehicle visible — add an "assets" array entry {"type":"car","make","model","year","color","vehicleType"}.
- "health": gym, sport, training, or fitness activity visible.
- "social": a group of friends, event, or community activity visible.
- "career": an office/work setting, uniform, or professional credential visible.
- "lifestyle": a distinct premium-lifestyle signal (ONLY if this upload's primary section is not lifestyle).
Add a top-level "crossSignals" array to the SAME JSON object you return. Each item:
{"section":"travel|money|garage|health|social|career|lifestyle|hosting","label":"3-5 words","emoji":"single emoji","confidence":0.0-1.0,"locations":["..."],"spendingBreakdown":[...],"assets":[...]}
Include locations/spendingBreakdown/assets ONLY for the sections noted above; omit them otherwise. Only include items with confidence >= 0.6. Never duplicate the primary section. Use [] if there are none.`;

const VALID_CROSS_SECTIONS = new Set(['travel', 'money', 'garage', 'health', 'social', 'career', 'lifestyle', 'hosting']);

for (const key of Object.keys(PROMPTS)) {
  PROMPTS[key] = PROMPTS[key] + CROSS_SIGNAL_SUFFIX;
}

interface CrossSignal {
  section: string;
  label: string;
  emoji: string;
  confidence?: number;
  locations?: string[];
  spendingBreakdown?: Array<{ category: string; emoji: string; amountLabel: string; estimatedMonthly?: number }>;
  assets?: Array<Record<string, string>>;
}

/** Sanitise the raw crossSignals from Claude: valid section, real label/emoji, confidence gate. */
function sanitizeCrossSignals(raw: unknown, primaryCategory: string): CrossSignal[] {
  if (!Array.isArray(raw)) return [];
  // The "lifestyle" cross-target overlaps the lifestyle primary category; the
  // social/career/health targets map onto social_proof/linkedin/discipline.
  const primaryAliases: Record<string, string> = {
    social_proof: 'social', linkedin: 'career', discipline: 'health',
  };
  const primaryTarget = primaryAliases[primaryCategory] ?? primaryCategory;
  return (raw as any[])
    .filter(s => s && typeof s.section === 'string' && VALID_CROSS_SECTIONS.has(s.section)
      && typeof s.label === 'string' && s.label.trim() && typeof s.emoji === 'string' && s.emoji.trim()
      && (s.confidence === undefined || s.confidence >= 0.6)
      && s.section !== primaryTarget)                       // never echo the primary section
    .slice(0, 6)
    .map(s => ({
      section: s.section,
      label: String(s.label).trim(),
      emoji: String(s.emoji).trim(),
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.6,
      ...(Array.isArray(s.locations) ? { locations: s.locations.filter((l: unknown) => typeof l === 'string' && (l as string).trim()) } : {}),
      ...(Array.isArray(s.spendingBreakdown) && s.spendingBreakdown.length ? { spendingBreakdown: s.spendingBreakdown } : {}),
      ...(Array.isArray(s.assets) && s.assets.length ? { assets: s.assets } : {}),
    }));
}

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
  wealth:       12,
  travel:       8,
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

/** Read the user's completed government-ID verification record, if any. */
async function getVerifiedId(userId: string): Promise<{ idName?: string } | null> {
  try {
    const supabase = getSupabase();
    const { data } = await (supabase as any)
      .from('verified_vibe_verification')
      .select('data')
      .eq('user_id', userId)
      .eq('step', 'id')
      .eq('status', 'completed')
      .maybeSingle();
    return (data?.data as { idName?: string }) ?? null;
  } catch { return null; }
}

/** Normalize a name into comparable tokens (lowercase, strip honorifics + punctuation). */
function normalizeNameTokens(name: string): string[] {
  const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'kumari', 'sri', 'md']);
  return name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !HONORIFICS.has(t));
}

/**
 * Warn-only name check: does the name on a document match the verified ID name?
 * Returns null when the comparison can't be made (missing data) so the caller
 * neither warns nor blocks.
 */
function docNameMatches(idName?: string, documentName?: string): boolean | null {
  if (!idName || !documentName) return null;
  const idTokens = new Set(normalizeNameTokens(idName));
  const docTokens = normalizeNameTokens(documentName);
  if (idTokens.size === 0 || docTokens.length === 0) return null;
  return docTokens.some(t => idTokens.has(t));
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
      const newEntry: Record<string, unknown> = {
        category,
        insights:    d.insights   ?? [],
        aggregated:  d.aggregated ?? '',
        locations:   d.locations  ?? [],
        verified_at: new Date().toISOString(),
      };
      // Persist rich fields so cross-device hydration gets full data
      if (Array.isArray(d.spendingBreakdown) && (d.spendingBreakdown as unknown[]).length > 0) {
        newEntry.spendingBreakdown = d.spendingBreakdown;
      }
      if (Array.isArray(d.assets) && (d.assets as unknown[]).length > 0) {
        newEntry.assets = d.assets;
      }
      if (Array.isArray(d.thumbnail_urls) && (d.thumbnail_urls as unknown[]).length > 0) {
        newEntry.thumbnail_urls = d.thumbnail_urls;
      }
      if (d.pts_awarded !== undefined) {
        newEntry.pts_awarded = d.pts_awarded;
      }
      if (d.photo_count !== undefined) {
        newEntry.photo_count = d.photo_count;
      }

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

      // Merge insights from previous proof of same category so chips accumulate.
      const prevSame = prevProofs.find((p: any) => p.category === category) as any;
      if (prevSame && Array.isArray(prevSame.insights) && Array.isArray(newEntry.insights)) {
        const seen = new Set((newEntry.insights as any[]).map((i: any) => i.label));
        const extra = (prevSame.insights as any[]).filter((i: any) => !seen.has(i.label));
        newEntry.insights = [...(newEntry.insights as any[]), ...extra];
        // Merge photo_count
        if (typeof prevSame.photo_count === 'number' && typeof newEntry.photo_count === 'number') {
          newEntry.photo_count = prevSame.photo_count + newEntry.photo_count;
        }
      }

      const mergedProofs = [...prevProofs.filter((p: any) => p.category !== category), newEntry];

      // Also union-merge locations into countriesTraveled — include any travel
      // locations surfaced as cross-signals from THIS upload, not just the
      // primary `locations` array.
      const incomingCross: CrossSignal[] = Array.isArray(d.crossSignals) ? d.crossSignals as CrossSignal[] : [];
      const crossTravelLocations = incomingCross
        .filter(s => s.section === 'travel' && Array.isArray(s.locations))
        .flatMap(s => s.locations as string[]);
      const prevCountries: string[] = Array.isArray(masterData.countriesTraveled)
        ? masterData.countriesTraveled as string[]
        : [];
      const newLocations: string[] = Array.isArray(d.locations) ? d.locations as string[] : [];
      const mergedCountries = Array.from(new Set([...prevCountries, ...newLocations, ...crossTravelLocations]));

      // ── Cross-section signals (inferred from this upload, distinct from the
      //    primary verified proof). Keyed by target section, deduped by label,
      //    each tagged with `from` (the source proof category) so the public
      //    profile can render them as inferred, not directly verified.
      const prevCross = (typeof masterData.crossSignals === 'object' && masterData.crossSignals)
        ? masterData.crossSignals as Record<string, any[]>
        : {};
      const mergedCross: Record<string, any[]> = { ...prevCross };
      for (const sig of incomingCross) {
        const bucket = Array.isArray(mergedCross[sig.section]) ? [...mergedCross[sig.section]] : [];
        // Drop any prior signal with the same label from the same source, then prepend the fresh one.
        const deduped = bucket.filter((e: any) => !(e.label === sig.label && e.from === category));
        deduped.unshift({ ...sig, from: category, verified_at: new Date().toISOString() });
        mergedCross[sig.section] = deduped.slice(0, 8);
      }

      const updatedMaster = {
        ...masterData,
        verifiedProofs:    mergedProofs,
        countriesTraveled: mergedCountries,
        crossSignals:      mergedCross,
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

    // 3. Recompute raw trust + normalize after proof update (single source of truth)
    await recomputeAndNormalize(userId);
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

    // Resolve the authenticated user once (used by the ID gate + persistence).
    const userId = await getUserIdFromRequest(request);

    // ── Government-ID gate for name-bearing documents ─────────────────────────
    // Bank statements / payslips / ITR (wealth), ownership docs (assets),
    // card & bank statements (spending), and CV/résumé PDFs (linkedin) all carry
    // a person's name. Require a verified government ID before accepting them.
    // Runs BEFORE any Claude call so unverified users don't burn a vision request.
    const isCvPdf = category === 'linkedin' && files.some(f => f.type === 'application/pdf');
    const gated = ['wealth', 'assets', 'spending'].includes(category) || isCvPdf;
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    let verifiedId: { idName?: string } | null = null;
    if (gated && userId && !skipVerification) {
      verifiedId = await getVerifiedId(userId);
      if (!verifiedId) {
        return json({ requiresIdVerification: true, category }, { status: 200 });
      }
    }

    // ── 1. Voice/video intro → auto-verify ───────────────────────────────────
    if (PROMPTS[category] === AUTO_VERIFY) {
      const hasAudio = files.some(f => f.type.startsWith('audio/'));
      const hasVideo = files.some(f => f.type.startsWith('video/'));
      const label = hasAudio && hasVideo ? 'Voice & video intro'
                  : hasAudio             ? 'Voice intro recorded'
                  : hasVideo             ? 'Video intro recorded'
                  :                        'Intro uploaded';
      const insights = [{ label, emoji: hasVideo ? '🎥' : '🎙️' }];
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
      if (userId) await persistInsight(userId, category, pts, { insights, profile_url: profileUrl, pts_awarded: pts });
      return json({ verified: true, insights, pts_awarded: pts, photo_count: 0, confidence: 0.9, reason: `${lbl.label} via URL` });
    }

    // ── 3. PDF uploads — send directly to Claude as native PDF document ─────────
    // Claude natively reads both text-based AND scanned PDFs (uses Vision internally
    // for scanned pages) — no pdf-parse text extraction needed.
    const hasPdf = files.some(f => f.type === 'application/pdf');
    const onlyPdfs = files.every(f => f.type === 'application/pdf');

    /** Build the content array for a Claude call that includes PDF documents */
    async function buildPdfContent(pdfFiles: File[], promptText: string): Promise<object[]> {
      const blocks: object[] = [];
      for (const pdfFile of pdfFiles.slice(0, 5)) {
        const buf = Buffer.from(await pdfFile.arrayBuffer());
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') },
        });
      }
      blocks.push({ type: 'text', text: promptText });
      return blocks;
    }

    /** Call Claude with PDF documents and parse the JSON response */
    async function callClaudeWithPdfs(pdfFiles: File[], promptText: string) {
      const content = await buildPdfContent(pdfFiles, promptText);
      const resp = await fetchWithRetry(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1024,   // room for primary insights + crossSignals
          messages: [{ role: 'user', content }],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      let raw = (data.content?.[0]?.text ?? '{}') as string;
      raw = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      if (!raw.startsWith('{')) { const m = raw.match(/\{[\s\S]*\}/); if (m) raw = m[0]; }
      try { return JSON.parse(raw); } catch { return null; }
    }

    if (hasPdf && category === 'linkedin') {
      const pdfFiles = files.filter(f => f.type === 'application/pdf');
      const parsed   = await callClaudeWithPdfs(pdfFiles, PROMPTS.linkedin);
      const cvInsights = (parsed?.insights?.length ? parsed.insights : [{ label: 'CV uploaded', emoji: '📄' }]).slice(0, 5);
      const cvCross    = sanitizeCrossSignals(parsed?.crossSignals, category);
      const nameMatch  = docNameMatches(verifiedId?.idName, parsed?.documentName);
      if (userId) await persistInsight(userId, category, pts, { insights: cvInsights, aggregated: parsed?.aggregated, crossSignals: cvCross, pts_awarded: pts, ...(nameMatch === false ? { nameMismatch: true } : {}) });
      return json({
        verified:    parsed?.verified !== false,
        insights:    cvInsights,
        aggregated:  parsed?.aggregated,
        crossSignals: cvCross,
        pts_awarded: pts,
        photo_count: files.length,
        confidence:  parsed?.confidence ?? 0.85,
        reason:      parsed?.reason ?? 'CV analysed',
        nameMatch,
      });
    }

    if (hasPdf && onlyPdfs && category === 'wealth') {
      const parsed    = await callClaudeWithPdfs(files, PROMPTS.wealth);
      const wInsights = (parsed?.insights?.length ? parsed.insights : [{ label: 'Financial document uploaded', emoji: '💰' }]).slice(0, 5);
      const wSpending = parsed?.spendingBreakdown ?? [];
      const wCross    = sanitizeCrossSignals(parsed?.crossSignals, category);
      const nameMatch = docNameMatches(verifiedId?.idName, parsed?.documentName);
      if (userId) await persistInsight(userId, category, pts, { insights: wInsights, aggregated: parsed?.aggregated, spendingBreakdown: wSpending.length ? wSpending : undefined, crossSignals: wCross, pts_awarded: pts, ...(nameMatch === false ? { nameMismatch: true } : {}) });
      return json({
        verified:          parsed?.verified !== false,
        insights:          wInsights,
        aggregated:        parsed?.aggregated,
        spendingBreakdown: wSpending,
        crossSignals:      wCross,
        pts_awarded:       pts,
        photo_count:       files.length,
        confidence:        parsed?.confidence ?? 0.85,
        reason:            parsed?.reason ?? 'Wealth PDF analysed',
        nameMatch,
      });
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

    const claudeResp = await fetchWithRetry(CLAUDE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,   // room for primary insights + crossSignals
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: PROMPTS[category] }] }]
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!claudeResp.ok) {
      console.error('Claude API error after retries:', claudeResp.status);
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
      documentName?: string;
      insights?: Array<{ label: string; emoji: string }>;
      locations?: string[];
      aggregated?: string;
      assets?: Array<Record<string, string>>;
      spendingBreakdown?: Array<{ category: string; emoji: string; amountLabel: string; estimatedMonthly?: number }>;
      crossSignals?: unknown;
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
    const crossSignals      = sanitizeCrossSignals(result.crossSignals, category);
    if (insights.length === 0 && verified) insights.push({ label: 'Proof verified', emoji: '✅' });

    // Warn-only name check for gated name-bearing documents.
    const nameMatch = docNameMatches(verifiedId?.idName, result.documentName);

    let thumbnailUrls: string[] = [];

    if (verified) {
      // Upload image files to Supabase Storage so thumbnails survive cross-device restore
      if (userId) {
        try {
          const supabase = getSupabase();
          const db = supabase as any;
          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg',
            'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
          };
          const ts = Date.now();
          for (let i = 0; i < files.slice(0, 8).length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            const ext  = mimeToExt[file.type] ?? 'jpg';
            const path = `proof-uploads/${userId}/${category}/${ts}_${i}.${ext}`;
            const buf  = Buffer.from(await file.arrayBuffer());
            const { error: uploadErr } = await db.storage
              .from('profiles')
              .upload(path, buf, { contentType: file.type, upsert: true });
            if (!uploadErr) {
              const { data: urlData } = db.storage.from('profiles').getPublicUrl(path);
              if (urlData?.publicUrl) thumbnailUrls.push(urlData.publicUrl);
            }
          }
        } catch (e) {
          console.warn('proof thumbnail upload failed (non-fatal):', e);
        }
      }

      if (userId) await persistInsight(userId, category, pts, { insights, locations, aggregated, assets, spendingBreakdown, crossSignals, confidence: result.confidence, reason: result.reason, pts_awarded: pts, photo_count: files.length, thumbnail_urls: thumbnailUrls, ...(nameMatch === false ? { nameMismatch: true } : {}) });
    }

    return json({
      verified,
      insights,
      locations,
      aggregated,
      assets,
      spendingBreakdown,
      crossSignals,
      pts_awarded:    verified ? pts : 0,
      photo_count:    files.length,
      confidence:     result.confidence ?? 0,
      reason:         result.reason ?? '',
      thumbnail_urls: thumbnailUrls,
      nameMatch,
    });

  } catch (error) {
    console.error('proof-upload handler error:', error);
    return json({ error: 'Failed to analyse proof — try again' }, { status: 500 });
  }
};
