/**
 * Male chat-intel capture (Design §11e — "continuous multimodal vector updates").
 *
 * The woman's side already distils her chat into preferences
 * (extractAndUpdatePreferences in chat/send). The man's side had no equivalent:
 * everything he typed about himself in a Bestie thread was dropped — his profile,
 * preferences and vectors never moved. This closes that leak.
 *
 * What a man SAYS raises his claimed attribute level v (at the modest CONFIDENCE_MIN
 * floor — never his proven-ness c, which stays deterministic from proofs), and what
 * he says he WANTS refines his extracted preference weights w. We do this by writing
 * a bounded, distilled "chatDisclosures" record onto his master profile, which the
 * vector builder already reads (gatherInput) — so the next rebuild folds it in with
 * no separate scoring path. Claims stay cheap; proofs remain the only lever on c.
 *
 * Cost discipline (Design §12 "keep cheap"): one small extraction call per message,
 * and a vector rebuild is scheduled ONLY when the message actually adds a new claim
 * or preference AND the last rebuild wasn't in the past few minutes.
 */

import { getSupabase } from './supabase';
import { scheduleVectorRebuild } from './vector-rebuild';

export interface ChatDisclosures {
	/** Explicit self-statements that bear on how much he brings (career, income, fitness, travel…). */
	selfClaims: string[];
	/** Explicit things he says he wants / dealbreakers in a partner. */
	statedPreferences: string[];
	updatedAt: string;
	/** When we last scheduled a vector rebuild off these — used to debounce. */
	lastRebuildAt?: string;
}

const MAX_SELF_CLAIMS = 30;
const MAX_STATED_PREFS = 20;
const MIN_LEN = 10;                       // skip trivial "ok"/"haha" sends
const REBUILD_MIN_INTERVAL_MS = 3 * 60 * 1000; // debounce vector rebuilds

/** Merge new items in front, dedupe case-insensitively, cap length. */
function mergeCapped(existing: string[], incoming: string[], cap: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of [...incoming, ...existing]) {
		const key = s.trim().toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(s.trim());
		if (out.length >= cap) break;
	}
	return out;
}

/**
 * Distil one of a man's chat messages into self-claims + stated preferences and
 * fold it into his vectors. Only processes male senders; safe to fire-and-forget.
 */
export async function captureMaleChatIntel(senderId: string, messageContent: string): Promise<void> {
	const content = messageContent.trim();
	if (content.length < MIN_LEN) return;

	const supabase = getSupabase() as any;

	// Only process male senders — the woman's side is handled elsewhere.
	const { data: sender } = await supabase
		.from('verified_vibe_users')
		.select('gender, archetype')
		.eq('id', senderId)
		.maybeSingle();
	if (!sender) return;
	const isMale =
		sender.gender === 'man' ||
		(sender.gender !== 'woman' && String(sender.archetype ?? '').toLowerCase().includes('man'));
	if (!isMale) return;

	// Extract only what is explicitly stated — never infer.
	const { getClaudeClient, CLAUDE_MODEL } = await import('$lib/claude');
	const client = getClaudeClient();
	const response = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 250,
		messages: [{
			role: 'user',
			content: `A man sent this message to a potential match (or her AI Bestie): "${content}"

Extract ONLY what he explicitly states — do not infer or embellish.

- selfClaims: short factual statements ABOUT HIMSELF that bear on what he brings to a relationship — career/job, income or money, education, fitness/health, travel, lifestyle, family, social or professional standing. One concise claim per item (e.g. "Works as a software engineer", "Goes to the gym 5x a week", "Travels abroad often").
- statedPreferences: short statements of what he WANTS in a partner or his dealbreakers (e.g. "Wants someone ambitious", "Doesn't want smokers").

Return JSON only, no markdown:
{"selfClaims":[],"statedPreferences":[]}
Return empty arrays if he states nothing relevant. Never invent.`
		}]
	});

	const block = response.content[0];
	if (block.type !== 'text') return;
	const raw = block.text.trim()
		.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
	let parsed: { selfClaims?: unknown; statedPreferences?: unknown };
	try { parsed = JSON.parse(raw); } catch { return; }

	const selfClaims = Array.isArray(parsed.selfClaims)
		? parsed.selfClaims.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		: [];
	const statedPreferences = Array.isArray(parsed.statedPreferences)
		? parsed.statedPreferences.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		: [];
	if (selfClaims.length === 0 && statedPreferences.length === 0) return;

	// Merge into the master profile's chatDisclosures without clobbering other keys.
	const { data: row } = await supabase
		.from('user_master_profile')
		.select('data')
		.eq('user_id', senderId)
		.maybeSingle();
	const data = (row?.data ?? {}) as Record<string, unknown>;
	const prev = (data.chatDisclosures ?? {}) as Partial<ChatDisclosures>;

	const merged: ChatDisclosures = {
		selfClaims: mergeCapped(prev.selfClaims ?? [], selfClaims, MAX_SELF_CLAIMS),
		statedPreferences: mergeCapped(prev.statedPreferences ?? [], statedPreferences, MAX_STATED_PREFS),
		updatedAt: new Date().toISOString(),
		lastRebuildAt: prev.lastRebuildAt,
	};

	// Debounce the (LLM-backed) vector rebuild: only when it's been a few minutes.
	const lastRebuild = prev.lastRebuildAt ? Date.parse(prev.lastRebuildAt) : 0;
	const shouldRebuild = Date.now() - lastRebuild > REBUILD_MIN_INTERVAL_MS;
	if (shouldRebuild) merged.lastRebuildAt = new Date().toISOString();

	await supabase
		.from('user_master_profile')
		.upsert({ user_id: senderId, data: { ...data, chatDisclosures: merged } }, { onConflict: 'user_id' });

	if (shouldRebuild) scheduleVectorRebuild(senderId);
}
