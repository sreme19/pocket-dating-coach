/**
 * contact-scrub.ts — last line of defence on what Bestie may put in front of a man.
 *
 * Spec §C: "Bestie never leaks the woman's personal details — no phone number,
 * address, email, or contact info", and she is text-only in chat — never a link,
 * never media.
 *
 * This exists because the prompt rule was not enough. In production, a woman pasted
 * her own Instagram link into her thread (entirely her right — §K(c) makes sharing
 * her details her own choice, executed by her). Her Bestie then re-sent the handle
 * on her behalf a few turns later, and coached him on how to find her when the link
 * would not open. The model was being helpful with something already visible in the
 * transcript, which is exactly the case a prompt rule loses: it does not read like
 * leaking a secret, because the secret is right there.
 *
 * So the rule is structural, not just instructional. Her sharing her own details is
 * hers to do. Bestie repeating them is not, whether or not they already appear above.
 *
 * PURE and applied to the REPLY ONLY — the thing the man reads. Deliberately NOT
 * applied to the private coaching read, where "he asked for your Instagram" is
 * something she needs to be told.
 *
 * Precision over recall: every pattern here is one that essentially cannot appear
 * innocently in a Bestie reply. A bare username with no @ and no domain (the
 * `kaur__gil__official__786` shape) is NOT matchable without also eating ordinary
 * words, so that case is still carried by the prompt rule. Known residual gap.
 */

/** What replaced text becomes. Reads as a deliberate boundary, not a glitch. */
const REDACTION = "(she'll share that herself if she wants to)";

const PATTERNS: Array<{ re: RegExp; what: string }> = [
	// Emails first — they contain an @ and a dot, so they must win over the handle rule.
	{ re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, what: 'email' },
	// Explicit URLs.
	{ re: /\bhttps?:\/\/\S+/gi, what: 'url' },
	// Bare domains and deep links — wa.me/x, instagram.com/y, t.me/z. Requires a
	// known-ish TLD followed by a slash or end, so "e.g." and "etc." are untouched.
	{
		re: /\b(?:[A-Za-z0-9-]+\.)+(?:com|net|org|io|me|in|co|app|link|gg|ly)(?:\/\S*)?/gi,
		what: 'link'
	},
	// Phone numbers, including +91 with spaces/dashes. At least 8 digits once
	// separators are ignored, so "48 hours" and "top 3" never match.
	{ re: /\+?\d[\d\s().-]{7,}\d/g, what: 'phone' },
	// @handles.
	{ re: /(^|[^A-Za-z0-9_])@[A-Za-z0-9._]{2,}/g, what: 'handle' }
];

export interface ScrubResult {
	text: string;
	/** Which kinds were removed, for logging. Empty when the text was already clean. */
	removed: string[];
}

/**
 * Strip contact details from a Bestie reply.
 *
 * Collapses whitespace around a redaction so the sentence still reads, and never
 * emits two redactions back to back — one boundary is a boundary, three in a row
 * looks broken.
 */
export function scrubContactDetails(text: string): ScrubResult {
	if (!text) return { text: '', removed: [] };

	const removed: string[] = [];
	let out = text;

	for (const { re, what } of PATTERNS) {
		out = out.replace(re, (match) => {
			// The handle pattern captures a leading character; keep it.
			const lead = what === 'handle' && !match.startsWith('@') ? match[0] : '';
			if (!removed.includes(what)) removed.push(what);
			return `${lead}${REDACTION}`;
		});
	}

	if (removed.length === 0) return { text, removed };

	// Tidy up: de-duplicate adjacent redactions, then normalise spacing and any
	// punctuation left dangling where the detail used to be.
	const esc = REDACTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	out = out
		.replace(new RegExp(`(?:${esc})(?:[\\s,]*(?:${esc}))+`, 'g'), REDACTION)
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\s+([,.!?])/g, '$1')
		.trim();

	return { text: out, removed };
}
