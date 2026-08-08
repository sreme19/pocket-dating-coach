/**
 * aibestie-prompt.ts — what her Bestie is told when the thread is a landing page.
 *
 * The in-app Bestie is running a vetting conversation with no deadline: she works
 * a checklist, invites proof, and eventually hands off to the woman. Every one of
 * those assumptions is wrong on /aibestie, and the first live run showed exactly
 * how it fails — at the final turn she asked "so what part of the product do you
 * work on?", a question the composer had just locked him out of answering.
 *
 * Four differences, and each is a thing she would otherwise do wrongly:
 *
 *  1. THE CONVERSATION ENDS. He gets a fixed number of turns and then the
 *     composer locks. She has to land it, not trail off mid-question.
 *  2. SHE CANNOT ASK FOR PROOF. The landing page has no upload control, so an
 *     invitation to send a photo is an instruction he physically cannot follow.
 *  3. SHE MUST NOT HAND OFF. The hand-off line promises the woman takes it from
 *     here within a real 48-hour clock. On an unstaffed profile nobody is coming,
 *     and the wrap path is disabled in code rather than by asking her not to.
 *  4. WHAT SHE MAY PROMISE IS DECIDED ELSEWHERE. terminusMode() answers whether a
 *     human is actually behind the profile; this block only renders the answer.
 *
 * The flattery is deliberate and it is also required to be TRUE. "You answered
 * these better than most people I talk to" is checkable against the transcript;
 * "she's really into you" is not, and is the kind of line that makes the whole
 * page feel like the thing it is trying not to be.
 */

import type { TerminusMode } from './aibestie-owner';

export interface LpTurnContext {
	/** Substantive messages he has already sent, INCLUDING the one being answered. */
	turnsUsed: number;
	maxTurns: number;
	terminus: TerminusMode;
	ownerName: string;
}

/** Is this the turn where the conversation closes? */
export function isFinalTurn(ctx: { turnsUsed: number; maxTurns: number }): boolean {
	return ctx.turnsUsed >= ctx.maxTurns;
}

/**
 * The closing instruction.
 *
 * Two variants, differing ONLY in whether a person is claimed to be reading. The
 * 'artifact' copy is what an unstaffed profile has earned: the transcript is real,
 * it is saved, and it goes onto his profile — all true, and none of it invents
 * someone who is about to reply.
 */
function finalTurnBlock(ctx: LpTurnContext): string {
	const promise =
		ctx.terminus === 'human'
			? `${ctx.ownerName} reads these herself, so tell him you're passing it to her — she decides from here. Do NOT say when she'll reply, and do NOT quote any timeframe: you don't know, and a number you invent is a promise the app has to keep.`
			: `Tell him what he's said is saved and goes onto his profile, so he doesn't start from zero with anyone. Do NOT say ${ctx.ownerName} is about to read it or reply — that is not something you can promise here.`;

	return `
THIS IS YOUR LAST MESSAGE IN THIS CONVERSATION. After it he cannot type again — the box locks and a sign-up button appears under your message.

- Do NOT ask a question. He has no way to answer one, and asking is how this ends on a dead line.
- Open with a specific, TRUE compliment built from something he actually said in this thread — name the real detail. Never generic praise, never anything about how ${ctx.ownerName} feels about him.
- ${promise}
- Do NOT describe the button or tell him to tap anything. It is right there underneath you; narrating it sounds like an ad.
- Two sentences. Warm, unhurried, like you're genuinely glad you talked to him.`;
}

/**
 * The standing rules for every landing-page turn.
 */
export function buildLpConversationBlock(ctx: LpTurnContext): string {
	const left = Math.max(0, ctx.maxTurns - ctx.turnsUsed);

	const base = `
LANDING-PAGE CONVERSATION — read this before anything else in this prompt.

He arrived from an advert and has NOT signed up. He has no profile, no photos and no history, so you know nothing about him beyond what he types here. That is normal — do not treat the blanks as evasiveness, and never imply he is hiding something.

- He did NOT swipe, like, or match with ${ctx.ownerName}, and he has not seen anyone else. He tapped an advert and landed straight in this chat. Never refer to him swiping, matching, or picking her out of anything — he did none of those, and asking why he did makes you sound like you are reading someone else's conversation.

- He CANNOT upload anything: there is no attachment control on this page. Never ask for a photo, a document or any proof, and never imply his progress depends on sending one.
- Never mention a checklist, a hand-off, a queue, or anything about ${ctx.ownerName} "taking it from here". None of that exists on this page.
- Keep replies SHORT — one or two sentences. He is on a phone that he tapped into from an advert, not settled into the app.
- One question at a time, and only about him. Reacting warmly to what he said matters more than covering ground.`;

	if (isFinalTurn(ctx)) return `${base}\n${finalTurnBlock(ctx)}`;

	// The warning turn. Without it she opens a brand-new thread of enquiry on the
	// second-to-last message and the close arrives as a non-sequitur.
	if (left === 1) {
		return `${base}
- This is your SECOND-TO-LAST message. Ask the one thing you would most want to know about him, and do not start a new topic you cannot finish.`;
	}

	return `${base}
- He has room for a few more messages, so there is no rush to conclude anything.`;
}
