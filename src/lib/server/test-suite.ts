// ============================================================
// test-suite.ts — admin Test Suite cores
//
// These cores drive the REAL agents: they reuse the exact production prompt
// builders (src/lib/prompts.ts), the exact KB retrieval (embeddings + vector
// search), the exact profile-service reads, and the exact Claude model — so
// what the operator sees is byte-faithful to production. The ONLY difference
// from the live endpoints is `persist:false`: every write a live agent would
// make is recorded in the trace as a skipped side-effect, never executed.
//
// See AI_TEST_SUITE_DESIGN.md §0, §3, §4, §7.
// ============================================================

import { getSupabase } from './supabase';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '../claude';
import { getEmbedding } from '../embeddings';
import { searchBookChunks } from '../vectorstore';
import { loadPreferences } from './profile-service';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanAdvisorSystemPrompt,
	buildBestieReplyPrompt
} from '../prompts';
import { loadWingmanAdvisorContext } from './wingman-advisor-context';
import { buildCompetitiveSnapshot } from './competitive-snapshot';
import { piiScan, haikusValidate, SAFE_FALLBACK } from './ai-compliance';
import {
	hardFilter,
	softScore,
	buildSoftScorePrompt,
	type WingmanPoolRow,
	type BestiePoolRow
} from './matchmaker-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentTrace, TraceKbChunk } from './agent-trace';

// Untyped client for the Test Suite's own ts_* tables, which aren't in the
// generated Database types. Reads/writes here are isolated from production.
function tsdb(): SupabaseClient {
	return getSupabase() as unknown as SupabaseClient;
}

// ── Roster ──────────────────────────────────────────────────────────────────

export interface RosterUser {
	id: string;
	first_name: string;
	gender: string;
	age: number;
	city: string;
	archetype: string;
	trust_score: number;
	in_pool: boolean;
}

export function assistantFor(gender: string): 'bestie' | 'wingman' {
	return gender === 'woman' ? 'bestie' : 'wingman';
}

/** Load the full roster of users for the picker, flagged with Matchmaker-pool membership. */
export async function listRoster(): Promise<RosterUser[]> {
	const sb = getSupabase();
	const [{ data: users }, { data: wingmen }, { data: besties }] = await Promise.all([
		sb
			.from('verified_vibe_users')
			.select('id, first_name, gender, age, city, archetype, trust_score')
			.order('first_name', { ascending: true }),
		sb.from('vv_pool_wingmen').select('user_id'),
		sb.from('vv_pool_besties').select('user_id')
	]);

	const pool = new Set<string>([
		...((wingmen ?? []) as { user_id: string }[]).map((r) => r.user_id),
		...((besties ?? []) as { user_id: string }[]).map((r) => r.user_id)
	]);

	return ((users ?? []) as Omit<RosterUser, 'in_pool'>[]).map((u) => ({
		...u,
		in_pool: pool.has(u.id)
	}));
}

async function getUser(userId: string): Promise<RosterUser | null> {
	const sb = getSupabase();
	const { data } = await sb
		.from('verified_vibe_users')
		.select('id, first_name, gender, age, city, archetype, trust_score')
		.eq('id', userId)
		.single();
	if (!data) return null;
	return { ...(data as Omit<RosterUser, 'in_pool'>), in_pool: true };
}

/** Latest version number of a user's profile row (for the trace only). */
async function profileVersion(
	userId: string,
	type: 'preferences' | 'personality'
): Promise<number | null> {
	const sb = getSupabase();
	const { data } = await sb
		.from('ai_assistant_profiles')
		.select('version')
		.eq('user_id', userId)
		.eq('profile_type', type)
		.order('version', { ascending: false })
		.limit(1)
		.single();
	return (data as { version: number } | null)?.version ?? null;
}

// ── Run logging (Test Suite's OWN tables — never the production QA queue) ───────

export interface RunOpts {
	persist?: boolean;
	reviewer?: string | null;
}

interface RunRow {
	id: string;
	case_type: string;
	agent: string;
	subject_user_id: string | null;
	counterpart_user_id: string | null;
	reviewer: string | null;
	input: unknown;
	output: unknown;
	trace: AgentTrace;
	created_at: string;
}

