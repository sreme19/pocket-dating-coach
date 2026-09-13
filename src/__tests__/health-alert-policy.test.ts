import { describe, it, expect } from 'vitest';
import {
	decideAlert,
	faultSignature,
	stateChanged,
	COOLDOWN_MS,
	MIN_CONSECUTIVE_FAULTS,
	FALLBACK_HOUR_UTC,
	EMPTY_STATE,
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

const OK        = report('ok', 'ok');
const SB_DOWN   = report('ok', 'down');
const SB_DEGRADED = report('ok', 'degraded');
const BOTH_DOWN = report('down', 'down');

/**
 * Walk a scripted sequence of reports at the real 10-minute cadence, threading
 * state the way the cron does, and return what would have been emailed.
 */
function walk(seq: HealthReport[], startIso = '2026-09-13T06:00:00Z') {
	let state: AlertState | null = null;
	const sent: Array<{ at: string; reason: string }> = [];
	const start = Date.parse(startIso);
	seq.forEach((r, i) => {
		const now = new Date(start + i * 10 * 60_000);
		const d = decideAlert(r, now, state);
		if (d.email) sent.push({ at: now.toISOString(), reason: d.reason });
		state = d.nextState;
	});
	return { sent, state };
}

const repeat = (r: HealthReport, n: number) => Array.from({ length: n }, () => r);

describe('faultSignature', () => {
	it('names only the failing services, in a stable order', () => {
		expect(faultSignature(OK)).toBe('');
		expect(faultSignature(SB_DOWN)).toBe('supabase:down');
		expect(faultSignature(BOTH_DOWN)).toBe('claude:down|supabase:down');
	});
});

describe('a single bad check is not an incident', () => {
	it('says nothing when one check fails and the next is fine', () => {
		const { sent } = walk([OK, SB_DOWN, OK, OK]);
		expect(sent).toEqual([]);
	});

	it('needs the fault on two consecutive checks before it speaks', () => {
		const first = decideAlert(SB_DOWN, new Date('2026-09-13T06:00:00Z'), null);
		expect(first).toMatchObject({ email: false, reason: 'settling' });
		expect(first.nextState?.consecutiveFaults).toBe(1);

		const second = decideAlert(SB_DOWN, new Date('2026-09-13T06:10:00Z'), first.nextState);
		expect(second).toMatchObject({ email: true, reason: 'new' });
		expect(MIN_CONSECUTIVE_FAULTS).toBe(2);
	});
});

describe('the 24-hour ceiling holds whatever happens', () => {
	it('replays this morning: flap, flap, real 504, recover — and sends ONE email', () => {
		// 06:40 recovered, 06:50 recovered again, 07:10 down, 07:20 recovered.
		const { sent } = walk([
			SB_DOWN, SB_DOWN, OK, OK, SB_DOWN, OK, SB_DOWN, SB_DOWN, OK, OK,
		]);
		expect(sent.map((s) => s.reason)).toEqual(['new']);
	});

	it('does not let recovery reset the clock and re-open the next fault', () => {
		const { sent } = walk([
			...repeat(SB_DOWN, 3),  // incident reported
			...repeat(OK, 3),       // clears — too soon to say so
			...repeat(SB_DOWN, 3),  // breaks again — still inside 24h
			...repeat(OK, 3),
		]);
		expect(sent.map((s) => s.reason)).toEqual(['new']);
	});

	it('sends exactly 2 across 24h of solid outage — the alert, then one reminder', () => {
		// The alert lands on the second check (06:10), so the reminder is due at
		// 06:10 the next day: 145 steps after it, not 144.
		const { sent } = walk(repeat(SB_DOWN, 147));
		expect(sent.map((s) => s.reason)).toEqual(['new', 'reminder']);
	});

	it('says nothing at all when a fault never survives two checks in a row', () => {
		const flap: HealthReport[] = [];
		for (let i = 0; i < 144; i++) flap.push(i % 2 === 0 ? SB_DOWN : OK);
		expect(walk(flap).sent).toEqual([]);
	});
});

describe('what still gets through immediately', () => {
	it('lets a reported fault getting worse past the ceiling, once', () => {
		const { sent } = walk([
			...repeat(SB_DEGRADED, 2), // reported as degraded
			...repeat(BOTH_DOWN, 3),   // strictly worse — escalates despite cooldown
			...repeat(BOTH_DOWN, 3),   // no further escalation available
		]);
		expect(sent.map((s) => s.reason)).toEqual(['new', 'changed']);
	});

	it('does not escalate for a fault that merely changes shape without worsening', () => {
		const { sent } = walk([
			...repeat(SB_DOWN, 2),
			...repeat(report('down', 'ok'), 3), // different service, same severity
		]);
		expect(sent.map((s) => s.reason)).toEqual(['new']);
	});
});

describe('recovery', () => {
	it('is announced once the day has passed, then the record is closed', () => {
		const seq = [...repeat(SB_DOWN, 2), ...repeat(OK, 145)];
		const { sent, state } = walk(seq);
		expect(sent.map((s) => s.reason)).toEqual(['new', 'recovered']);
		expect(state?.reportedSignature).toBe('');
	});

	it('is never sent for a fault that was never reported', () => {
		const { sent } = walk([SB_DOWN, OK, ...repeat(OK, 200)]);
		expect(sent).toEqual([]);
	});

	it('cannot repeat: once sent, the record says nothing is outstanding', () => {
		const state: AlertState = {
			...EMPTY_STATE,
			reportedSignature: '',
			lastEmailedAt: '2026-09-13T06:40:00Z',
		};
		expect(decideAlert(OK, new Date('2026-09-14T09:00:00Z'), state))
			.toMatchObject({ email: false, reason: 'healthy' });
	});
});

describe('the blind path (Supabase itself unreachable)', () => {
	it('emails in the one daily slot and nowhere else', () => {
		const inSlot = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, 0, 0));
		expect(decideAlert(SB_DOWN, inSlot, undefined)).toMatchObject({ email: true, reason: 'fallback_slot' });
		for (const min of [10, 30, 50]) {
			const t = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, min, 0));
			expect(decideAlert(SB_DOWN, t, undefined)).toMatchObject({ email: false, reason: 'fallback_quiet' });
		}
		for (let h = 0; h < 24; h++) {
			if (h === FALLBACK_HOUR_UTC) continue;
			expect(decideAlert(SB_DOWN, new Date(Date.UTC(2026, 8, 13, h, 0, 0)), undefined))
				.toMatchObject({ email: false, reason: 'fallback_quiet' });
		}
	});

	it('never emails a blind healthy report', () => {
		const t = new Date(Date.UTC(2026, 8, 13, FALLBACK_HOUR_UTC, 0, 0));
		expect(decideAlert(OK, t, undefined)).toMatchObject({ email: false, reason: 'healthy' });
	});
});

describe('stateChanged', () => {
	it('is false for a quiet healthy run, so the cron does not write every 10 minutes', () => {
		const d = decideAlert(OK, new Date('2026-09-13T06:00:00Z'), { ...EMPTY_STATE });
		expect(stateChanged({ ...EMPTY_STATE }, d.nextState)).toBe(false);
	});

	it('is true once a fault starts counting', () => {
		const d = decideAlert(SB_DOWN, new Date('2026-09-13T06:00:00Z'), { ...EMPTY_STATE });
		expect(stateChanged({ ...EMPTY_STATE }, d.nextState)).toBe(true);
	});
});

describe('the old outage still behaves', () => {
	it('sends 1 email in 24h where the original code sent ~70', () => {
		expect(walk(repeat(SB_DOWN, 144)).sent).toHaveLength(1);
	});
});
