/**
 * Gemini 2.5 Flash Image provider — the primary men's-photo engine.
 *
 * Uses the "edit-framing + flattering" prompt validated in the 2026-06-29 bake-off
 * (see docs/photo-engine/PHOTO-ENGINE-SPEC.md): treat it as an EDIT of one real man
 * (keep him identical, change only the scene) rather than a recreation — this
 * preserves identity + hair while keeping realism, and a flattering clause makes it
 * his most attractive real self. Returns a base64 data URL (the caller hosts it).
 */

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiPromptOpts {
  /** Per-man appearance descriptor (hair/beard/build) from a vision read — optional. */
  appearance?: string;
  /** Styling clause, e.g. "wearing a stylish hat" (bald) or "in a structured blazer" (heavier build). */
  styling?: string;
  /** When the man is older/greying, hard-pin grey hair + age (the model otherwise de-ages). */
  olderGuard?: boolean;
}

export function buildGeminiPrompt(scenePrompt: string, opts: GeminiPromptOpts = {}): string {
  const appearance = opts.appearance ? ` He has ${opts.appearance}.` : '';
  const styling = opts.styling ? ` Styling: ${opts.styling}.` : '';
  const older = opts.olderGuard
    ? ' Preserve his grey / salt-and-pepper hair and his real age — do NOT darken his hair or make him look younger.'
    : '';
  return (
    `These are reference photos of ONE specific real man. Produce a new, flattering, photorealistic ` +
    `photograph of the SAME man, ${scenePrompt}.${appearance} ` +
    `Keep his identity unmistakable: same face, bone structure, hair, hairline, beard and age bracket as the ` +
    `references — change only the background/setting and clothing.${styling} ` +
    `Show him at his BEST, the way a great photographer + good lighting would: well-rested and approachable — ` +
    `soften under-eye bags and dark circles, even and freshen his skin, neatly groom his beard and hair, ` +
    `warm flattering light, relaxed confident expression. ` +
    `But do NOT cross into a different or idealized person: do NOT slim or reshape his face, do NOT make him ` +
    `younger or older, do NOT change his hairline, hair length, or ethnicity.${older} ` +
    `Natural skin texture (not plastic, glossy, or over-retouched), photorealistic. ` +
    `Framing: head-and-shoulders to waist-up ONLY (not full-body), correctly proportioned — the head must NOT ` +
    `be oversized. He must be instantly recognizable as the same man — just his most attractive real self.`
  );
}

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

/**
 * Generate one scene with Gemini. `refs` is one or more reference data URLs of the
 * SAME man (multi-reference materially improves identity lock). Returns a data URL.
 * Retries once on a transient content-filter "no image" refusal.
 */
export async function generateSceneWithGemini(
  refs: string[],
  scenePrompt: string,
  apiKey: string,
  opts: GeminiPromptOpts = {},
  retries = 1
): Promise<string> {
  const inline = refs.map(dataUrlToInline).filter((x): x is { mimeType: string; data: string } => !!x);
  if (inline.length === 0) throw new Error('no valid reference data URLs');

  const parts: any[] = [
    { text: buildGeminiPrompt(scenePrompt, opts) },
    ...inline.map((i) => ({ inlineData: i })),
  ];

  let lastErr = 'gemini failed';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastErr = `gemini ${res.status}: ${JSON.stringify(j?.error ?? j).slice(0, 200)}`;
      continue;
    }
    const out = (j?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p?.inlineData?.data);
    if (out) return `data:${out.inlineData.mimeType || 'image/png'};base64,${out.inlineData.data}`;
    lastErr = `gemini returned no image (${j?.candidates?.[0]?.finishReason ?? 'unknown'})`;
  }
  throw new Error(lastErr);
}