/**
 * Persist a run to ts_runs when the operator enabled "Persist this run".
 * Guarded: if the ts_runs table hasn't been migrated yet, this no-ops with a
 * warning rather than breaking the run. Returns the new row id, or null.
 */
async function logRun(args: {
	caseType: 'advisor' | 'match_reply' | 'matchmaker';
	agent: string;
	subjectUserId: string | null;
	counterpartUserId: string | null;
	reviewer: string | null;
	input: unknown;
	output: unknown;
	trace: AgentTrace;
}): Promise<string | null> {
	try {
		const sb = tsdb();
		const { data, error } = await sb
			.from('ts_runs')
			.insert({
				case_type: args.caseType,
				agent: args.agent,
				subject_user_id: args.subjectUserId,
				counterpart_user_id: args.counterpartUserId,
				reviewer: args.reviewer,
				input: args.input,
				output: args.output,
				trace: args.trace
			})
			.select('id')
			.single();
		if (error) {
			console.warn('[test-suite] ts_runs insert skipped:', error.message);
			return null;
		}
		return (data as { id: string }).id;
	} catch (e) {
		console.warn('[test-suite] ts_runs insert failed:', e instanceof Error ? e.message : e);
		return null;
	}
}

/** Recent runs for the History tab. Returns [] if the table isn't migrated yet. */
export async function listRuns(limit = 50): Promise<RunRow[]> {
	try {
		const sb = tsdb();
		const { data, error } = await sb
			.from('ts_runs')
			.select('*')
			.order('created_at', { ascending: false })
			.limit(limit);
		if (error) return [];
		return (data ?? []) as RunRow[];
	} catch {
		return [];
	}
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const CITATION_RE = /\*Based on:\s*([^*]+)\*/g;

function parseCitations(text: string): string[] {
	const out: string[] = [];
	let m: RegExpExecArray | null;
	const re = new RegExp(CITATION_RE);
	while ((m = re.exec(text)) !== null) out.push(m[1].trim());
	return out;
}

function chunkToTrace(c: { content: string; chapter: string; similarity: number }): TraceKbChunk {
	return {
		chapter: c.chapter,
		similarity: c.similarity,
		preview: c.content.length > 240 ? c.content.slice(0, 240) + '…' : c.content
	};
}

function buildBookContext(chunks: { content: string; chapter: string }[]): string {
	return chunks.map((c) => `[${c.chapter}] ${c.content}`).join('\n\n');
}

function claudeText(block: { type: string }): string {
	return block.type === 'text' && 'text' in block ? (block as { text: string }).text : '';
}

// Detects "intelligence intent" the same way the production Wingman chat route does.
const INTEL_PATTERNS = [
	'how can i improve',
	'better matches',
	'improve my ranking',
	'beat the competition',
	'how do i compare',
	'who should i prioritize',
	'how am i doing'
];
function detectIntelIntent(message: string): boolean {
	const lower = message.toLowerCase();
	return INTEL_PATTERNS.some((p) => lower.includes(p));
}

// ── Case 1: advisor (Bestie or Wingman) ────────────────────────────────────────

export async function runAdvisor(
	userId: string,
	message: string,
	opts: RunOpts = {}
): Promise<{ reply: string; citations: string[]; trace: AgentTrace; runId: string | null }> {
	const user = await getUser(userId);
	if (!user) throw new Error('user not found');
	// Wingman and Bestie advisors are genuinely different production paths — the
	// Wingman advisor is profile/match/upload-aware and does NO book KB, while the
	// Bestie advisor is book-grounded. Route to the matching faithful core.
	return assistantFor(user.gender) === 'wingman'
		? runWingmanAdvisor(user, message, opts)
		: runBestieAdvisor(user, message, opts);
}

/**
 * Faithful reproduction of the live AI Wingman advisor
 * (src/routes/api/verified-vibe/ai-wingman/chat). Shares the EXACT context
 * loader and system-prompt builder with production. No book KB (live doesn't
 * use it), no pending-report pop (that mutates state), persist:false.
 */
async function runWingmanAdvisor(
	user: RosterUser,
	message: string,
	opts: RunOpts
): Promise<{ reply: string; citations: string[]; trace: AgentTrace; runId: string | null }> {
	const supabase = getSupabase();

	// Same context the live endpoint assembles — master profile, verified proofs,
	// trust artifacts, admirers, and current matches with abstracted preferences.
	const ctx = await loadWingmanAdvisorContext(supabase, user.id, { intent: 'chat' });

	// Same synchronous competitive snapshot the live endpoint grounds the reply
	// with (cheap SQL, no Claude, read-only) — keeps the Test Suite prompt in
	// lockstep with production.
	const { promptBlock: competitiveContext } = await buildCompetitiveSnapshot(supabase, user.id);

	// Same system prompt as production. pendingReportContext is empty: popping a
	// pending report is a state mutation we must not perform in test mode.
	const systemPrompt = buildAIWingmanAdvisorSystemPrompt({
		personalityContext: ctx.personalityContext,
		masterProfileContext: ctx.masterProfileContext,
		artifactsContext: ctx.artifactsContext,
		admirerContext: ctx.admirerContext,
		matchContext: ctx.matchContext,
		competitiveContext,
		pendingReportContext: ''
	});

	// Claude — real model, real client. max_tokens mirrors the live endpoint (700).
	const WINGMAN_ADVISOR_MAX_TOKENS = 700;
	const client = getClaudeClient();
	const tClaude = Date.now();
	const resp = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: WINGMAN_ADVISOR_MAX_TOKENS,
		system: systemPrompt,
		messages: [{ role: 'user', content: message }]
	});
	const claudeMs = Date.now() - tClaude;
	const rawReply = claudeText(resp.content[0]);

	// Same compliance gate the live endpoint runs (PII regex → Haiku validator,
	// advisor context). READ-ONLY here: on a violation we substitute the safe
	// fallback exactly like production, but never write to ai_assistant_violations.
	const tCompliance = Date.now();
	let reply = rawReply;
	let complianceDetail: string;
	const regexHits = piiScan(rawReply);
	if (regexHits.length > 0) {
		reply = SAFE_FALLBACK;
		complianceDetail = `BLOCKED at regex stage (${regexHits.join(', ')}) → safe fallback substituted. Would log to ai_assistant_violations (detection_stage=regex). Skipped — test mode.`;
	} else {
		const { clean, violations } = await haikusValidate(rawReply, 'advisor');
		if (!clean) {
			reply = SAFE_FALLBACK;
			complianceDetail = `BLOCKED by Haiku validator (${violations.join('; ')}) → safe fallback substituted. Would log to ai_assistant_violations (detection_stage=haiku_validator). Skipped — test mode.`;
		} else {
			complianceDetail = 'passed — PII regex clean, Haiku validator (advisor) clean. Reply delivered as-is.';
		}
	}
	const complianceMs = Date.now() - tCompliance;
	const citations = parseCitations(reply); // live Wingman advisor has no citation rule → []

	const intel = detectIntelIntent(message);
	const sideEffects: AgentTrace['sideEffects'] = [
		{
			name: 'complianceGate',
			wouldPersist: false,
			detail: complianceDetail
		},
		{
			name: 'queueIntelligenceReport',
			wouldPersist: false,
			detail: intel
				? 'intelligence intent detected → would queue a per_match_ranking report. Detected, not queued.'
				: 'intelligence intent = false. No report path triggered.'
		},
		{
			name: 'appendAdvisorChat',
			wouldPersist: false,
			detail: 'Would persist this exchange to ai_assistant_advisor_chats (assistant_type=wingman). Skipped — test mode.'
		},
		{
			name: 'vv_ai_response_timings.upsert',
			wouldPersist: false,
			detail: `response_type=wingman · claude_ms=${claudeMs}. Not written — Analytics dashboard stays clean.`
		}
	];

	const trace: AgentTrace = {
		agent: 'wingman_advisor',
		startedAt: new Date().toISOString(),
		subject: { userId: user.id, name: user.first_name, gender: user.gender, archetype: user.archetype },
		routing: {
			resolvedAssistant: 'wingman',
			reason: `gender === '${user.gender}' → wingman (ai-greeting routing rule)`
		},
		profile: {
			type: 'personality',
			// user_master_profile has no version column; legacy fallback does.
			version: ctx.profileSource === 'user_master_profile' ? null : await profileVersion(user.id, 'personality'),
			data: ctx.profileData,
			source: ctx.profileSource
		},
		matchContext: {
			matchCount: ctx.matchCount,
			note:
				ctx.matchCount > 0
					? 'Live advisor loads real matches + abstracted preferences into the prompt.'
					: 'No matches — advisor coaches over owner profile, proofs, and uploads.'
		},
		kb: null, // live AI Wingman advisor performs NO book KB retrieval
		claude: {
			model: CLAUDE_MODEL,
			maxTokens: WINGMAN_ADVISOR_MAX_TOKENS,
			systemPrompt,
			userMessage: message,
			rawOutput: rawReply, // raw model output, BEFORE the compliance gate
			usage: { inputTokens: resp.usage?.input_tokens, outputTokens: resp.usage?.output_tokens }
		},
		output: { reply, citations }, // reply = what the user would see (post-compliance)
		sideEffects,
		timing: { totalMs: claudeMs + complianceMs, claudeMs }
	};

	const runId = opts.persist
		? await logRun({
				caseType: 'advisor',
				agent: trace.agent,
				subjectUserId: user.id,
				counterpartUserId: null,
				reviewer: opts.reviewer ?? null,
				input: { message },
				output: { reply, citations },
				trace
			})
		: null;

	return { reply, citations, trace, runId };
}

