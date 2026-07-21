/**
 * Admin Gemini image playground — a raw, stateless proxy for prompt testing.
 *
 * Deliberately does NOT use buildGeminiPrompt() from $lib/photo-enhance/gemini:
 * the whole point of this page is to try prompts that are NOT the production
 * men's-photo prompt, so whatever the admin types is sent to Gemini verbatim.
 *
 * Nothing is persisted: no Supabase writes, no app-log rows, no prompt/image
 * contents in server logs. The transcript lives only in the browser tab.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { env } from '$env/dynamic/private';

/** Image-capable Gemini models. Kept here so the page and proxy can't drift. */
const ALLOWED_MODELS = [
	'gemini-2.5-flash-image',
	'gemini-2.0-flash-preview-image-generation'
] as const;

const MAX_REFS = 6;
/** ~8 MB of base64 per reference — generous, but stops a runaway upload. */
const MAX_REF_CHARS = 8_000_000;

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } | null {
	const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
	if (!m) return null;
	return { mimeType: m[1], data: m[2] };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	// The /admin +layout.server.ts guard only covers page loads, so this API
	// route has to check the cookie itself — otherwise it's an open proxy to a
	// paid API key.
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	let body: { prompt?: string; model?: string; refs?: string[]; temperature?: number };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}

	const prompt = body.prompt?.trim();
	if (!prompt) return json({ error: 'prompt is required' }, { status: 400 });

	const model = ALLOWED_MODELS.includes(body.model as (typeof ALLOWED_MODELS)[number])
		? (body.model as string)
		: ALLOWED_MODELS[0];

	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });

	const refs = (body.refs ?? []).slice(0, MAX_REFS);
	if (refs.some((r) => typeof r !== 'string' || r.length > MAX_REF_CHARS)) {
		return json({ error: 'reference image too large (max ~6 MB each)' }, { status: 413 });
	}
	const inline = refs
		.map(dataUrlToInline)
		.filter((x): x is { mimeType: string; data: string } => !!x);

	const parts: unknown[] = [{ text: prompt }, ...inline.map((i) => ({ inlineData: i }))];

	const payload: Record<string, unknown> = { contents: [{ parts }] };
	if (typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 2) {
		payload.generationConfig = { temperature: body.temperature };
	}

	const startedAt = Date.now();
	let res: Response;
	try {
		res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
			{
				method: 'POST',
				headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			}
		);
	} catch (e) {
		return json(
			{ error: e instanceof Error ? e.message : 'network error calling Gemini' },
			{ status: 502 }
		);
	}

	const j: any = await res.json().catch(() => ({}));
	const ms = Date.now() - startedAt;

	if (!res.ok) {
		return json(
			{ error: `gemini ${res.status}: ${j?.error?.message ?? JSON.stringify(j).slice(0, 300)}`, ms },
			{ status: 502 }
		);
	}

	const outParts: any[] = j?.candidates?.[0]?.content?.parts ?? [];
	const images = outParts
		.filter((p) => p?.inlineData?.data)
		.map((p) => `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`);
	const text = outParts
		.map((p) => p?.text)
		.filter(Boolean)
		.join('\n')
		.trim();

	return json({
		images,
		text: text || null,
		finishReason: j?.candidates?.[0]?.finishReason ?? null,
		// Raw response minus the base64 blobs, so the debug panel stays readable.
		raw: {
			...j,
			candidates: (j?.candidates ?? []).map((c: any) => ({
				...c,
				content: {
					...c?.content,
					parts: (c?.content?.parts ?? []).map((p: any) =>
						p?.inlineData
							? { inlineData: { mimeType: p.inlineData.mimeType, data: '<stripped>' } }
							: p
					)
				}
			}))
		},
		ms
	});
};
