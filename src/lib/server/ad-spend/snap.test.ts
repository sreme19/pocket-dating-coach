import { describe, it, expect } from 'vitest';
import { offsetSuffix, addDays } from './snap';

/**
 * The offset is derived rather than hardcoded because Snap rejects a stats range
 * whose bounds are not midnight in the AD ACCOUNT's timezone. A literal '+08:00'
 * is right for the current Asia/Singapore account and silently wrong for any
 * other — and silently wrong here means every day's spend filed against the
 * wrong date, with totals that still look plausible.
 */
describe('offsetSuffix', () => {
  it('handles the current ad account zone', () => {
    expect(offsetSuffix('Asia/Singapore', '2026-08-10')).toBe('+08:00');
  });

  it('handles a half-hour zone — the reporting zone is one', () => {
    // IST is +05:30. A whole-hour-only implementation would return +05:00 and be
    // wrong by thirty minutes on every boundary.
    expect(offsetSuffix('Asia/Kolkata', '2026-08-10')).toBe('+05:30');
  });

  it('resolves the offset for the date asked about, not for today', () => {
    // Same zone, opposite sides of a DST transition. A single cached offset
    // would move the day boundary by an hour halfway through a sync window.
    expect(offsetSuffix('America/New_York', '2026-08-10')).toBe('-04:00');
    expect(offsetSuffix('America/New_York', '2026-01-10')).toBe('-05:00');
    expect(offsetSuffix('Europe/London', '2026-08-10')).toBe('+01:00');
    expect(offsetSuffix('Europe/London', '2026-01-10')).toBe('+00:00');
  });

  it('treats UTC as zero', () => {
    expect(offsetSuffix('UTC', '2026-08-10')).toBe('+00:00');
  });

  it('falls back to zero rather than throwing on a missing or bogus zone', () => {
    // This runs unattended on a cron. An unrecognised zone must degrade, not
    // take the whole spend sync down.
    expect(offsetSuffix(null, '2026-08-10')).toBe('+00:00');
    expect(offsetSuffix('Not/AZone', '2026-08-10')).toBe('+00:00');
  });
});

describe('addDays', () => {
  it('walks days without dragging in a local timezone', () => {
    expect(addDays('2026-08-10', 1)).toBe('2026-08-11');
    expect(addDays('2026-08-10', -1)).toBe('2026-08-09');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