/**
 * Faithful reproduction of the live AI Bestie advisor — book-grounded, reads her
 * preferences via the profile service. Unchanged from the original shared core.
 */
async function runBestieAdvisor(
	user: RosterUser,
	message: string,
	opts: RunOpts
): Promise<{ reply: string; citations: string[]; trace: AgentTrace; runId: string | null }> {
	// KB retrieval — real embedding + real vector search
	const tEmb = Date.now();
	const embedding = await getEmbedding(message);
	const embeddingMs = Date.now() - tEmb;
	const tKb = Date.now();
	const chunks = await searchBookChunks(embedding, 5);
	const kbMs = Date.now() - tKb;
	const bookContext = buildBookContext(chunks);

	// Profile — real profile-service read
	const prefs = await loadPreferences(user.id);
	const version = await profileVersion(user.id, 'preferences');
	const systemPrompt = buildAIBestieSystemPrompt(null, bookContext, undefined, prefs);

	// Claude — real model, real client
	const client = getClaudeClient();
	const tClaude = Date.now();
	const resp = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: MAX_TOKENS,
		system: systemPrompt,
		messages: [{ role: 'user', content: message }]
	});
	const claudeMs = Date.now() - tClaude;
	const reply = claudeText(resp.content[0]);
	const citations = parseCitations(reply);

	const sideEffects: AgentTrace['sideEffects'] = [
		{
			name: 'ai_assistant_conversations.upsert',
			wouldPersist: false,
			detail: 'Would persist this exchange to ai_assistant_conversations (assistant_type=bestie). Skipped — test mode.'
		},
		{
			name: 'autoUpdateProfile',
			wouldPersist: false,
			detail: `Would analyze this turn for new preferences signals and write a v${
				(version ?? 0) + 1
			} row to ai_assistant_profiles. Skipped — the profile the agent learns from is left untouched.`
		},
		{
			name: 'vv_ai_response_timings.upsert',
			wouldPersist: false,
			detail: `response_type=bestie_advisor · claude_ms=${claudeMs}. Not written — Analytics dashboard stays clean.`
		}
	];

	const trace: AgentTrace = {
		agent: 'bestie_advisor',
		startedAt: new Date().toISOString(),
		subject: { userId: user.id, name: user.first_name, gender: user.gender, archetype: user.archetype },
		routing: {
			resolvedAssistant: 'bestie',
			reason: `gender === '${user.gender}' → bestie (ai-greeting routing rule)`
		},
		profile: { type: 'preferences', version, data: prefs, source: 'ai_assistant_profiles' },
		kb: { query: message, embeddingModel: 'voyage-3-lite', topK: 5, chunks: chunks.map(chunkToTrace) },
		claude: {
			model: CLAUDE_MODEL,
			maxTokens: MAX_TOKENS,
			systemPrompt,
			userMessage: message,
			rawOutput: reply,
			usage: { inputTokens: resp.usage?.input_tokens, outputTokens: resp.usage?.output_tokens }
		},
		output: { reply, citations },
		sideEffects,
		timing: { totalMs: embeddingMs + kbMs + claudeMs, claudeMs, embeddingMs, kbMs }
	};

	const runId = opts.persist
		? await logRun({
				caseType: 'advisor',
				agent: trace.agent,
				subjectUserId: user.id,
				counterpartUserId: null,
				reviewer: opts.reviewer ?? null,
				input: { message },
				output: { reply, citations },
				trace
			})
		: null;

	return { reply, citations, trace, runId };
}

