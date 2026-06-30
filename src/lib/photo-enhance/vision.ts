/**
 * Phase-2 guardrails for the men's photo engine (Gemini vision):
 *  - analyzeReferences: auto-SELECT good reference photos + read appearance + derive
 *    styling-by-feature (hat for bald, blazer for heavier) + an older/grey guard.
 *  - scoreCandidate: rank a generated candidate vs the references (generate-N → pick-best).
 *
 * See docs/photo-engine/PHOTO-ENGINE-SPEC.md. Uses the text/vision model (cheap),
 * separate from the image-generation model in gemini.ts.
 */
import type { GeminiPromptOpts } from './gemini';

const VISION_MODEL = 'gemini-2.5-flash';
const VISION_URL = `https://generativelanguage.googleapis.com/v1/models/${VISION_MODEL}:generateContent`;

function inlinePart(dataUrl: string): any | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  return m ? { inlineData: { mimeType: m[1], data: m[2] } } : null;
}

async function geminiJson(parts: any[], apiKey: string): Promise<any | null> {
  try {
    const res = await fetch(VISION_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1 } }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const txt = (j?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text).filter(Boolean).join('').trim();
    // Strip ```json fences that Gemini/Claude tend to add.
    const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export interface RefAnalysis {
  /** The subset of references good enough to drive generation (falls back to all). */
  usableRefs: string[];
  /** Prompt options derived from the man's appearance + body features. */
  opts: GeminiPromptOpts;
}

/**
 * One vision call over all of a man's photos: pick the usable references, read his
 * appearance, and flag bald / heavier / older-grey to drive styling + guards.
 * Degrades gracefully (uses all refs, no styling) if the call/parse fails.
 */
export async function analyzeReferences(refs: string[], apiKey: string): Promise<RefAnalysis> {
  const fallback: RefAnalysis = { usableRefs: refs, opts: {} };
  if (refs.length === 0) return fallback;

  const imgs = refs.map(inlinePart).filter(Boolean);
  if (imgs.length === 0) return fallback;

  const prompt =
    `You are selecting reference photos for generating a man's dating profile portraits, and reading his appearance. ` +
    `${imgs.length} photos follow, indexed 0..${imgs.length - 1}. Return ONLY minified JSON:\n` +
    `{"usable":[indices of photos that are CLEAR, FRONTAL or near-frontal, in-focus, show his NATURAL DRY hair, are SOLO (his face clearly dominant), and well-lit. ` +
    `EXCLUDE photos with wet/slicked hair, hats, sunglasses, heavy side/up angles, distant/small face, multiple prominent people, or blur],` +
    `"appearance":"<=14 words: hair length+texture+colour+hairline, facial hair, build",` +
    `"bald":true|false (genuinely bald or heavily receding),` +
    `"heavier":true|false (heavier-set / noticeable belly),` +
    `"older_grey":true|false (older man with grey or salt-and-pepper hair)}`;

  const data = await geminiJson([{ text: prompt }, ...imgs], apiKey);
  if (!data) return fallback;

  const idxs: number[] = Array.isArray(data.usable)
    ? data.usable.filter((n: any) => Number.isInteger(n) && n >= 0 && n < refs.length)
    : [];
  const usableRefs = idxs.length ? idxs.map((i) => refs[i]) : refs;

  const styleBits: string[] = [];
  if (data.bald === true) styleBits.push('wearing a stylish hat or cap');
  if (data.heavier === true) styleBits.push('in a well-structured blazer that flatters his build');

  return {
    usableRefs,
    opts: {
      appearance: typeof data.appearance === 'string' ? data.appearance.slice(0, 160) : undefined,
      styling: styleBits.length ? styleBits.join(', ') : undefined,
      olderGuard: data.older_grey === true,
    },
  };
}

export interface CandidateScore {
  identity: number;
  flattering: number;
  realism: number;
  artifacts: boolean;
  /** Composite: identity weighted highest; artifacts are disqualifying. Higher = better. */
  score: number;
}

/**
 * Rank one generated candidate against the references. Used to pick the best of N.
 * Returns a very low score (not a throw) on failure so generation still proceeds.
 */
export async function scoreCandidate(refs: string[], candidateDataUrl: string, apiKey: string): Promise<CandidateScore> {
  const dead: CandidateScore = { identity: 0, flattering: 0, realism: 0, artifacts: false, score: 0 };
  const refImgs = refs.slice(0, 2).map(inlinePart).filter(Boolean);
  const cand = inlinePart(candidateDataUrl);
  if (!cand || refImgs.length === 0) return dead;

  const prompt =
    `The first ${refImgs.length} image(s) are REAL reference photos of a man. The LAST image is an AI-generated ` +
    `portrait meant to be the SAME man. Score strictly and return ONLY minified JSON: ` +
    `{"identity":0-10 (is it unmistakably the same person?),"flattering":0-10 (attractive for a dating photo),` +
    `"realism":0-10 (looks like a real photo, not AI),"artifacts":true|false (broken hands/fingers, distorted eyes, ` +
    `oversized head or wrong body proportions, garbled text/watermark, plastic/cartoon look)}`;

  const data = await geminiJson([{ text: prompt }, ...refImgs, { text: 'AI-generated candidate:' }, cand], apiKey);
  if (!data) return dead;

  const num = (v: any) => (typeof v === 'number' ? Math.max(0, Math.min(10, v)) : 0);
  const identity = num(data.identity), flattering = num(data.flattering), realism = num(data.realism);
  const artifacts = data.artifacts === true;
  // Identity is the dealbreaker (×2); artifacts disqualify.
  const score = identity * 2 + flattering + realism - (artifacts ? 100 : 0);
  return { identity, flattering, realism, artifacts, score };
}
