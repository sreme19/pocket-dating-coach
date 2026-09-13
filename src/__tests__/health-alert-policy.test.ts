import { describe, it, expect } from 'vitest';
import {
	decideAlert,
	faultSignature,
	COOLDOWN_MS,
	FALLBACK_HOUR_UTC,
	type AlertState,
} from '$lib/server/health-alert-policy';
import type { HealthReport } from '$lib/server/health';

type Svc = 'ok' | 'degraded' | 'down';

function report(claude: Svc, supabase: Svc): HealthReport {
	const overall: Svc =
		claude === 'down' || supabase === 'down' ? 'down'
		: claude === 'degraded' || supabase === 'degraded' ? 'degraded'
		: 'ok';
	return {
		status: overall,
		timestamp: new Date().toISOString(),
		uptimeSeconds: 1,
		services: {
			claude:   { status: claude },
			supabase: { status: supabase },
			server:   { status: 'ok', latencyMs: 0 },
		},
	};
}

const OK       = report('ok', 'ok');
const SB_DOWN  = report('ok', 'down');
const BOTH_DOWN = report('down', 'down');
const at = (iso: string) => new Date(iso);

describe('faultSignature', () => {
	it('names only the failing services, in a stable order', () => {
		expect(faultSignature(OK)).toBe('');
		expect(faultSignature(SB_DOWN)).toBe('supabase:down');
		expect(faultSignature(BOTH_DOWN)).toBe('claude:down|supabase:down');
	});

	it('changes when a fault escalates, so escalation is never read as a repeat', () => {
		expect(faultSignature(report('ok', 'degraded'))).not.toBe(faultSignature(SB_DOWN));
	});
});

describe('decideAlert with the store readable', () => {
	it('emails the first time a fault is seen', () => {
		const d = decideAlert(SB_DOWN, at('2026-09-13T01:40:00Z'), null);
		expect(d).toMatchObject({ email: true, reason: 'new' });
		expect(d.nextState?.signature).toBe('supabase:down');
	});

	it('stays silent on the same fault ten minutes later', () => {
		const state: AlertState = {
			signature: 'supabase:down',
			firstSeenAt: '2026-09-13T01:40:00Z',
			lastEmailedAt: '2026-09-13T01:40:00Z',
		};
		expect(decideAlert(SB_DOWN, at('2026-09-13T01:50:00Z'), state))
			.toMatchObject({ email: false, reason: 'cooldown' });
	});

	it('emails immediately when the fault escalates', () => {
		const state: AlertState = {
			signature: 'supabase:down',
			firstSeenAt: '2026-09-13T01:40:00Z',
			lastEmailedAt: '2026-09-13T01:40:00Z',
		};
		expect(decideAlert(BOTH_DOWN, at('2026-09-13T01:50:00Z'), state))
			.toMatchObject({ email: true, reason: 'changed' });
	});

	it('sends one reminder once the fault is a day old', () => {
		const state: AlertState = {
			signature: 'supabase:down',
			firstSeenAt: '2026-09-13T01:40:00Z',
			lastEmailedAt: '2026-09-13T01:40:00Z',
		};
		const justBefore = new Date(Date.parse(state.lastEmailedAt) + COOLDOWN_MS - 60_000);
		const justAfter  = new Date(Date.parse(state.lastEmailedAt) + COOLDOWN_MS);
		expect(decideAlert(SB_DOWN, justBefore, state)).toMatchObject({ email: false, reason: 'cooldown' });
		const d = decideAlert(SB_DOWN, justAfter, state);
		expect(d).toMatchObject({ email: true, reason: 'reminder' });
		expect(d.nextState?.firstSeenAt).toBe(state.firstSeenAt);
	});

	it('announces recovery once, then clears the record', () => {
		const state: AlertState = {
			signature: 'supabase:down',
			firstSeenAt: '2026-09-13T01:40:00Z',
			lastEmailedAt: '2026-09-13T01:40:00Z',
		};
		const d = decideAlert(OK, at('2026-09-13T05:39:00Z'), state);
		expect(d).toMatchObject({ email: true, reason: 'recovered', nextState: null });
		expect(decideAlert(OK, at('2026-09-13T05:49:00Z'), null))
			.toMatchObject({ email: false, reason: 'healthy' });
	});

	it('never emails when nothing is wrong and nothing is on record', () => {
		expect(decideAlert(OK, at('2026-09-13T05:39:00Z'), null))
			.toMatchObject({ email: false, reason: 'healthy' });
	});
});

describe('decideAlert with the store unreachable (Supabase itself is down)', () => {
	const blind = undefined;

	it('emails in the one daily slot', () => {
		const t = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, 0, 0));
		expect(decideAlert(SB_DOWN, t, blind)).toMatchObject({ email: true, reason: 'fallback_slot' });
	});

	it('stays quiet in every other slot of that hour', () => {
		for (const min of [10, 20, 30, 40, 50]) {
			const t = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, min, 0));
			expect(decideAlert(SB_DOWN, t, blind)).toMatchObject({ email: false, reason: 'fallback_quiet' });
		}
	});

	it('stays quiet in every other hour', () => {
		for (let h = 0; h < 24; h++) {
			if (h === FALLBACK_HOUR_UTC) continue;
			const t = new Date(Date.UTC(2026, 8, 13, h, 0, 0));
			expect(decideAlert(SB_DOWN, t, blind)).toMatchObject({ email: false, reason: 'fallback_quiet' });
		}
	});

	it('never emails a blind healthy report', () => {
		const t = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, 0, 0));
		expect(decideAlert(OK, t, blind)).toMatchObject({ email: false, reason: 'healthy' });
	});
});

describe("replaying 2026-09-13: a Supabase outage, checked every 10 minutes", () => {
	/** Walk the real cron cadence from 01:40 GMT, the hour the outage began. */
	function replay(steps: number, storeReadable: boolean): number {
		let state: AlertState | null = null;
		let emails = 0;
		const start = Date.UTC(2026, 8, 13, 1, 40, 0);
		for (let i = 0; i < steps; i++) {
			const now = new Date(start + i * 10 * 60_000);
			const d = decideAlert(SB_DOWN, now, storeReadable ? state : undefined);
			if (d.email) {
				emails++;
				if (storeReadable) state = d.nextState;
			}
		}
		return emails;
	}

	const DAY = 144; // 10-minute checks in 24 hours

	it('sends 1 email in the first 24 hours instead of 144', () => {
		expect(replay(DAY, true)).toBe(1);
	});

	it('sends 2 in 48 hours — the first, then one reminder a day later', () => {
		expect(replay(2 * DAY, true)).toBe(2);
	});

	it('sends 1 per day when the store is unreachable', () => {
		expect(replay(DAY, false)).toBe(1);
		expect(replay(2 * DAY, false)).toBe(2);
	});
});