// ── Case 2: Bestie reply on the female owner's behalf, in a match chat ──────────

const SIGNAL_COLOR: Record<string, 'green' | 'yellow' | 'red'> = {
	'✅': 'green',
	'⚠️': 'yellow',
	'🚩': 'red'
};

export async function runMatchReply(
	ownerId: string,
	match: { name: string; age?: number; goal?: string; matchId?: string | null },
	message: string,
	opts: RunOpts = {}
): Promise<{
	reply: string;
	citations: string[];
	coachingSignal: { color: 'green' | 'yellow' | 'red'; text: string };
	trace: AgentTrace;
	runId: string | null;
}> {
	const owner = await getUser(ownerId);
	if (!owner) throw new Error('owner not found');
	if (owner.gender !== 'woman') throw new Error('match-reply requires a female owner');

	const prefs = await loadPreferences(ownerId);
	const version = await profileVersion(ownerId, 'preferences');

	// KB retrieval
	const tEmb = Date.now();
	const embedding = await getEmbedding(message);
	const embeddingMs = Date.now() - tEmb;
	const tKb = Date.now();
	const chunks = await searchBookChunks(embedding, 5);
	const kbMs = Date.now() - tKb;

	// Context block built from her real preferences, mirroring the live responder.
	const ctxParts: string[] = [];
	if (prefs.emotionalSignals?.length)
		ctxParts.push(`Emotional signals ${owner.first_name} values: ${prefs.emotionalSignals.join(', ')}`);
	if (prefs.dealbreakers?.length) ctxParts.push(`Dealbreakers to protect: ${prefs.dealbreakers.join(', ')}`);
	if (prefs.boundaries?.length) ctxParts.push(`Boundaries: ${prefs.boundaries.join(', ')}`);
	const contextBlock = ctxParts.length ? `\n\nWhat ${owner.first_name} is looking for:\n- ${ctxParts.join('\n- ')}` : '';

	const systemPrompt = buildBestieReplyPrompt({
		userName: owner.first_name,
		matchName: match.name,
		contextBlock,
		lastMessage: message
	});

	const client = getClaudeClient();
	const tClaude = Date.now();
	const resp = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: MAX_TOKENS,
		system: systemPrompt,
		messages: [{ role: 'user', content: message }]
	});
	const claudeMs = Date.now() - tClaude;
	const raw = claudeText(resp.content[0]);

	// Parse the JSON contract { signal, read, suggestedQuestion }
	let reply = raw;
	let signalColor: 'green' | 'yellow' | 'red' = 'green';
	let signalText = '';
	try {
		const cleaned = raw
			.replace(/^```json\s*/i, '')
			.replace(/^```\s*/i, '')
			.replace(/```\s*$/i, '')
			.trim();
		const parsed = JSON.parse(cleaned) as { signal?: string; read?: string; suggestedQuestion?: string };
		reply = parsed.suggestedQuestion ?? raw;
		signalColor = SIGNAL_COLOR[parsed.signal ?? '✅'] ?? 'green';
		signalText = parsed.read ?? '';
	} catch {
		signalText = 'Could not parse coaching signal from model output.';
	}

	const matchContext = {
		name: match.name,
		age: match.age,
		goal: match.goal,
		matchId: match.matchId ?? 'ad-hoc'
	};

	const trace: AgentTrace = {
		agent: 'bestie_match_reply',
		startedAt: new Date().toISOString(),
		subject: { userId: owner.id, name: owner.first_name, gender: owner.gender, archetype: owner.archetype },
		routing: {
			resolvedAssistant: 'bestie',
			reason: "owner gender === 'woman' → Bestie replies on her behalf in the match chat"
		},
		profile: { type: 'preferences', version, data: prefs, source: 'ai_assistant_profiles' },
		matchContext,
		kb: { query: message, embeddingModel: 'voyage-3-lite', topK: 5, chunks: chunks.map(chunkToTrace) },
		claude: {
			model: CLAUDE_MODEL,
			maxTokens: MAX_TOKENS,
			systemPrompt,
			userMessage: `[as match ${match.name}] ${message}`,
			rawOutput: raw,
			usage: { inputTokens: resp.usage?.input_tokens, outputTokens: resp.usage?.output_tokens }
		},
		output: { reply, citations: [], coachingSignal: { color: signalColor, text: signalText } },
		sideEffects: [
			{
				name: 'verified_vibe_messages.insert',
				wouldPersist: false,
				detail: `Would insert { match_id:${matchContext.matchId}, sender_id:${owner.id}, is_ai:true, ai_signal:"${signalColor}" }. Skipped — the match would NOT see this.`
			},
			{
				name: 'ai_assistant_conversations',
				wouldPersist: false,
				detail: 'exchange_count would increment; last_exchange_at would update (loop-prevention). Not written.'
			},
			{
				name: 'coachingSignal.attach',
				wouldPersist: false,
				detail: `Private "${signalColor}" signal would attach to ${owner.first_name}'s view only. Not persisted.`
			},
			{
				name: 'vv_ai_response_timings.upsert',
				wouldPersist: false,
				detail: `response_type=bestie_match_reply · claude_ms=${claudeMs}. Not written.`
			}
		],
		timing: { totalMs: embeddingMs + kbMs + claudeMs, claudeMs, embeddingMs, kbMs }
	};

	const runId = opts.persist
		? await logRun({
				caseType: 'match_reply',
				agent: 'bestie_match_reply',
				subjectUserId: owner.id,
				counterpartUserId: match.matchId ?? null,
				reviewer: opts.reviewer ?? null,
				input: { match, message },
				output: { reply, coachingSignal: { color: signalColor, text: signalText } },
				trace
			})
		: null;

	return { reply, citations: [], coachingSignal: { color: signalColor, text: signalText }, trace, runId };
}

