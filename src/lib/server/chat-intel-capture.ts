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

/** At most this many ledger entries from a single message — a long message that
 *  genuinely spans four topics is rare; more than this is the model padding. */
const LEDGER_MAX_PER_MESSAGE = 3;
/** Verbatim, but not unbounded — a ledger entry is one answer, not an essay. */
const LEDGER_ANSWER_MAX_LEN = 300;

/** One gap-topic answer in his own words, bound for vv_answer_ledger. */
interface LedgerAnswer {
	topic: string;
	answer: string;
}

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
 * Normalise for the verbatim check: collapse whitespace, drop case. We are not
 * trying to match exactly, only to prove the model quoted rather than invented.
 */
function norm(s: string): string {
	return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * The verbatim gate. Keeps only the entries the man demonstrably typed, dedupes
 * within the message, and caps how many one message can contribute.
 *
 * Exported for tests: this is the rule that makes the ledger safe to quote back,
 * so it is worth pinning down independently of the model that feeds it.
 */
export function selectLedgerRows(message: string, answers: LedgerAnswer[]): LedgerAnswer[] {
	const haystack = norm(message);
	const rows: LedgerAnswer[] = [];
	const seen = new Set<string>();

	for (const a of answers) {
		const topic = (a.topic ?? '').trim().toLowerCase();
		const answer = (a.answer ?? '').trim().slice(0, LEDGER_ANSWER_MAX_LEN);
		if (!topic || answer.length < MIN_LEN) continue;
		// He must actually have said it. A paraphrase is a fabrication as far as a
		// later Bestie is concerned, because she will quote it back as his words.
		if (!haystack.includes(norm(answer))) continue;
		const key = `${topic}::${norm(answer)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push({ topic, answer });
		if (rows.length >= LEDGER_MAX_PER_MESSAGE) break;
	}
	return rows;
}

/**
 * Persist this message's gap-topic answers to the ledger (Requirement §E).
 *
 * Two guards do the real work here:
 *
 * VERBATIM IS ENFORCED, NOT REQUESTED. The prompt asks for his exact words, and
 * we then check the answer really is a substring of what he typed. Anything the
 * model paraphrased or embellished is dropped rather than stored. The ledger is
 * quoted back to him by a later Bestie, so an invented "you mentioned…" would be
 * worse than asking the question again.
 *
 * TOPICS ARE CANONICAL. A new topic is inserted first so the foreign key holds.
 * The set grows out of what conversations actually cover, but every entry lands
 * on a shared key — free-text topics would mean "wants kids eventually" and
 * "does he want children" never match, and the duplicate question we exist to
 * suppress survives anyway.
 *
 * Consent is NOT consulted. Capture always runs; consent gates only whether a
 * Bestie may READ this (see the reader in bestie-responder). That way a man who
 * says no today still has something worth unlocking if he says yes later.
 */
async function persistLedgerAnswers(
	supabase: any,
	userId: string,
	message: string,
	answers: LedgerAnswer[],
	knownTopics: Set<string>,
	proposed: Map<string, string>
): Promise<void> {
	const rows = selectLedgerRows(message, answers);
	if (rows.length === 0) return;

	// Register any topic the extractor proposed, before the rows that reference it.
	const newTopics = [...new Set(rows.map((r) => r.topic))].filter((t) => !knownTopics.has(t));
	if (newTopics.length > 0) {
		await supabase.from('vv_ledger_topics').upsert(
			newTopics.map((key) => ({ key, label: proposed.get(key) ?? key, origin: 'chat' })),
			{ onConflict: 'key' }
		);
	}

	// Don't restate what he has already said on this topic — the ledger is a set of
	// answers, not a transcript, and a man who repeats himself across threads would
	// otherwise accumulate near-duplicates that make the read noisy.
	const { data: existing } = await supabase
		.from('vv_answer_ledger')
		.select('topic, answer')
		.eq('user_id', userId)
		.in('topic', [...new Set(rows.map((r) => r.topic))]);
	const already = new Set(
		((existing ?? []) as Array<{ topic: string; answer: string }>).map(
			(e) => `${e.topic}::${norm(e.answer)}`
		)
	);

	const fresh = rows.filter((r) => !already.has(`${r.topic}::${norm(r.answer)}`));
	if (fresh.length === 0) return;

	await supabase
		.from('vv_answer_ledger')
		.insert(fresh.map((r) => ({ user_id: userId, topic: r.topic, answer: r.answer })));
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

	// The canonical topic set, for the ledger half of the extraction. Read fresh
	// each time because it GROWS — a topic a previous message coined is available
	// to this one, which is what keeps men converging on shared keys instead of
	// each spawning private synonyms.
	const { data: topicRows } = await supabase.from('vv_ledger_topics').select('key, label');
	const topics = (topicRows ?? []) as Array<{ key: string; label: string }>;
	const knownTopics = new Set(topics.map((t) => t.key));
	const topicMenu = topics.length
		? topics.map((t) => `  ${t.key} — ${t.label}`).join('\n')
		: '  (none yet)';

	// Extract only what is explicitly stated — never infer.
	const { getClaudeClient, CLAUDE_MODEL } = await import('$lib/claude');
	const client = getClaudeClient();
	const response = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 700,
		messages: [{
			role: 'user',
			content: `A man sent this message to a potential match (or her AI Bestie): "${content}"

Extract ONLY what he explicitly states — do not infer or embellish.

- selfClaims: short factual statements ABOUT HIMSELF that bear on what he brings to a relationship — career/job, income or money, education, fitness/health, travel, lifestyle, family, social or professional standing. One concise claim per item (e.g. "Works as a software engineer", "Goes to the gym 5x a week", "Travels abroad often").
- statedPreferences: short statements of what he WANTS in a partner or his dealbreakers (e.g. "Wants someone ambitious", "Doesn't want smokers").
- ledgerAnswers: the parts of this message that ANSWER one of the topics below, so he never has to answer it again. Each entry is {"topic":"<key>","answer":"<his exact words>"}.

Topics:
${topicMenu}

Rules for ledgerAnswers — these matter more than coverage:
- "answer" MUST be copied word-for-word from his message. Quote the sentence or clause he actually wrote. Do NOT paraphrase, summarise, correct his grammar, or write in the third person. An entry that is not a literal quote will be thrown away.
- Only include a topic when the message genuinely answers it. Passing mentions are not answers. Most messages produce zero or one entry.
- If he clearly answers something none of the topics cover, use {"topic":"new","newKey":"<short_snake_case_key>","newLabel":"<short human label>","answer":"<his exact words>"}. Do this sparingly — prefer an existing topic whenever one fits.
- Never include anything he says ABOUT the woman he is talking to, or about how he feels about her. This ledger is only about him.

Return JSON only, no markdown:
{"selfClaims":[],"statedPreferences":[],"ledgerAnswers":[]}
Return empty arrays if he states nothing relevant. Never invent.`
		}]
	});

	const block = response.content[0];
	if (block.type !== 'text') return;
	const raw = block.text.trim()
		.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
	let parsed: { selfClaims?: unknown; statedPreferences?: unknown; ledgerAnswers?: unknown };
	try { parsed = JSON.parse(raw); } catch { return; }

	const selfClaims = Array.isArray(parsed.selfClaims)
		? parsed.selfClaims.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		: [];
	const statedPreferences = Array.isArray(parsed.statedPreferences)
		? parsed.statedPreferences.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
		: [];

	// Ledger first, and on its own error boundary. It is the newer, more fragile
	// half — a bad topic key or a failed insert must never cost us the vector
	// update, which has been running in production since §11e shipped.
	const ledgerAnswers: LedgerAnswer[] = [];
	const proposedLabels = new Map<string, string>();
	if (Array.isArray(parsed.ledgerAnswers)) {
		for (const e of parsed.ledgerAnswers) {
			if (!e || typeof e !== 'object') continue;
			const entry = e as { topic?: unknown; newKey?: unknown; newLabel?: unknown; answer?: unknown };
			const answer = typeof entry.answer === 'string' ? entry.answer : '';
			if (!answer) continue;
			// "new" means the model is coining a topic; the real key rides in newKey.
			const declared = typeof entry.topic === 'string' ? entry.topic.trim().toLowerCase() : '';
			const coined = typeof entry.newKey === 'string' ? entry.newKey.trim().toLowerCase() : '';
			const topic = declared === 'new' ? coined : declared;
			if (!topic || !/^[a-z0-9_]{2,40}$/.test(topic)) continue;
			if (!knownTopics.has(topic)) {
				const label = typeof entry.newLabel === 'string' ? entry.newLabel.trim().slice(0, 80) : '';
				proposedLabels.set(topic, label || topic.replace(/_/g, ' '));
			}
			ledgerAnswers.push({ topic, answer });
		}
	}
	if (ledgerAnswers.length > 0) {
		try {
			await persistLedgerAnswers(supabase, senderId, content, ledgerAnswers, knownTopics, proposedLabels);
		} catch (err) {
			console.error('[chat-intel] ledger write failed (non-critical):', err);
		}
	}

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
