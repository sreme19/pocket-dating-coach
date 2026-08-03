import { describe, it, expect } from 'vitest';
import { buildClaudeHistory, type AdvisorMessage } from '../advisor-thread';
import { detectTaskIntent } from '../advisor-tasks';
import { isQuietHour, hourInZone } from '../notification-budget';
import { withoutMoneyDimensions, isMoneyDimension } from '$lib/verified-vibe/dimensions';

/**
 * The pure logic behind the advisor thread. Each of these has a failure mode that
 * is invisible in normal use and expensive in production: a history array Anthropic
 * rejects, an inverted quiet window that silences the whole working day, or an
 * intent detector that turns an ordinary question into a two-minute wait.
 */

function msg(
	role: 'user' | 'assistant',
	content: string,
	kind: AdvisorMessage['kind'] = 'chat',
	seq = 0
): AdvisorMessage {
	return {
		id: `m${seq}`,
		role,
		kind,
		content,
		payload: null,
		greetingId: null,
		taskId: null,
		createdAt: new Date(Date.UTC(2026, 7, 3, 12, seq)).toISOString(),
		seq
	};
}

describe('buildClaudeHistory', () => {
	it('drops leading assistant turns so the array starts with a user turn', () => {
		// A hydrated thread very often opens with a proactive greeting, which is an
		// assistant turn. Anthropic rejects a messages array that starts that way.
		const history = buildClaudeHistory([
			msg('assistant', 'Your photo audit is ready.', 'greeting', 1),
			msg('user', 'thanks, what next?', 'chat', 2),
			msg('assistant', 'Add social proof.', 'chat', 3)
		]);

		expect(history[0].role).toBe('user');
		expect(history).toHaveLength(2);
	});

	it('omits task acknowledgements', () => {
		// "On it, I'll ping you" is UI state; feeding it back invites the model to
		// re-acknowledge work it already accepted.
		const history = buildClaudeHistory([
			msg('user', 'help me get matches', 'chat', 1),
			msg('assistant', "On it — you can close this.", 'task_ack', 2),
			msg('assistant', 'Your scan is ready: 3 strong fits.', 'task_result', 3)
		]);

		expect(history.map((h) => h.content)).toEqual([
			'help me get matches',
			'Your scan is ready: 3 strong fits.'
		]);
	});

	it('keeps only the most recent turns, and still starts on a user turn', () => {
		const long: AdvisorMessage[] = [];
		for (let i = 1; i <= 20; i++) {
			long.push(msg(i % 2 === 1 ? 'user' : 'assistant', `turn ${i}`, 'chat', i));
		}

		const history = buildClaudeHistory(long, 5);

		expect(history.length).toBeLessThanOrEqual(5);
		expect(history[0].role).toBe('user');
		// The TAIL is what matters — a returning user cares about the recent thread.
		expect(history[history.length - 1].content).toBe('turn 20');
	});

	it('returns an empty array rather than throwing on an empty thread', () => {
		expect(buildClaudeHistory([])).toEqual([]);
	});

	it('skips blank turns', () => {
		const history = buildClaudeHistory([
			msg('user', 'hello', 'chat', 1),
			msg('assistant', '   ', 'chat', 2)
		]);
		expect(history).toHaveLength(1);
	});
});

describe('isQuietHour', () => {
	it('handles a window that wraps midnight', () => {
		// The default is 22:00–08:00. A naive start<=h<end comparison inverts this
		// and silences the entire working day instead of the night.
		expect(isQuietHour(23, 22, 8)).toBe(true);
		expect(isQuietHour(3, 22, 8)).toBe(true);
		expect(isQuietHour(22, 22, 8)).toBe(true); // inclusive start
		expect(isQuietHour(8, 22, 8)).toBe(false); // exclusive end
		expect(isQuietHour(14, 22, 8)).toBe(false);
		expect(isQuietHour(9, 22, 8)).toBe(false);
	});

	it('handles a same-day window', () => {
		expect(isQuietHour(13, 12, 14)).toBe(true);
		expect(isQuietHour(11, 12, 14)).toBe(false);
		expect(isQuietHour(14, 12, 14)).toBe(false);
	});

	it('treats a zero-length window as never quiet', () => {
		// Otherwise start === end would be read as "quiet always" and mute the user
		// permanently.
		for (const h of [0, 6, 12, 18, 23]) {
			expect(isQuietHour(h, 9, 9)).toBe(false);
		}
	});
});