// ── Case 3: Matchmaker pair score ──────────────────────────────────────────────

async function getPoolRow(
	userId: string,
	table: 'vv_pool_wingmen' | 'vv_pool_besties'
): Promise<Record<string, unknown> | null> {
	const sb = getSupabase();
	const { data } = await sb.from(table).select('*').eq('user_id', userId).single();
	return (data ?? null) as Record<string, unknown> | null;
}

export interface PairScoreResult {
	hardFilter: { excluded: boolean; reasons: { ok: boolean; text: string }[] };
	softScore: { score: number; rationale: string; flags: { color: string; text: string }[] };
	maleInPool: boolean;
	femaleInPool: boolean;
	cached: boolean;
	claudeCalls: number;
	trace: AgentTrace | null;
	runId: string | null;
}

interface ScoredPairCore {
	excluded: boolean;
	reasons: { ok: boolean; text: string }[];
	score: number;
	rationale: string;
	flags: { color: string; text: string }[];
	rawOutput: string;
	claudeMs: number;
	claudeCalls: number;
}

function flagColorFor(score: number): string {
	return score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red';
}

// Runs the REAL hard filter + (if it survives) the REAL soft scorer for one pair.
async function scorePairCore(
	male: RosterUser,
	female: RosterUser,
	maleRow: WingmanPoolRow,
	femaleRow: BestiePoolRow
): Promise<ScoredPairCore> {
	const excluded = hardFilter(maleRow, femaleRow, false);
	const reasons: { ok: boolean; text: string }[] = [
		{ ok: maleRow.availability_status === 'active', text: `${male.first_name} availability = ${maleRow.availability_status}` },
		{ ok: femaleRow.availability_status === 'active', text: `${female.first_name} availability = ${femaleRow.availability_status}` },
		{ ok: !excluded, text: excluded ? 'Eliminated by dealbreaker / availability filter' : 'No dealbreaker conflict between either party' }
	];
	if (excluded) {
		return {
			excluded: true,
			reasons,
			score: 0,
			rationale: 'Pair excluded at hard-filter stage; soft-score not computed (production short-circuits to save a Claude call).',
			flags: [{ color: 'red', text: 'Excluded before scoring' }],
			rawOutput: '{ "skipped": "hard-filter excluded" }',
			claudeMs: 0,
			claudeCalls: 0
		};
	}
	const tClaude = Date.now();
	const scored = await softScore(maleRow, femaleRow); // REAL scorer
	const claudeMs = Date.now() - tClaude;
	const flags = scored.flags.map((f) => ({ color: flagColorFor(scored.score), text: f }));
	return {
		excluded: false,
		reasons,
		score: scored.score,
		rationale: scored.rationale,
		flags,
		rawOutput: JSON.stringify({ score: scored.score, rationale: scored.rationale, flags: scored.flags }, null, 2),
		claudeMs,
		claudeCalls: 1
	};
}

