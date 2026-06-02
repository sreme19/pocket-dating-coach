// ============================================================
// agent-trace.ts — normalized observability trace for the Test Suite
//
// One shape, emitted by every Test Suite core, rendered by one TracePanel.
// See AI_TEST_SUITE_DESIGN.md §3. Test Suite runs are side-effect-free by
// default: anything an agent WOULD have written to a production table is
// recorded here as a `sideEffect` with `wouldPersist: false`, not executed.
// ============================================================

export type TraceAgent =
	| 'bestie_advisor'
	| 'bestie_match_reply'
	| 'wingman_advisor'
	| 'matchmaker';

export interface TraceKbChunk {
	chapter: string;
	similarity: number;
	preview: string;
}

export interface TraceSideEffect {
	name: string;
	wouldPersist: boolean;
	detail: unknown;
}

export interface AgentTrace {
	agent: TraceAgent;
	startedAt: string;
	subject: {
		userId: string;
		name: string;
		gender: string;
		archetype?: string;
	};
	routing: { resolvedAssistant: 'bestie' | 'wingman'; reason: string };
	profile: {
		type: 'preferences' | 'personality' | null;
		version: number | null;
		data: unknown;
		source: 'ai_assistant_profiles' | 'user_master_profile' | 'default';
	};
	matchContext?: unknown;
	kb: {
		query: string;
		embeddingModel: string;
		topK: number;
		chunks: TraceKbChunk[];
	} | null;
	claude: {
		model: string;
		maxTokens: number;
		systemPrompt: string;
		userMessage: string;
		rawOutput: string;
		usage?: { inputTokens?: number; outputTokens?: number };
	};
	output: {
		reply: string;
		citations: string[];
		suggestions?: string[];
		coachingSignal?: { color: 'green' | 'yellow' | 'red'; text: string };
	};
	sideEffects: TraceSideEffect[];
	timing: { totalMs: number; claudeMs: number; embeddingMs?: number; kbMs?: number };
	matchmaker?: {
		hardFilter: { excluded: boolean; reasons: string[] };
		softScore: { score: number; rationale: string; flags: { color: string; text: string }[] };
		cached: boolean;
		claudeCalls: number;
	};
}