describe('hourInZone', () => {
	it('resolves the local hour, not the server hour', () => {
		// 20:30 UTC is 02:00 next day in Kolkata (+5:30) — inside quiet hours there,
		// but the middle of the evening in UTC.
		const at2030Utc = new Date('2026-08-03T20:30:00Z');

		expect(hourInZone(at2030Utc, 'Asia/Kolkata')).toBe(2);
		expect(hourInZone(at2030Utc, 'UTC')).toBe(20);
		expect(isQuietHour(hourInZone(at2030Utc, 'Asia/Kolkata'), 22, 8)).toBe(true);
	});

	it('handles midnight as 0 rather than 24', () => {
		expect(hourInZone(new Date('2026-08-03T00:15:00Z'), 'UTC')).toBe(0);
	});

	it('falls back to UTC on an unrecognised zone instead of silencing', () => {
		const d = new Date('2026-08-03T15:00:00Z');
		expect(hourInZone(d, 'Not/AZone')).toBe(15);
	});
});

describe('detectTaskIntent', () => {
	it('routes asks that need real work', () => {
		expect(detectTaskIntent('help me get matches')).toBe('match_scan');
		expect(detectTaskIntent('Why am I not getting matches?')).toBe('match_scan');
		expect(detectTaskIntent("why aren't i getting any matches")).toBe('match_scan');
		expect(detectTaskIntent('audit my profile please')).toBe('profile_audit');
		expect(detectTaskIntent('what should I upload next?')).toBe('profile_audit');
		expect(detectTaskIntent('can you review my photos')).toBe('profile_audit');
	});

	it('leaves ordinary conversation alone', () => {
		// A false positive is worse than a miss: it turns an instant answer into a
		// two-minute wait.
		expect(detectTaskIntent('hey')).toBeNull();
		expect(detectTaskIntent('thanks!')).toBeNull();
		expect(detectTaskIntent('what did Sam say about the trip?')).toBeNull();
		expect(detectTaskIntent('is he worth my time')).toBeNull();
		expect(detectTaskIntent('')).toBeNull();
	});

	it('does not hijack the quick-action chips', () => {
		// These are answered synchronously from precomputed data and are already
		// fast — queueing them would be a regression.
		expect(detectTaskIntent('How can I get better matches?')).toBeNull();
		expect(
			detectTaskIntent("Give me a quick digest of all my matches. Who's worth my time right now and why?")
		).toBeNull();
		expect(detectTaskIntent("What's new across my matches? Any fresh things I should pay attention to?")).toBeNull();
		expect(
			detectTaskIntent('Can you summarize my conversation with Sam and tell me what I should know about him before I step in?')
		).toBeNull();
	});

	it('prefers a profile audit when an ask mentions both', () => {
		// "what should I upload to get matches" is really a portfolio question.
		expect(detectTaskIntent('what should I upload to get more matches?')).toBe('profile_audit');
	});
});

// ── Money framing (App Store 1.1.4) ──────────────────────────────────────────

describe('withoutMoneyDimensions', () => {
	it('drops the financial dimension but keeps everything else in order', () => {
		// `financial` has the highest avgWeight (0.16) of any open dimension, so it
		// routinely won the "highest-leverage move" sort — which is how production
		// came to tell a member "Financial standing proof — verify your stability
		// (another major lift)".
		const ranked = [
			{ dim: 'financial', label: 'Financial standing', deltaPS: 9 },
			{ dim: 'lifestyle', label: 'Lifestyle & adventure', deltaPS: 7 },
			{ dim: 'warmth', label: 'Warmth & emotional intelligence', deltaPS: 5 }
		];

		const named = withoutMoneyDimensions(ranked);

		expect(named.map((a) => a.dim)).toEqual(['lifestyle', 'warmth']);
		// The next real move is promoted rather than the list simply getting shorter.
		expect(named[0].label).toBe('Lifestyle & adventure');
	});

	it('leaves social_legitimacy alone — career credibility is not wealth', () => {
		// Deliberately narrow: over-broadening here would gut legitimate coaching.
		const kept = withoutMoneyDimensions([
			{ dim: 'social_legitimacy', label: 'Social & professional legitimacy', deltaPS: 4 }
		]);
		expect(kept).toHaveLength(1);
	});

	it('is identity for lists with no money dimension, and safe on empty', () => {
		const items = [{ dim: 'humor', label: 'Humor', deltaPS: 2 }];
		expect(withoutMoneyDimensions(items)).toEqual(items);
		expect(withoutMoneyDimensions([])).toEqual([]);
	});

	it('classifies only money dimensions as money', () => {
		expect(isMoneyDimension('financial')).toBe(true);
		for (const d of ['lifestyle', 'warmth', 'ambition', 'social_legitimacy', 'looks', 'family']) {
			expect(isMoneyDimension(d)).toBe(false);
		}
	});
});
