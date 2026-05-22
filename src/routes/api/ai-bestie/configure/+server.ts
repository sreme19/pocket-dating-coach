import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadPreferences, updatePreferences } from '$lib/server/profile-service';
import { getClaudeClient } from '$lib/claude';
import { logError, ErrorType } from '$lib/server/error-handler';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/ai-bestie/configure
 *
 * Extends AI Bestie's interview focus with new instructions from the user.
 * Auth: userId passed in request body (no locals.auth — no SvelteKit auth hook in this project).
 *
 * Body: { userId: string, customPrompt: string }
 * Response: { interviewTopics: string[], insightsAdded: string[], newProbe: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json() as { customPrompt?: string; userId?: string };

	const userId = (body.userId ?? '').trim();
	if (!userId) {
		return json({ error: 'userId is required' }, { status: 400 });
	}

	const customPrompt = (body.customPrompt ?? '').trim();
	if (!customPrompt) {
		return json({ error: 'customPrompt is required' }, { status: 400 });
	}

	try {
		// 1. Load current preferences
		const prefs = await loadPreferences(userId);

		// 2. Build current focus summary for Claude
		const currentTopics = [
			...prefs.dealbreakers.map(d => `Dealbreaker: ${d}`),
			...prefs.emotionalSignals.map(e => `Wants to see: ${e}`),
			...prefs.maturitySignals.map(m => `Values: ${m}`),
			...prefs.boundaries.map(b => `Boundary: ${b}`),
			...prefs.privateCompatibilityNotes
		].filter(Boolean);

		// 3. Ask Claude to derive updated interview topics + any new structured insights
		const systemPrompt = `You are the AI Bestie configuration assistant. AI Bestie is a female user's dating coach that interviews male matches on her behalf.

Your job:
- Given the user's existing focus areas and her custom instructions, produce:
  a) An updated list of 6–10 interview topics AI Bestie should probe in male matches
  b) Any new structured insights from the user's instructions that should be saved to her preferences
  c) A single short "probe label" (max 8 words) summarising the new focus area just added

Return ONLY valid JSON in this exact shape:
{
  "interviewTopics": ["topic 1", "topic 2", ...],
  "newProbe": "Short label for the new focus area",
  "newEmotionalSignals": ["signal to add", ...],
  "newDealbreakers": ["dealbreaker to add", ...],
  "newBoundaries": ["boundary to add", ...],
  "newPrivateNotes": ["note to add", ...]
}

Rules:
- interviewTopics are questions/areas AI Bestie will probe — specific, not generic
- newProbe must be a short, human-readable label (e.g. "Financial stability & ambition")
- Only add to signal arrays if the user's instructions clearly imply NEW structured preferences
- Do not duplicate what already exists
- Keep all items concise (one sentence max)`;

		const userMessage = `Her current focus areas:
${currentTopics.length > 0 ? currentTopics.map(t => `- ${t}`).join('\n') : '(none yet)'}

Her new instructions for AI Bestie:
"${customPrompt}"`;

		const client = getClaudeClient();
		const response = await client.messages.create({
			model: 'claude-sonnet-4-6',
			max_tokens: 1024,
			system: systemPrompt,
			messages: [{ role: 'user', content: userMessage }]
		});

		const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
		const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

		const parsed = JSON.parse(jsonText) as {
			interviewTopics: string[];
			newProbe?: string;
			newEmotionalSignals: string[];
			newDealbreakers: string[];
			newBoundaries: string[];
			newPrivateNotes: string[];
		};

		// 4. Merge new insights into preferences
		const insightsAdded: string[] = [];
		const updates: Partial<typeof prefs> = {};

		if (parsed.newEmotionalSignals?.length) {
			const existing = new Set(prefs.emotionalSignals);
			const toAdd = parsed.newEmotionalSignals.filter(s => !existing.has(s));
			if (toAdd.length) {
				updates.emotionalSignals = [...prefs.emotionalSignals, ...toAdd];
				insightsAdded.push(...toAdd.map(s => `Emotional signal: ${s}`));
			}
		}

		if (parsed.newDealbreakers?.length) {
			const existing = new Set(prefs.dealbreakers);
			const toAdd = parsed.newDealbreakers.filter(s => !existing.has(s));
			if (toAdd.length) {
				updates.dealbreakers = [...prefs.dealbreakers, ...toAdd];
				insightsAdded.push(...toAdd.map(s => `Dealbreaker: ${s}`));
			}
		}

		if (parsed.newBoundaries?.length) {
			const existing = new Set(prefs.boundaries);
			const toAdd = parsed.newBoundaries.filter(s => !existing.has(s));
			if (toAdd.length) {
				updates.boundaries = [...prefs.boundaries, ...toAdd];
				insightsAdded.push(...toAdd.map(s => `Boundary: ${s}`));
			}
		}

		if (parsed.newPrivateNotes?.length) {
			const existing = new Set(prefs.privateCompatibilityNotes);
			const toAdd = parsed.newPrivateNotes.filter(s => !existing.has(s));
			if (toAdd.length) {
				updates.privateCompatibilityNotes = [...prefs.privateCompatibilityNotes, ...toAdd];
				insightsAdded.push(...toAdd.map(s => `Note: ${s}`));
			}
		}

		if (Object.keys(updates).length > 0) {
			await updatePreferences(userId, updates, `AI Bestie configure: "${customPrompt.slice(0, 80)}"`);
		}

		return json({
			interviewTopics: parsed.interviewTopics ?? [],
			insightsAdded,
			newProbe: parsed.newProbe ?? customPrompt.slice(0, 60)
		});
	} catch (err) {
		logError('POST /api/ai-bestie/configure', err, ErrorType.DATABASE_ERROR, { userId });
		throw err;
	}
};

