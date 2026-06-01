/**
 * POST /api/verified-vibe/ai-greeting
 *
 * Generates a contextual proactive greeting from AI Wingman (men) or
 * AI Bestie (women) on each app session if >8 h have passed since the
 * last greeting. Prevents repetition by passing prior topic tags and a
 * feedback-derived optimisation summary to Claude.
 *
 * Runs a mandatory two-stage compliance gate (PII regex + Haiku validator)
 * before any message is returned. Violations are logged for internal review.
 *
 * Auth: Bearer token (required)
 *
 * Body: { forceRefresh?: boolean }
 * Response: { greetingId, content, mode, topicTags, isNew } | { isNew: false }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { complianceGate, SAFE_FALLBACK } from '$lib/server/ai-compliance';

const CLAUDE_MODEL  = 'claude-sonnet-4-6';
const GREETING_GAP  = 8 * 60 * 60 * 1000; // 8 hours in ms

// ── Auth ─────────────────────────────────────────────────────────────────────

async function resolveUser(request: Request): Promise<{ userId: string; firstName: string; gender: string; archetype: string; city: string } | null> {
  const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from('verified_vibe_users')
      .select('first_name, gender, archetype, city')
      .eq('id', user.id)
      .maybeSingle();

    return {
      userId:    user.id,
      firstName: profile?.first_name ?? '',
      gender:    profile?.gender    ?? null,
      archetype: profile?.archetype ?? '',
      city:      profile?.city      ?? 'your area',
    };
  } catch { return null; }
}

// ── Mode detection ────────────────────────────────────────────────────────────

function detectMode(sessionCount: number, firstSeenAt: Date): number {
  const daysSince = (Date.now() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  if (sessionCount === 0) return 0;          // intro
  if (sessionCount <= 5 || daysSince <= 7)   return 1;  // early
  if (sessionCount <= 15 || daysSince <= 30) return 2;  // active
  return 3;                                  // competitive intelligence
}

// ── System prompt per assistant type ─────────────────────────────────────────

// ── Ecosystem knowledge (shared across all greetings) ──────────────────────────

const ECOSYSTEM_BRIEF = `
HOW THE THREE AI AGENTS WORK TOGETHER — know this so you can explain it clearly when relevant:
- AI Matchmaker runs behind the scenes — she decides which profiles appear in Discover, ranked by compatibility and Trust Score. She never talks directly to the user.
- AI Wingman (for men) / AI Bestie (for women) = you — a private advisor living in this chat.
- When a woman lands on a man's profile in Discover, her AI Bestie sees his verified proofs and proactively coaches her about him before she even swipes — "he's verified travel to 5+ countries, he's a director, he invests in himself" — framing him positively.
- The loop: the more a user verifies (lifestyle proofs via the 📎 button), the higher Matchmaker ranks them → more profiles see them → AI Bestie/Wingman coaches those profiles to view them favourably → better outcomes.
- Uploads are completely private — never visible in the match's own chat — only the AI agents and the Matchmaker can see them.
- You (Wingman or Bestie) can give competitive intelligence: how active the local pool is, where the user ranks, strategic nudges.`;

function buildSystemPrompt(assistantType: 'wingman' | 'bestie', city: string, firstName: string): string {
  const nameRule = firstName
    ? `- The user's first name is "${firstName}". If you address them by name, use ONLY "${firstName}". NEVER invent, guess, or substitute any other name.`
    : `- You do NOT know the user's name. NEVER invent or guess a name — address them warmly without using any name at all.`;

  const shared = `
${ECOSYSTEM_BRIEF}

STRICT RULES — you MUST follow these without exception:
${nameRule}
- NEVER share another user's surname, phone, email, address, or government ID
- NEVER reveal verification data (Aadhaar, PAN, DL numbers, DOB from ID scans)
- NEVER share financial account details of any other user
- NEVER claim specific private facts about a named third party beyond what the platform surfaces
- NEVER give medical, legal, or financial planning advice
- NEVER guarantee match outcomes or make claims you cannot verify
- NEVER be sexually explicit
- NEVER reveal if someone unmatched, blocked, or reported the current user
- NEVER repeat a topic or angle you have already covered (see history below)
- Keep the message to 2–4 sentences. No lists. Conversational, warm, direct.
- Before sending, silently ask yourself: "Does this break any rule?" If yes, rewrite.`;

  if (assistantType === 'wingman') {
    return `You are AI Wingman — a sharp, warm, and trusted dating advisor on Verified Vibe for men.
You know the user's full verified profile, his match activity, and the pulse of what women in ${city} are looking for right now (in aggregate — never naming individuals).
Your job: send a short, genuinely useful proactive message at the start of his session. Make him feel seen, give him something actionable, and keep it tight.
${shared}`;
  }
  return `You are AI Bestie — a candid, caring, and smart dating advisor on Verified Vibe for women.
You know the user's full verified profile, her match activity, and the landscape of verified men in ${city} (in aggregate — never naming individuals).
Your job: send a short, genuinely useful proactive message at the start of her session. Make her feel empowered, give her something real to act on, and keep it tight.
${shared}`;
}

// ── Greeting generation ───────────────────────────────────────────────────────

const MODE_GUIDES_MAN: Record<number, string> = {
  0: `This is the FIRST TIME this man has opened the app. Your goal is to make him immediately understand the full power of the three-agent ecosystem and how to take advantage of it.

Explain in a natural, conversational way (not a product tour):
1. Who you are and what you do as his private advisor
2. That AI Matchmaker is working behind the scenes — deciding which women see his profile in Discover, based on his Trust Score
3. The key insight: every lifestyle proof he uploads (via the 📎 button) gets seen by the AI Bestie of every woman who lands on his profile — she'll coach her match to see him favourably before she even swipes
4. End with one specific, immediate action he can take right now to trigger this loop

Make it feel like a trusted friend pulling him aside to share insider knowledge — not a product walkthrough. Warm, direct, genuinely exciting.`,

  1: `The user has just returned within his first week. Welcome him back briefly, then offer one specific, concrete thing he can do or check right now — something actionable, not generic. Reference the fact that you've been watching his match activity while he was away. If he hasn't uploaded any lifestyle proofs yet, remind him that the Matchmaker ranking and AI coaching loop only activates fully once he does.`,

  2: `The user is active and established (1–4 weeks in). You now have a real picture of his dating patterns. Lead with an insight about the competitive landscape in his area — how active is the pool, what women are responding to, how he is positioned — and offer one strategic nudge. Mention that you're tracking the full pool via the AI Matchmaker. If he has uploaded proofs, acknowledge the advantage; if not, flag it as a missed opportunity.`,

  3: `The user is a veteran (30+ days). Full competitive intelligence mode. Reference the AI Matchmaker's city-wide scan — profile counts, quality distribution, where this user sits in the ranking. Offer to share a specific strategic advantage or a breakdown of who fits his criteria. Make him feel he has an edge that others don't. If he's a power user of the proof system, acknowledge it. If not, make a direct case for why it still matters at his stage.`,
};

const MODE_GUIDES_WOMAN: Record<number, string> = {
  0: `This is the FIRST TIME this woman has opened the app. Your goal is to make her feel immediately at ease and excited about what's waiting for her.

Explain in a natural, conversational way (not a product tour):
1. Who you are — her private advisor who has eyes on the whole verified men's pool so she doesn't have to sift alone
2. That AI Matchmaker is already working for her — surfacing the most verified, serious men in Discover first
3. The key insight: verified men have uploaded lifestyle proofs (travel, career, finances) that only you (her Bestie) can see — so you'll brief her on who is genuinely worth her time before she even swipes
4. End with one warm, encouraging action she can take right now — like heading to Discover to see who's already in her pool

Make it feel like a smart girlfriend who's done the research for her. Warm, empowering, no pressure.`,

  1: `The user has just returned within her first week. Welcome her back warmly — briefly reference that you've had your eye on the verified men's pool while she was away. Give her one concrete, encouraging reason to open Discover right now — e.g. a fresh wave of verified profiles, or a nudge about the quality of men currently active. Keep it light and positive, not pushy.`,

  2: `The user is active and established (1–4 weeks in). Give her a genuine sense of where she stands — the quality of men currently in her pool, any patterns you're noticing (e.g. high-verified men are active this week), and one empowering nudge. Frame it as insider intel from your vantage point watching the full pool. No pressure, just signal.`,

  3: `The user is a veteran (30+ days). Full inside-view mode. Share a candid, useful observation about the current pool of verified men in her area — quality distribution, who's newly active, any shifts in the landscape. Position her as someone with a real advantage because she's been consistent. Give her one smart next move based on where things stand.`,
};

interface GreetingRow {
  topic_tags: string[];
  content: string;
  created_at: string;
}

async function generateGreeting(opts: {
  assistantType: 'wingman' | 'bestie';
  mode: number;
  city: string;
  firstName: string;
  priorMessages: GreetingRow[];
  feedbackSummary: string | null;
}): Promise<{ content: string; topicTags: string[] }> {
  const { assistantType, mode, city, firstName, priorMessages, feedbackSummary } = opts;

  const modeGuides = assistantType === 'bestie' ? MODE_GUIDES_WOMAN : MODE_GUIDES_MAN;

  // Compact history for the prompt
  const historyLines = priorMessages.slice(0, 20).map(m => {
    const tags = m.topic_tags?.join(', ') || 'general';
    const ago  = Math.round((Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return `- [${ago}d ago] topics: ${tags}`;
  });

  const userPrompt = `
GREETING MODE: ${mode}
GUIDANCE: ${modeGuides[mode] ?? modeGuides[3]}

PRIOR GREETINGS SENT (DO NOT repeat these topics or angles):
${historyLines.length ? historyLines.join('\n') : 'None yet — this is the first greeting.'}

${feedbackSummary ? `USER OPTIMISATION NOTES (personalise to this):\n${feedbackSummary}` : ''}

Write the greeting now. After the greeting, on a NEW LINE, output:
TAGS: tag1, tag2, tag3
(2–4 short snake_case tags describing the angles you covered, e.g. competitive_landscape, profile_tips, match_count)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: buildSystemPrompt(assistantType, city, firstName),
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error('Claude API error');
  const data = await res.json() as { content: { text: string }[] };
  const raw = data.content?.[0]?.text?.trim() ?? '';

  // Split content from self-labelled tags
  const tagMatch = raw.match(/\nTAGS:\s*(.+)$/);
  const content   = raw.replace(/\nTAGS:.*$/s, '').trim();
  const topicTags = tagMatch ? tagMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : ['general'];

  return { content, topicTags };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  const resolved = await resolveUser(request);
  if (!resolved) return json({ error: 'Unauthorized' }, { status: 401 });

  const { userId, firstName, gender, archetype, city } = resolved;
  // Treat null gender as 'man' only for assistant type — bestie is strictly opt-in for women
  const assistantType: 'wingman' | 'bestie' = gender === 'woman' ? 'bestie' : 'wingman';
  const body = await request.json().catch(() => ({})) as { forceRefresh?: boolean };
  const supabase = getSupabase();

  // ── Fetch / upsert context row ──────────────────────────────────────────────
  const sb = supabase as any;
  let { data: ctx } = await sb
    .from('ai_assistant_context')
    .select('session_count, first_seen_at, last_greeted_at, feedback_summary')
    .eq('user_id', userId)
    .maybeSingle() as { data: { session_count: number; first_seen_at: string | null; last_greeted_at: string | null; feedback_summary: string | null } | null };

  const now = new Date();
  const sessionCount  = (ctx?.session_count ?? 0) + 1;
  const firstSeenAt   = ctx?.first_seen_at ? new Date(ctx.first_seen_at) : now;
  const lastGreetedAt = ctx?.last_greeted_at ? new Date(ctx.last_greeted_at) : null;

  // Skip if greeted less than 8 h ago (unless forced)
  if (!body.forceRefresh && lastGreetedAt && (now.getTime() - lastGreetedAt.getTime()) < GREETING_GAP) {
    return json({ isNew: false });
  }

  // ── Upsert context with incremented session count ───────────────────────────
  await sb.from('ai_assistant_context').upsert(
    { user_id: userId, assistant_type: assistantType, session_count: sessionCount, first_seen_at: firstSeenAt.toISOString(), last_greeted_at: now.toISOString(), updated_at: now.toISOString() },
    { onConflict: 'user_id' }
  );

  // ── Fetch prior greeting history ────────────────────────────────────────────
  const { data: priorMessages } = await sb
    .from('ai_assistant_greetings')
    .select('topic_tags, content, created_at')
    .eq('user_id', userId)
    .eq('assistant_type', assistantType)
    .order('created_at', { ascending: false })
    .limit(20) as { data: GreetingRow[] | null };

  const mode = detectMode(sessionCount, firstSeenAt);

  // ── Generate greeting ───────────────────────────────────────────────────────
  let content: string;
  let topicTags: string[];
  try {
    ({ content, topicTags } = await generateGreeting({
      assistantType, mode, city, firstName,
      priorMessages: (priorMessages ?? []) as GreetingRow[],
      feedbackSummary: ctx?.feedback_summary ?? null,
    }));
  } catch (e) {
    console.error('[ai-greeting] generation failed:', e);
    return json({ error: 'Failed to generate greeting' }, { status: 500 });
  }

  // ── Compliance gate (PII regex + Haiku validator) ───────────────────────────
  const compliance = await complianceGate({ text: content, userId, assistantType, context: 'advisor' });
  const finalContent = compliance.text; // SAFE_FALLBACK if blocked

  // ── Persist to DB ───────────────────────────────────────────────────────────
  const { data: saved } = await sb
    .from('ai_assistant_greetings')
    .insert({ user_id: userId, assistant_type: assistantType, mode, content: finalContent, topic_tags: topicTags })
    .select('id')
    .single() as { data: { id: string } | null };

  return json({
    isNew:       true,
    greetingId:  saved?.id ?? null,
    content:     finalContent,
    mode,
    topicTags,
    passed:      compliance.passed,
  });
};
