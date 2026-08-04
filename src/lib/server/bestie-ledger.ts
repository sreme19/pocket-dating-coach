/**
 * bestie-ledger.ts — cross-conversation memory + consent (Requirement §E, §Q).
 *
 * A man in three Bestie threads used to answer the same questions three times.
 * Each Bestie is scoped to her own match, so nothing he had already said was
 * visible to the next one. §E allows the next Bestie to draw on his prior
 * answers WITH HIS CONSENT; this module is the read side and the consent state
 * machine. The write side is chat-intel-capture.ts.
 *
 * Three rules are load-bearing and easy to erode, so they live here as code
 * rather than as prompt wording:
 *
 * NO SOURCES. vv_answer_ledger stores no match id and no partner id, so an entry
 * cannot be attributed to a woman even in principle. §E clause 3 says Bestie
 * surfaces the insight and never the reference; a column that does not exist
 * cannot leak. It is also what keeps us clear of §Q — sharing transcripts would
 * hand the next woman a read on the previous one, since Bestie's messages carry
 * the woman's voice and her priorities, not just his answers.
 *
 * TOPICS ARE READABLE BEFORE CONSENT, ANSWERS ARE NOT. Bestie asks him at the
 * moment his ledger could actually save him something, which means she has to
 * know an entry EXISTS on the topic she is about to raise. She learns "he has
 * covered kids before" and nothing more until he says yes. That asymmetry is
 * deliberate: without it, just-in-time asking is impossible and the ask has to
 * fire blind in message two, before she has given him any reason to agree.
 *
 * CONSENT GATES READING, NEVER WRITING. A man who declines still accumulates a
 * ledger; it simply goes unread. So a later yes is worth something immediately,
 * and revoking is a lock rather than a purge.
 */

/** A single stored answer, in his own words. */
export interface LedgerEntry {
	topic: string;
	answer: string;
	created_at: string;
}

export type LedgerConsent = 'unasked' | 'granted' | 'declined';

/**
 * Reuse is ON by default — only an explicit 'declined' seals the ledger.
 *
 * The earlier model was opt-in, which meant a man's own answers sat unread until
 * some Bestie happened to hit an overlap and remember to ask him, and most men
 * therefore got the repeat questions the ledger exists to prevent. He is told
 * plainly the first time a Bestie is caught up (buildConsentNoticeBlock) and can
 * switch it off in Settings > Safety > "Reuse what I have shared" — so it is a
 * disclosed default rather than a silent one.
 */
export function isLedgerEnabled(consent: LedgerConsent): boolean {
	return consent !== 'declined';
}

/** Consent state as stored on the man's user row. */
export interface ConsentState {
	consent: LedgerConsent;
	declines: number;
	opportunitiesSinceAsk: number;
}

/**
 * After this many declines the ask stops being per-opportunity and drops to a
 * periodic one. Five separate noes is more than enough signal.
 */
export const CONSENT_DECLINE_SOFT_CAP = 5;
/**
 * ...and then he is asked once every this-many ASK OPPORTUNITIES. Opportunities,
 * not threads: a thread whose checklist never touches his ledger never asks at
 * all, so counting threads would nag men whose ledger was never relevant.
 */
export const CONSENT_ASK_EVERY = 5;

/**
 * An entry older than this is offered to Bestie as "worth gently reconfirming"
 * rather than as current fact. He may have said it a year ago; people move.
 */
export const LEDGER_STALE_DAYS = 120;

/** Entries this old are dropped from the prompt entirely — too old to be useful. */
export const LEDGER_MAX_AGE_DAYS = 540;

/** How many entries at most reach the prompt, newest first. */
const LEDGER_MAX_ENTRIES = 12;