// ── ts_pair_scores cache (keyed by both ids + both profile versions) ────────────

interface CachedPair {
	hard: { excluded: boolean; reasons: { ok: boolean; text: string }[] };
	soft: { score: number; rationale: string; flags: { color: string; text: string }[] };
}

async function getCachedPair(
	maleId: string,
	femaleId: string,
	mv: number,
	fv: number
): Promise<CachedPair | null> {
	try {
		const sb = tsdb();
		const { data, error } = await sb
			.from('ts_pair_scores')
			.select('hard_filter, soft_score')
			.eq('male_user_id', maleId)
			.eq('female_user_id', femaleId)
			.eq('male_profile_version', mv)
			.eq('female_profile_version', fv)
			.single();
		if (error || !data) return null;
		const row = data as { hard_filter: { excluded: boolean; reasons: { ok: boolean; text: string }[] }; soft_score: { score: number; rationale: string; flags: { color: string; text: string }[] } };
		return { hard: row.hard_filter, soft: row.soft_score };
	} catch {
		return null;
	}
}

async function putCachedPair(
	maleId: string,
	femaleId: string,
	mv: number,
	fv: number,
	core: ScoredPairCore
): Promise<void> {
	try {
		const sb = tsdb();
		await sb.from('ts_pair_scores').upsert({
			male_user_id: maleId,
			female_user_id: femaleId,
			male_profile_version: mv,
			female_profile_version: fv,
			hard_filter: { excluded: core.excluded, reasons: core.reasons },
			soft_score: { score: core.score, rationale: core.rationale, flags: core.flags }
		});
	} catch (e) {
		console.warn('[test-suite] ts_pair_scores upsert skipped:', e instanceof Error ? e.message : e);
	}
}

