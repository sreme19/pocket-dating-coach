// Client-side helpers + types for the Test Suite UI.
// (Types mirror the server AgentTrace structurally; we don't import server code.)

export interface RosterUser {
	id: string;
	first_name: string;
	gender: string;
	age: number;
	city: string;
	archetype: string;
	trust_score: number;
	in_pool: boolean;
	is_seed: boolean;
}

export interface OwnerMatch {
	matchId: string;
	userId: string;
	name: string;
	age: number | null;
	archetype: string | null;
	city: string | null;
	goal: string;
}

export interface KbChunk {
	chapter: string;
	similarity: number;
	preview: string;
}
export interface SideEffect {
	name: string;
	wouldPersist: boolean;
	detail: unknown;
}
export interface AgentTrace {
	agent: 'bestie_advisor' | 'bestie_match_reply' | 'wingman_advisor' | 'matchmaker';
	startedAt: string;
	subject: { userId: string; name: string; gender: string; archetype?: string };
	routing: { resolvedAssistant: 'bestie' | 'wingman'; reason: string };
	profile: { type: string | null; version: number | null; data: unknown; source: string };
	matchContext?: unknown;
	kb: { query: string; embeddingModel: string; topK: number; chunks: KbChunk[] } | null;
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
	sideEffects: SideEffect[];
	timing: { totalMs: number; claudeMs: number; embeddingMs?: number; kbMs?: number };
	matchmaker?: {
		hardFilter: { excluded: boolean; reasons: string[] };
		softScore: { score: number; rationale: string; flags: { color: string; text: string }[] };
		cached: boolean;
		claudeCalls: number;
	};
}

/**
 * A past run handed from History back to its case tab so the operator can
 * reopen the exchange and keep chatting. Only chat-type cases (advisor,
 * match_reply) are restorable — matchmaker isn't a conversation.
 */
export interface RestorePayload {
	runId: string;
	caseType: 'advisor' | 'match_reply';
	subjectUserId: string | null;
	counterpartUserId: string | null;
	// stored verbatim from ts_runs.input / ts_runs.output
	input: { message?: string; match?: { name?: string; age?: number; goal?: string; matchId?: string | null; matchUserId?: string | null } } | null;
	output: { reply?: string; citations?: string[]; coachingSignal?: { color: 'green' | 'yellow' | 'red'; text: string } } | null;
	trace: AgentTrace;
}

export interface ChatMsg {
	side: 'left' | 'right';
	label: string;
	color: string;
	initials: string;
	text: string;
	suggestions?: string[];
	coachingSignal?: { color: 'green' | 'yellow' | 'red'; text: string };
	ownerName?: string;
}

const ARCHETYPE_COLORS: Record<'bestie' | 'wingman', string[]> = {
	bestie: ['#f43f5e', '#fb7185', '#e11d48'],
	wingman: ['#6366f1', '#818cf8', '#4f46e5']
};

export function fullName(p: RosterUser): string {
	return p.first_name;
}
export function initials(p: RosterUser): string {
	return p.first_name.slice(0, 2).toUpperCase();
}
export function assistantFor(p: RosterUser): 'bestie' | 'wingman' {
	return p.gender === 'woman' ? 'bestie' : 'wingman';
}
export function avatarColor(p: RosterUser): string {
	const set = ARCHETYPE_COLORS[assistantFor(p)];
	let h = 0;
	for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
	return set[h % set.length];
}

export const AGENT_LABEL: Record<string, string> = {
	bestie_advisor: 'AI Bestie · advisor',
	bestie_match_reply: 'AI Bestie · match reply',
	wingman_advisor: 'AI Wingman · advisor',
	matchmaker: 'AI Matchmaker · pair score'
};

export const ICONS: Record<string, string> = {
	search: 'M11 11m-7 0a7 7 0 1014 0 7 7 0 10-14 0M21 21l-4.3-4.3',
	send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
	chevron: 'M9 6l6 6-6 6',
	copy: 'M16 4h2a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2v-1M8 16h8a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v10a2 2 0 002 2z',
	check: 'M20 6L9 17l-5-5',
	route: 'M6 3v12M6 21a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 100-6 3 3 0 000 6zM18 9a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
	user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
	link2: 'M9 17H7A5 5 0 017 7h2M15 7h2a5 5 0 010 10h-2M8 12h8',
	book: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z',
	cpu: 'M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
	sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
	zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
	clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
	shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
	alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z',
	x: 'M18 6L6 18M6 6l12 12',
	flask: 'M9 3h6M10 3v6.5L5 18a2 2 0 002 3h10a2 2 0 002-3l-5-8.5V3',
	msg: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
	spark: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z',
	ban: 'M12 22a10 10 0 100-20 10 10 0 000 20zM5 5l14 14',
	eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zM12 15a3 3 0 100-6 3 3 0 000 6z'
};

export function highlightJson(obj: unknown): string {
	const json = JSON.stringify(obj, null, 2) ?? 'null';
	const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return esc.replace(
		/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
		(m) => {
			let cls = 'n';
			if (/^"/.test(m)) cls = /:$/.test(m) ? 'k' : 's';
			else if (/true|false/.test(m)) cls = 'b';
			else if (/null/.test(m)) cls = 'p';
			return `<span class="${cls}">${m}</span>`;
		}
	);
}

export function highlightPrompt(text: string): string {
	return (text ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/^(#.*)$/gm, '<span class="hl">$1</span>')
		.replace(/(\[\d+\])/g, '<span class="tok">$1</span>');
}
