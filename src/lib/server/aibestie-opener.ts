/**
 * aibestie-opener.ts — her first message, composed without calling a model.
 *
 * WHY NOT generateAndSendBestieOpener. The in-app opener is a Claude call that
 * measures ~9s (which is why chat/send carries maxDuration 60). A member waiting
 * in an installed app tolerates that; a cold ad click does not — the page would
 * paint an empty thread and most visitors would leave before her first line
 * arrived. So the opener is TEMPLATED and inserted at session start, and the page
 * paints with her message already in it.
 *
 * It also has nothing to work with. The in-app opener is built from his profile,
 * his artifacts and his proven tags; an ad visitor has none of those, so the
 * model would be composing from an empty context anyway.
 *
 * WHAT IT MAY AND MAY NOT SAY. It discloses that she is an AI in the first
 * sentence — that is the disclosure the whole page rests on, so it is a string in
 * code rather than an instruction a model may drift from. It must NOT say she
 * will reply, or quote any clock: whether a human is behind the profile is
 * terminusMode()'s decision, made later and from configuration, and the opener
 * runs before anyone knows how the conversation will go.
 */

import type { TerminusMode } from './aibestie-owner';

export interface OpenerOwner {
	firstName: string;
	/**
	 * Whether a real, consenting human is behind this profile. Required, not
	 * optional with a friendly default: the first version of this file hardcoded
	 * "and she reads these herself", which is FALSE for a seed owner — the precise
	 * claim terminusMode() exists to make structurally impossible, smuggled back in
	 * as a template literal. Making it a mandatory argument means a caller cannot
	 * omit it and silently get the human promise.
	 */
	terminus: TerminusMode;
}

/**
 * Her opening message.
 *
 * DELIBERATELY DOES NOT QUOTE HER PROFILE. The first version spliced her
 * `looking` text into the sentence, and both ways that can go wrong showed up on
 * the first real run: she writes in the FIRST person, so "a partner who respects
 * my career" became her bestie saying "my career"; and clipping a free-form
 * paragraph to fit cut it mid-phrase at "wants to build". Rewriting someone's
 * prose into third person is a model's job, and the model gets its turn — from
 * his very first reply onward, generateBestieReply has her whole profile and
 * handles her pronouns correctly. The templated line only has to be instant,
 * honest, and open-ended.
 *
 * One question, and a broad one: the checklist does not exist yet (Bestie builds
 * it on her first generated turn), so this asks the widest useful thing and lets
 * her take over from his answer.
 */
export function buildLpOpener(owner: OpenerOwner): string {
	const name = owner.firstName?.trim();
	// "her" is already possessive, so it must not take an apostrophe-s — the naive
	// fallback produced "I'm her's AI bestie" on any profile with a blank name.
	const whose = name ? `${name}'s` : 'her';

	// The ONLY difference between the two is whether a person is claimed to be
	// reading. Everything else is true either way.
	const reading =
		owner.terminus === 'human'
			? `, and she reads these herself`
			: ``;

	return (
		`Hey! I'm ${whose} AI bestie — I chat with her matches first so you two get off ` +
		`to a good start${reading}. ` +
		`So I'd rather hear it from you than guess: what brought you here?`
	);
}
