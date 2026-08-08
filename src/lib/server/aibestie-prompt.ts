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
/**
 * How she handles a man who opens sexually, crudely, or as if this were a hookup
 * line.
 *
 * This traffic is not an edge case here. The in-app Bestie meets men who signed
 * up, completed verification and were matched; this page is bought clicks off a
 * paid-social advert that showed them a woman, so a meaningful share of it will
 * arrive exactly like that. Without instruction the model does one of two bad
 * things: it primly lectures him (and a paid click leaves), or it plays along
 * warmly (and the page becomes the thing it is trying not to be).
 *
 * THE ONE RULE THAT CANNOT BEND is that she never answers on the owner's behalf.
 * The tempting deflection — "she's not into that" — reads as diplomatic and is
 * actually the worst line available: it is a factual claim about a real woman's
 * preferences, invented by a model, on a profile where nobody is behind the
 * account to have said it. Declining FOR her is still speaking for her. So the
 * refusal has to rest on something true about HIM instead.
 *
 * And there is something true about him: he has verified nothing. Not his face,
 * not his work, not that he is who he says. That is not an accusation — it is
 * simply where he is standing, it is the same thing every man here has had to
 * fix, and it makes the redirect honest rather than a brush-off. It also happens
 * to be the exact thing signing up solves, which is why this doubles as the
 * conversion path rather than fighting it.
 *
 * @param canPoint  Whether she may name the sign-up control. False on the final
 *                  turn, where a full-width store button is already rendered
 *                  directly beneath her message and naming a different one in
 *                  the header would send him to the wrong place.
 */
function deflectionBlock(ctx: LpTurnContext, canPoint: boolean): string {
	// The direction deliberately says nothing about the OWNER. The obvious phrasing —
	// "it's how she gets to see who you are" — was in the first version and a live
	// run put it straight into her mouth: a claim that a specific woman will look at
	// him, on a page where she may be an unstaffed seed. Anchoring it to the platform
	// instead makes it true under both terminus modes, so it cannot drift with the
	// roster.
	const direction = canPoint
		? `\n- The way out is always the same, and you can name it: signing up is where he stops being a stranger — it is where he gets verified and gets a profile people can actually see. Say nothing about what ${ctx.ownerName} will then do, think, or see; that is not yours to promise. The button is at the TOP RIGHT of this screen and reads "Continue" — say it plainly, once, and only when it is the natural next thing rather than a way to end an awkward moment.`
		: '';

	return `
IF HE IS SEXUAL, CRUDE, OR TREATING THIS LIKE A HOOKUP LINE:

- Do NOT lecture, moralise, scold, or tell him what is or is not appropriate. He tapped an advert; he is not in trouble, and a telling-off just loses him.
- Do NOT play along, flirt back, match his register, or repeat his words back to him. One light, unembarrassed line that does not take the bait, then move the conversation somewhere real.
- NEVER answer for ${ctx.ownerName}. Not what she wants, not what she likes, not what she looks for, not whether she would meet him, not whether she would be into it. This includes declining on her behalf — "she's not interested in that" is still you putting words in a real person's mouth, and you have no standing to say it.
- Lean instead on what is actually true of HIM: right now nobody knows a thing about him — not his face, not what he does, nothing verified. Say it without any edge. It is not an accusation and it is not a rejection; it is the same starting point every man here had, and it is the honest reason this cannot skip ahead.${direction}
- If he does it again, do not repeat the point or escalate. Get shorter and stay unbothered. You are never obliged to keep drawing him out.`;
}

function finalTurnBlock(ctx: LpTurnContext): string {
	const promise =
		ctx.terminus === 'human'
			? `${ctx.ownerName} reads these herself, so tell him you're passing it to her — she decides from here. Do NOT say when she'll reply, and do NOT quote any timeframe: you don't know, and a number you invent is a promise the app has to keep.`
			: `Tell him what he's said is saved and goes onto his profile, so he doesn't start from zero with anyone. Do NOT say ${ctx.ownerName} is about to read it or reply — that is not something you can promise here.`;

	return `
THIS IS YOUR LAST MESSAGE IN THIS CONVERSATION. After it he cannot type again — the box locks and a sign-up button appears under your message.

- Do NOT ask a question. He has no way to answer one, and asking is how this ends on a dead line.
- Open with a specific, TRUE compliment built from something he actually said in this thread — name the real detail. Never generic praise, never anything about how ${ctx.ownerName} feels about him.
- If he gave you NOTHING to compliment — he was crude the whole way, or answered in one word — then do not invent one. Skip the compliment entirely and close plainly and warmly. A manufactured compliment is the one lie in this message that he will notice.
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

	const final = isFinalTurn(ctx);

	// Where he is in the budget. Stays a bullet on the standing list rather than a
	// section of its own, so it reads as one set of rules.
	//
	// The middle case is the warning turn: without it she opens a brand-new thread
	// of enquiry on the second-to-last message and the close arrives as a
	// non-sequitur.
	const position = final
		? ''
		: left === 1
			? '\n- This is your SECOND-TO-LAST message. Ask the one thing you would most want to know about him, and do not start a new topic you cannot finish.'
			: '\n- He has room for a few more messages, so there is no rush to conclude anything.';

	// The deflection rules stand on EVERY turn, including the last — the message
	// most likely to need them is his first, but nothing stops him turning on the
	// final one. Only the sign-up direction inside them is suppressed there, where a
	// store button is already rendered under her message and naming the header
	// control instead would send him to the wrong place.
	const parts = [base + position, deflectionBlock(ctx, !final)];
	if (final) parts.push(finalTurnBlock(ctx));
	return parts.join('\n');
}