export async function runMatchmaker(maleId: string, femaleId: string, opts: RunOpts = {}): Promise<PairScoreResult> {
	const male = await getUser(maleId);
	const female = await getUser(femaleId);
	if (!male || !female) throw new Error('user not found');

	const maleRow = (await getPoolRow(maleId, 'vv_pool_wingmen')) as WingmanPoolRow | null;
	const femaleRow = (await getPoolRow(femaleId, 'vv_pool_besties')) as BestiePoolRow | null;

	if (!maleRow || !femaleRow) {
		return {
			hardFilter: { excluded: true, reasons: [] },
			softScore: { score: 0, rationale: '', flags: [] },
			maleInPool: !!maleRow,
			femaleInPool: !!femaleRow,
			cached: false,
			claudeCalls: 0,
			trace: null,
			runId: null
		};
	}

	// Cache key: both ids + both current profile versions (null → -1).
	const mv = (await profileVersion(maleId, 'personality')) ?? -1;
	const fv = (await profileVersion(femaleId, 'preferences')) ?? -1;

	let core: ScoredPairCore;
	let cached = false;
	const hit = await getCachedPair(maleId, femaleId, mv, fv);
	if (hit) {
		cached = true;
		core = {
			excluded: hit.hard.excluded,
			reasons: hit.hard.reasons,
			score: hit.soft.score,
			rationale: hit.soft.rationale,
			flags: hit.soft.flags,
			rawOutput: JSON.stringify(hit.soft, null, 2),
			claudeMs: 0,
			claudeCalls: 0
		};
	} else {
		core = await scorePairCore(male, female, maleRow, femaleRow);
		await putCachedPair(maleId, femaleId, mv, fv, core);
	}

	const trace: AgentTrace = {
		agent: 'matchmaker',
		startedAt: new Date().toISOString(),
		subject: {
			userId: `${male.id} × ${female.id}`,
			name: `${male.first_name} × ${female.first_name}`,
			gender: 'pair',
			archetype: `${male.archetype} × ${female.archetype}`
		},
		routing: { resolvedAssistant: 'wingman', reason: 'Matchmaker is a system agent; it scores a pair, not a single assistant.' },
		profile: { type: null, version: null, source: 'default', data: { male: maleRow, female: femaleRow } },
		matchContext: { male: { id: male.id, archetype: male.archetype }, female: { id: female.id, archetype: female.archetype } },
		kb: null,
		claude: {
			model: CLAUDE_MODEL,
			maxTokens: 300,
			systemPrompt: buildSoftScorePrompt(maleRow, femaleRow),
			userMessage: 'Score this pair.',
			rawOutput: core.rawOutput
		},
		output: { reply: core.rationale, citations: [] },
		sideEffects: [
			{
				name: 'ts_pair_scores',
				wouldPersist: true,
				detail: cached
					? `Served from cache (versions m:v${mv} f:v${fv}) — 0 Claude calls this run.`
					: `Scored once and cached under (m:v${mv}, f:v${fv}). Future runs of this pair are free until a profile version changes.`
			},
			{ name: 'vv_matchmaker_runs.insert', wouldPersist: false, detail: `Would log run { pair, score:${core.score}, excluded:${core.excluded} }. Skipped — on-demand test, not nightly batch.` },
			{ name: 'fireMatch', wouldPersist: false, detail: core.excluded || core.score < 70 ? 'Below fire threshold (70). No match would fire.' : `Score ${core.score} ≥ 70 → would create a verified_vibe_matches row + greeting. Skipped.` }
		],
		timing: { totalMs: core.claudeMs, claudeMs: core.claudeMs },
		matchmaker: {
			hardFilter: { excluded: core.excluded, reasons: core.reasons.map((r) => (r.ok ? '✓ ' : '✗ ') + r.text) },
			softScore: { score: core.score, rationale: core.rationale, flags: core.flags },
			cached,
			claudeCalls: core.claudeCalls
		}
	};

	const runId = opts.persist
		? await logRun({
				caseType: 'matchmaker',
				agent: 'matchmaker',
				subjectUserId: male.id,
				counterpartUserId: female.id,
				reviewer: opts.reviewer ?? null,
				input: { maleId, femaleId },
				output: { hardFilter: { excluded: core.excluded }, softScore: { score: core.score } },
				trace
			})
		: null;

	return {
		hardFilter: { excluded: core.excluded, reasons: core.reasons },
		softScore: { score: core.score, rationale: core.rationale, flags: core.flags },
		maleInPool: true,
		femaleInPool: true,
		cached,
		claudeCalls: core.claudeCalls,
		trace,
		runId
	};
}

