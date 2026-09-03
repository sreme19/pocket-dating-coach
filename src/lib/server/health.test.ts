import { describe, it, expect } from 'vitest';
import { isUpstreamOnly, type HealthReport, type ServiceStatus } from './health';

/**
 * Guards the email-vs-Slack decision. The alert that prompted this was
 * accurate and useless: overall DEGRADED, one service degraded, and the body
 * said "Anthropic is overloaded (529) — not our outage, should recover on its
 * own." Slack is the right home for that. An inbox is not, and a monitor that
 * mails unactionable reports gets filtered into a folder — taking the
 * actionable ones with it.
 *
 * So the rule has to stay strict in the other direction: everything that
 * someone could act on must still email, including faults whose cause is
 * upstream but whose consequence is ours.
 */
const report = (services: Partial<Record<'claude' | 'supabase' | 'server', ServiceStatus>>): HealthReport => ({
	status: Object.values(services).some((s) => s?.status === 'down')
		? 'down'
		: Object.values(services).some((s) => s?.status === 'degraded')
			? 'degraded'
			: 'ok',
	timestamp: '2026-09-02T12:40:08.000Z',
	uptimeSeconds: 120,
	services: {
		claude: { status: 'ok', latencyMs: 857 },
		supabase: { status: 'ok', latencyMs: 539 },
		server: { status: 'ok', latencyMs: 0 },
		...services,
	},
});

const anthropic529: ServiceStatus = {
	status: 'degraded',
	latencyMs: 857,
	upstream: true,
	error: 'Anthropic is overloaded (529) — not our outage, should recover on its own.',
};

describe('isUpstreamOnly', () => {
	it('skips the email for an Anthropic 529 and nothing else wrong', () => {
		// Verbatim shape of the 2026-09-02 12:40 GMT alert.
		expect(isUpstreamOnly(report({ claude: anthropic529 }))).toBe(true);
	});

	it('still emails when a service is down, even if the cause is upstream', () => {
		// A Claude outage breaks our AI features regardless of whose fault it is.
		expect(
			isUpstreamOnly(
				report({
					claude: { status: 'down', upstream: true, error: "Claude API server error (HTTP 500) — this is on Anthropic's side." },
				})
			)
		).toBe(false);
	});

	it('still emails when an un-flagged degradation rides along with an upstream one', () => {
		expect(
			isUpstreamOnly(report({ claude: anthropic529, supabase: { status: 'degraded', latencyMs: 9000 } }))
		).toBe(false);
	});

	it('still emails for anything we could act on', () => {
		expect(
			isUpstreamOnly(
				report({ claude: { status: 'down', error: 'Claude API credit balance is exhausted — top up the Anthropic account.' } })
			)
		).toBe(false);
		expect(
			isUpstreamOnly(
				report({ supabase: { status: 'down', error: 'Supabase service key is invalid or has been revoked.' } })
			)
		).toBe(false);
	});

	it('is false for a healthy report, so an all-ok run is never read as skippable', () => {
		// The cron returns before reaching this, but the predicate must not claim
		// "nothing to email" for the same reason as "nothing wrong".
		expect(isUpstreamOnly(report({}))).toBe(false);
	});
});