function daysBetween(fromIso: string, now: number): number {
	const t = Date.parse(fromIso);
	if (!Number.isFinite(t)) return 0;
	return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/**
 * Load a man's ledger, newest first. Returns [] on any failure — this feature
 * degrades to "ask him again", which is exactly today's behaviour, so it must
 * never be able to break a Bestie reply.
 */
export async function loadLedger(supabase: any, userId: string): Promise<LedgerEntry[]> {
	try {
		const { data } = await supabase
			.from('vv_answer_ledger')
			.select('topic, answer, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(60);
		return (data ?? []) as LedgerEntry[];
	} catch {
		return [];
	}
}

/** The distinct topics he has answered — the part readable before consent. */
export function ledgerTopics(entries: LedgerEntry[]): Set<string> {
	return new Set(entries.map((e) => e.topic));
}

/**
 * Does this checklist ask about something he has already answered? That overlap
 * IS the ask opportunity — the moment where consent buys him something concrete.
 */
export function overlappingTopics(
	checklistTopics: Iterable<string>,
	entries: LedgerEntry[]
): string[] {
	const have = ledgerTopics(entries);
	const out: string[] = [];
	for (const t of checklistTopics) {
		if (t && have.has(t) && !out.includes(t)) out.push(t);
	}
	return out;
}

/**
 * Should this Bestie raise consent on this turn?
 *
 * Pure so the cadence is testable without a database. `askedInThisThread` comes
 * from verified_vibe_matches.bestie_consent_asked_at — one consent moment per
 * Bestie, never a second, which is why that marker needs its own column rather
 * than a slot in bestie_checklist (the checklist is nulled on re-vet).
 */
export function shouldAskConsent(opts: {
	state: ConsentState;
	hasOpportunity: boolean;
	askedInThisThread: boolean;
}): boolean {
	const { state, hasOpportunity, askedInThisThread } = opts;
	if (!hasOpportunity) return false;       // nothing to gain, so nothing to ask
	if (askedInThisThread) return false;     // she gets one moment, not a campaign
	if (state.consent === 'granted') return false;
	if (state.declines < CONSENT_DECLINE_SOFT_CAP) return true;
	// Past the cap: every Nth opportunity, counting the one in front of us.
	return state.opportunitiesSinceAsk + 1 >= CONSENT_ASK_EVERY;
}

/**
 * The consent counters after an opportunity passes. Separated from the decision
 * above because the counter moves even on the turns we stay quiet — that is what
 * makes "every 5th opportunity" mean anything.
 */
export function nextOpportunityCounters(state: ConsentState, asked: boolean): { opportunitiesSinceAsk: number } {
	return { opportunitiesSinceAsk: asked ? 0 : state.opportunitiesSinceAsk + 1 };
}

/** Apply his yes/no. Returns the fields to write, or null when he said neither. */
export function applyConsentAnswer(
	state: ConsentState,
	answer: 'granted' | 'declined' | null,
	now: string = new Date().toISOString()
): { ledger_consent: LedgerConsent; ledger_declines: number; ledger_consent_at: string } | null {
	if (answer === 'granted') {
		return { ledger_consent: 'granted', ledger_declines: state.declines, ledger_consent_at: now };
	}
	if (answer === 'declined') {
		return {
			ledger_consent: 'declined',
			ledger_declines: state.declines + 1,
			ledger_consent_at: now
		};
	}
	return null;
}

/**
 * His prior answers, for the reply prompt. Only ever called when consent is
 * granted.
 *
 * Age is surfaced per entry rather than filtered on, because staleness is a
 * judgment call Bestie is better placed to make than a cutoff: "I moved to
 * Berlin" from last week is fact, the same sentence from two years ago is an
 * opening question. Very old entries are dropped outright.
 */
export function buildLedgerBlock(
	entries: LedgerEntry[],
	matchName: string,
	now: number = Date.now()
): string {
	const usable = entries
		.filter((e) => daysBetween(e.created_at, now) <= LEDGER_MAX_AGE_DAYS)
		.slice(0, LEDGER_MAX_ENTRIES);
	if (usable.length === 0) return '';

	const lines = usable
		.map((e) => {
			const age = daysBetween(e.created_at, now);
			const stamp =
				age <= 14
					? 'recently'
					: age <= LEDGER_STALE_DAYS
						? 'a while ago'
						: 'a long time ago, may well have changed';
			return `  - [${e.topic}, ${stamp}] "${e.answer}"`;
		})
		.join('\n');

	return `

WHAT ${matchName.toUpperCase()} HAS ALREADY TOLD US (his own words, from earlier conversations on riteangle, shared with his permission):
${lines}
How to use this:
- Do NOT ask him anything this already answers. That is the entire point: he agreed to this so he would not have to repeat himself.
- NEVER say where it came from, never mention another conversation, another match, or "the other women". You simply know it. If he asks how you know, say he shared it on riteangle earlier and left it with us, nothing more.
- You may refer to it naturally, the way a friend who has been briefed would ("you're a designer, right?"). Do not read it back at him as a list, and do not quote more than a fragment.
- Anything marked "a long time ago" is a starting point, not a fact. Reconfirm it lightly in passing rather than assuming it still holds.
- If he corrects any of it, take the correction and move on without defending it.`;
}

/**
 * Checklist-generation block: the topics he has already covered, so they never
 * become items in the first place. This is where the duplicate questioning
 * actually dies — suppressing at generation beats instructing the reply prompt
 * not to ask, because an item that never exists cannot be raised.
 *
 * Topics only, no answers: the checklist prompt does not need his words to know
 * to skip a subject, and the less of the ledger we spread across prompts the
 * smaller the surface for it to leak out of.
 */
export function buildChecklistSuppressionBlock(topics: string[], matchName: string): string {
	if (topics.length === 0) return '';
	return `\n\nAlready answered by ${matchName} previously, with his permission to reuse it: ${topics.join(', ')}.\nDo NOT create a checklist item for any of these. He has covered them and asking again is the exact annoyance we are removing. Choose different gaps; if that leaves fewer than 2 real gaps, return the 2 most meaningful ones you can find that are NOT in that list.`;
}

/**
 * The consent ask itself, woven into her reply rather than sent as a separate
 * notice — he is mid-conversation and a bot-shaped interruption reads badly.
 *
 * The ask names the benefit, because that is the honest reason to say yes: it
 * saves him time. It may also say she can see he has covered this ground before,
 * which is true and is what makes the ask concrete rather than abstract.
 */
export function buildConsentAskBlock(matchName: string, topics: string[]): string {
	const subject = topics[0] ? topics[0].replace(/_/g, ' ') : 'this';
	return `

ASK HIM ABOUT REUSING WHAT HE HAS ALREADY SHARED — do this in THIS message, once:
- ${matchName} has answered questions like this before on riteangle (this one is about ${subject}), but you cannot look at his answers until he says it is okay.
- Weave a short, light ask into your reply: you can see he has been through some of this before, and if he is happy for you to look at what he has already shared you will not make him say it all twice. Frame it entirely as saving him the repetition, because that is what it is.
- Keep it to one sentence, in your own voice, and do not make it sound like a form, a policy notice, or a legal consent. Never use the words "consent", "permission granted", "data", or "privacy policy".
- Do NOT explain where his answers came from, do NOT mention other matches or other conversations, and never imply he is being compared with anyone.
- Ask once. If he says no, or ignores it, drop it completely and never raise it again in this conversation.
- Set "consentAnswer" to "granted" if his message clearly agrees, "declined" if he clearly refuses or pushes back, and null if he has not answered yet or is ambiguous. Silence and ambiguity are NOT agreement.`;
}

/**
 * HIS OWN view of the ledger, for the Wingman "what have I shared" chip.
 *
 * Deliberately available whatever his consent state. He may have said no and
 * still want to know what is sitting there — and being able to see it is what
 * turns the consent question from an abstraction into a decision. Reading it
 * back to him is also the only place the ledger is ever shown to a person; a
 * Bestie only ever gets it woven into her own context.
 *
 * Handed to Wingman as raw material to summarise rather than as a script, so it
 * lands in his voice like the rest of the advisor surface.
 */
export async function loadOwnLedgerContext(supabase: any, userId: string): Promise<string> {
	let entries: LedgerEntry[] = [];
	let consent: LedgerConsent = 'unasked';
	try {
		const [ledger, user] = await Promise.all([
			loadLedger(supabase, userId),
			supabase
				.from('verified_vibe_users')
				.select('ledger_consent')
				.eq('id', userId)
				.maybeSingle()
				.then((r: any) => r.data)
		]);
		entries = ledger;
		consent = (user?.ledger_consent ?? 'unasked') as LedgerConsent;
	} catch {
		return '';
	}

	const status = isLedgerEnabled(consent)
		? 'Reuse is ON for him (it is on by default), so besties are caught up and he is spared the repeat questions. He can switch it off any time under Settings > Safety > "Reuse what I have shared", and switching it off keeps what he said rather than deleting it.'
		: 'He has switched reuse OFF, so nobody is reading it. It is only stored. He can turn it back on any time under Settings > Safety > "Reuse what I have shared", and he would stop being asked the same things twice.';

	if (entries.length === 0) {
		return `

WHAT HE HAS SHARED SO FAR (§E — answer his "what do you know about me" / "what have I shared" question from THIS, and nothing else):
- Nothing has been saved yet. Things he says about himself in chats get noted so he does not have to repeat them to every match.
- ${status}
Tell him plainly that there is nothing stored yet, and why that is normal rather than a problem. Do not invent entries.`;
	}

	const byTopic = new Map<string, string[]>();
	for (const e of entries) {
		const list = byTopic.get(e.topic) ?? [];
		if (list.length < 4) list.push(e.answer);
		byTopic.set(e.topic, list);
	}
	const lines = [...byTopic.entries()]
		.map(([topic, answers]) => `  - ${topic.replace(/_/g, ' ')}: ${answers.map((a) => `"${a}"`).join('; ')}`)
		.join('\n');

	return `

WHAT HE HAS SHARED SO FAR (§E — answer his "what do you know about me" / "what have I shared" question from THIS, and nothing else):
${lines}
- ${status}
How to answer:
- Summarise it back warmly and briefly, grouped the way it is grouped above. These are HIS words, so quoting a fragment is fine.
- Be straight about the status above. If he has not agreed yet, say what agreeing would save him, once, without pushing.
- Never mention which match or conversation anything came from. We do not store that, so you genuinely do not know.
- Do not add anything that is not listed above, and never guess at what else we might know.`;
}

/**
 * Told once per Bestie, when he has already said yes elsewhere: she is caught up,
 * and he can switch it off. He agreed to a general reuse, so this is a courtesy
 * notice rather than a second ask — but he should never discover it silently.
 */
export function buildConsentNoticeBlock(matchName: string): string {
	return `

TELL HIM ONCE, IN THIS MESSAGE, THAT YOU ARE CAUGHT UP:
- ${matchName} previously agreed that riteangle can reuse what he has already shared, so you have been caught up and will not make him repeat himself.
- Say it in ONE short, warm clause inside your reply, and mention he can switch it off in his settings whenever he likes (it lives under Safety, called "Reuse what I have shared" — only name the exact path if he asks). Not a paragraph, not a disclaimer.
- Do NOT list what you know, do NOT say where it came from, and never mention other matches or conversations.
- Then carry on normally. Do not raise it again in this conversation.`;
}