/**
 * GET /api/ai-bestie/configure?userId=xxx
 *
 * Returns current interview topics + full preferences for the configure UI.
 * Auth: userId passed as query param.
 */
export const GET: RequestHandler = async ({ url }) => {
	const userId = url.searchParams.get('userId') ?? '';
	if (!userId) {
		return json({ error: 'userId query param required' }, { status: 400 });
	}

	try {
		const supabase = getSupabase();
		const [prefs, userRow] = await Promise.all([
			loadPreferences(userId),
			supabase
				.from('verified_vibe_users')
				.select('first_name')
				.eq('id', userId)
				.maybeSingle()
				.then(({ data }) => data)
		]);
		const userName: string = (userRow as any)?.first_name ?? 'her';
		const interviewTopics = deriveInterviewTopics(prefs, userName); // kept for legacy callers
		const probeTopics = deriveProbeTopics(prefs, userName);          // structured format for VV UI
		return json({ interviewTopics, probeTopics, preferences: prefs });
	} catch (err) {
		logError('GET /api/ai-bestie/configure', err, ErrorType.DATABASE_ERROR, { userId });
		throw err;
	}
};

/**
 * DELETE /api/ai-bestie/configure
 *
 * Removes a single item from a preferences category.
 * Body: { userId, category, item }
 */
export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json() as { userId?: string; category?: string; item?: string };
	const userId = (body.userId ?? '').trim();
	const category = (body.category ?? '').trim();
	const item = (body.item ?? '').trim();

	if (!userId || !category || !item) {
		return json({ error: 'userId, category and item are required' }, { status: 400 });
	}

	const allowed = ['emotionalSignals', 'dealbreakers', 'maturitySignals', 'boundaries', 'lifestyleSignals'];
	if (!allowed.includes(category)) {
		return json({ error: 'Invalid category' }, { status: 400 });
	}

	try {
		const prefs = await loadPreferences(userId);
		const current = (prefs as any)[category] as string[];
		const updated = current.filter((v: string) => v !== item);
		await updatePreferences(userId, { [category]: updated } as any, `Removed probe item: "${item.slice(0, 60)}"`);

		// Re-derive topics after deletion
		const supabase = getSupabase();
		const { data: userRow } = await supabase
			.from('verified_vibe_users')
			.select('first_name')
			.eq('id', userId)
			.maybeSingle();
		const userName: string = (userRow as any)?.first_name ?? 'her';
		const newPrefs = await loadPreferences(userId);
		const probeTopics = deriveProbeTopics(newPrefs, userName);
		const interviewTopics = deriveInterviewTopics(newPrefs, userName);

		return json({ ok: true, probeTopics, interviewTopics });
	} catch (err) {
		logError('DELETE /api/ai-bestie/configure', err, ErrorType.DATABASE_ERROR, { userId });
		throw err;
	}
};

