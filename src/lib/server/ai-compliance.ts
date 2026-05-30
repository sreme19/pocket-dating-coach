/**
 * AI Compliance Module — PII guard + guideline validator
 *
 * Every outbound AI greeting must pass both checks before reaching the user.
 * If either fires the message is blocked, a safe fallback is sent, and the
 * violation is logged to ai_assistant_violations for internal review.
 */

import { ANTHROPIC_API_KEY } from '$env/static/private';
import { getSupabase } from '$lib/server/supabase';

// ── PII regex patterns ────────────────────────────────────────────────────────

const PII_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'email',           re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi },
  { name: 'indian_mobile',   re: /(?<!\d)(?:\+91[-\s]?)?[6-9]\d{9}(?!\d)/g },
  { name: 'intl_phone',      re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g },
  { name: 'aadhaar',         re: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { name: 'pan_card',        re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { name: 'indian_dl',       re: /\b[A-Z]{2}\d{2}\s?\d{4}\d{7}\b/g },
  { name: 'passport',        re: /\b[A-Z]\d{7}\b/g },
];

export function piiScan(text: string): string[] {
  const hits: string[] = [];
  for (const { name, re } of PII_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) hits.push(name);
  }
  return hits;
}

// ── Haiku compliance validator ────────────────────────────────────────────────

const VALIDATOR_PROMPT = `You are a compliance checker for a dating-app AI assistant.
The assistant must NEVER:
1. Share another user's surname or full name
2. Share any phone number, email, or physical address
3. Share government ID numbers (Aadhaar, PAN, passport, driving licence)
4. Share financial account details of any user
5. Claim specific private facts about a named third-party user that the platform has not explicitly surfaced
6. Give medical, legal, or financial planning advice
7. Make guarantees about match outcomes
8. Produce sexually explicit content
9. Reveal that another user has unmatched, blocked, or reported the current user

Review the TEXT below. Return JSON only — no prose, no markdown.
{"violations":[],"clean":true}
or
{"violations":["<description>"],"clean":false}`;

// Relaxed validator for the PRIVATE advisor chat (Bestie/Wingman talking to
// their OWN user). Here, discussing the user's own matches by first name and
// giving candid relationship advice is the whole point — so we only block hard
// PII leakage and genuinely unsafe content, NOT third-party name/fact mentions.
const ADVISOR_VALIDATOR_PROMPT = `You are a compliance checker for a private dating-app AI advisor that is talking ONLY to its own user (not to anyone else). Discussing the user's own matches by first name, ranking them, and giving candid dating advice is EXPECTED and allowed.

Only flag the TEXT if it does one of these:
1. Reveals a phone number, email address, or physical/street address
2. Reveals a government ID number (Aadhaar, PAN, passport, driving licence)
3. Reveals someone's bank/financial account details
4. Produces sexually explicit content
5. Gives specific medical, legal, or financial-planning advice
6. Makes an absolute guarantee about a match outcome ("you WILL marry her")

Do NOT flag: mentioning matches by first name, summarising matches, ranking, opinions, or normal dating advice.

Return JSON only — no prose, no markdown.
{"violations":[],"clean":true} or {"violations":["<description>"],"clean":false}`;

export async function haikusValidate(
  text: string,
  context: 'advisor' | 'outbound' = 'outbound'
): Promise<{ clean: boolean; violations: string[] }> {
  if (!ANTHROPIC_API_KEY) return { clean: true, violations: [] }; // fail open if key missing
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 120,
        system: context === 'advisor' ? ADVISOR_VALIDATOR_PROMPT : VALIDATOR_PROMPT,
        messages: [{ role: 'user', content: `TEXT:\n${text}` }],
      }),
    });
    if (!res.ok) return { clean: true, violations: [] };
    const data = await res.json() as { content: { text: string }[] };
    const raw = data.content?.[0]?.text?.trim() ?? '{}';
    // Strip any accidental markdown fences (Claude 4.x wraps JSON in ```json)
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonStr) as { clean: boolean; violations: string[] };
    return { clean: parsed.clean ?? true, violations: parsed.violations ?? [] };
  } catch {
    return { clean: true, violations: [] }; // fail open — never block on validator error
  }
}

// ── Violation logger ─────────────────────────────────────────────────────────

export async function logViolation(opts: {
  userId: string | null;
  assistantType: 'wingman' | 'bestie';
  originalContent: string;
  sanitizedSent: string;
  violationTypes: string[];
  detectionStage: 'regex' | 'haiku_validator' | 'user_report';
}): Promise<void> {
  try {
    const supabase = getSupabase();
    await (supabase as any).from('ai_assistant_violations').insert({
      user_id:          opts.userId,
      assistant_type:   opts.assistantType,
      original_content: opts.originalContent,
      sanitized_sent:   opts.sanitizedSent,
      violation_types:  opts.violationTypes,
      detection_stage:  opts.detectionStage,
      needs_review:     true,
    });
  } catch (e) {
    console.error('[ai-compliance] logViolation failed (non-fatal):', e);
  }
}

// ── Safe fallback message ────────────────────────────────────────────────────

export const SAFE_FALLBACK =
  "I want to make sure I'm being as helpful as possible — could you tell me more about what you're looking for right now?";

// ── Main gate — run both checks, return clean text or fallback ────────────────

export async function complianceGate(opts: {
  text: string;
  userId: string | null;
  assistantType: 'wingman' | 'bestie';
  context?: 'advisor' | 'outbound';
}): Promise<{ text: string; passed: boolean; violations: string[] }> {
  const { text, userId, assistantType, context = 'outbound' } = opts;

  // Stage 1: fast regex scan
  const regexHits = piiScan(text);
  if (regexHits.length > 0) {
    await logViolation({
      userId, assistantType, originalContent: text,
      sanitizedSent: SAFE_FALLBACK, violationTypes: regexHits,
      detectionStage: 'regex',
    });
    return { text: SAFE_FALLBACK, passed: false, violations: regexHits };
  }

  // Stage 2: Haiku semantic check (relaxed for private advisor chats)
  const { clean, violations } = await haikusValidate(text, context);
  if (!clean) {
    await logViolation({
      userId, assistantType, originalContent: text,
      sanitizedSent: SAFE_FALLBACK, violationTypes: violations,
      detectionStage: 'haiku_validator',
    });
    return { text: SAFE_FALLBACK, passed: false, violations };
  }

  return { text, passed: true, violations: [] };
}