// ── Warm the matrix: pre-score all uncached pool pairs into ts_pair_scores ───────

export interface WarmResult {
	totalPairs: number;
	alreadyCached: number;
	scoredNow: number;
	remaining: number;
	claudeCalls: number;
}

export async function warmMatrix(maxNewScores = 60): Promise<WarmResult> {
	const sb = getSupabase();
	const [{ data: wingmen }, { data: besties }] = await Promise.all([
		sb.from('vv_pool_wingmen').select('*'),
		sb.from('vv_pool_besties').select('*')
	]);
	const males = (wingmen ?? []) as WingmanPoolRow[];
	const females = (besties ?? []) as BestiePoolRow[];

	let alreadyCached = 0;
	let scoredNow = 0;
	let claudeCalls = 0;
	const totalPairs = males.length * females.length;

	for (const m of males) {
		for (const f of females) {
			const mUser = await getUser(m.user_id);
			const fUser = await getUser(f.user_id);
			if (!mUser || !fUser) continue;
			const mv = (await profileVersion(m.user_id, 'personality')) ?? -1;
			const fv = (await profileVersion(f.user_id, 'preferences')) ?? -1;
			const hit = await getCachedPair(m.user_id, f.user_id, mv, fv);
			if (hit) {
				alreadyCached++;
				continue;
			}
			if (scoredNow >= maxNewScores) continue;
			const core = await scorePairCore(mUser, fUser, m, f);
			await putCachedPair(m.user_id, f.user_id, mv, fv, core);
			scoredNow++;
			claudeCalls += core.claudeCalls;
		}
	}

	return {
		totalPairs,
		alreadyCached,
		scoredNow,
		remaining: Math.max(0, totalPairs - alreadyCached - scoredNow),
		claudeCalls
	};
}