/**
 * Structured probe topics for the VV configure UI — one object per category,
 * with individual items so the UI can render crisp bullets + delete buttons.
 */
export interface ProbeTopic {
	category: 'emotionalSignals' | 'dealbreakers' | 'maturitySignals' | 'boundaries' | 'lifestyleSignals';
	emoji: string;
	heading: string;
	color: 'green' | 'red' | 'amber' | 'purple' | 'blue';
	items: string[];
}

function deriveProbeTopics(
	prefs: Awaited<ReturnType<typeof loadPreferences>>,
	userName = 'her'
): ProbeTopic[] {
	const poss = userName === 'her' ? 'Her' : `${userName}'s`;
	const topics: ProbeTopic[] = [];

	if (prefs.emotionalSignals.length) {
		topics.push({
			category: 'emotionalSignals',
			emoji: '🟢',
			heading: `${poss} green flags`,
			color: 'green',
			items: prefs.emotionalSignals,
		});
	}
	if (prefs.dealbreakers.length) {
		topics.push({
			category: 'dealbreakers',
			emoji: '🔴',
			heading: 'Hard dealbreakers',
			color: 'red',
			items: prefs.dealbreakers,
		});
	}
	if (prefs.maturitySignals.length) {
		topics.push({
			category: 'maturitySignals',
			emoji: '⚡',
			heading: 'Maturity & stability',
			color: 'purple',
			items: prefs.maturitySignals,
		});
	}
	if (prefs.boundaries.length) {
		topics.push({
			category: 'boundaries',
			emoji: '🚫',
			heading: `${poss} firm boundaries`,
			color: 'amber',
			items: prefs.boundaries,
		});
	}
	if (prefs.lifestyleSignals.length) {
		topics.push({
			category: 'lifestyleSignals',
			emoji: '🏠',
			heading: 'Lifestyle compatibility',
			color: 'blue',
			items: prefs.lifestyleSignals,
		});
	}
	return topics;
}

/**
 * Derive 5 comprehensive, readable probe topics from the user's structured preferences.
 * Each category gets one bullet listing ALL its items. Uses the user's real name.
 */
function deriveInterviewTopics(
	prefs: Awaited<ReturnType<typeof loadPreferences>>,
	userName = 'her'
): string[] {
	// Build possessive: "Neha's" or fall back to "her"
	const poss = userName === 'her' ? 'Her' : `${userName}'s`;

	const topics: string[] = [];

	if (prefs.emotionalSignals.length) {
		topics.push(
			`🟢 Emotional availability — ${poss.toLowerCase()} green flags: ${prefs.emotionalSignals.join(', ')}`
		);
	}

	if (prefs.dealbreakers.length) {
		topics.push(
			`🔴 Hard dealbreakers — must screen for: ${prefs.dealbreakers.join(', ')}`
		);
	}

	if (prefs.maturitySignals.length) {
		topics.push(
			`⚡ Maturity & stability markers — ${poss.toLowerCase()} expectations: ${prefs.maturitySignals.join(', ')}`
		);
	}

	if (prefs.boundaries.length) {
		topics.push(
			`🚫 ${poss} firm boundaries — probes for respect of: ${prefs.boundaries.join(', ')}`
		);
	}

	if (prefs.lifestyleSignals.length) {
		topics.push(
			`🏠 Lifestyle compatibility — checks for: ${prefs.lifestyleSignals.join(', ')}`
		);
	}

	return topics.filter(Boolean);
}
