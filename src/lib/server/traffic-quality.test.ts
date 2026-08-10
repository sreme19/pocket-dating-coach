import { describe, it, expect } from 'vitest';
import {
  classifyTraffic,
  splitTraffic,
  networkOf,
  adSetKeyOf,
  isCrawlerUserAgent,
  isMobileUserAgent
} from './traffic-quality';

/** Real strings taken from production rows on 2026-08-10. */
const UA = {
  androidSnap: 'Mozilla/5.0 (Linux; Android 15; CPH2825) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
  curl: 'curl/8.7.1',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
};

const snapUtm = { utm_source: 'snapchat', utm_campaign: 'men_25_40_casual_story_ind_lpv' };
const metaUtm = { utm_source: 'ig', utm_campaign: '6978093820881', utm_term: '6978093821081' };

describe('user agent detection', () => {
  it('spots self-identifying clients', () => {
    expect(isCrawlerUserAgent(UA.curl)).toBe(true);
    expect(isCrawlerUserAgent('facebookexternalhit/1.1')).toBe(true);
    expect(isCrawlerUserAgent(UA.androidSnap)).toBe(false);
  });

  it('spots handsets', () => {
    expect(isMobileUserAgent(UA.androidSnap)).toBe(true);
    expect(isMobileUserAgent(UA.iphone)).toBe(true);
    expect(isMobileUserAgent(UA.macSafari)).toBe(false);
  });
});

describe('network normalisation', () => {
  it('folds Meta placements into one network', () => {
    // utm_source carries the PLACEMENT on Meta, never the word "meta". Grouping
    // on the raw value splits one network into two half-sized rows.
    expect(networkOf({ utm_source: 'ig' })).toBe('meta');
    expect(networkOf({ utm_source: 'fb' })).toBe('meta');
    expect(networkOf({ utm_source: 'snapchat' })).toBe('snap');
    expect(networkOf({ utm_source: 'newsletter' })).toBe('other');
    expect(networkOf(null)).toBe('other');
  });
});

describe('classifyTraffic', () => {
  it('counts a real Snap click from a handset', () => {
    expect(classifyTraffic({ user_agent: UA.androidSnap, utm: snapUtm })).toEqual({
      counted: true,
      reason: null
    });
  });

  it('excludes the Snap ad-review crawler — desktop cannot have swiped an ad', () => {
    // This is the rule that matters: 76 US desktop rows against 57 Indian mobile
    // ones, arriving in bursts after every creative edit.
    expect(classifyTraffic({ user_agent: UA.macSafari, utm: snapUtm })).toEqual({
      counted: false,
      reason: 'desktop_on_snap'
    });
  });

  it('KEEPS desktop Meta traffic — Facebook has a real desktop surface', () => {
    expect(classifyTraffic({ user_agent: UA.macChrome, utm: metaUtm }).counted).toBe(true);
  });

  it('excludes anything without a user agent', () => {
    expect(classifyTraffic({ user_agent: null, utm: snapUtm }).reason).toBe('no_user_agent');
  });

  it('splits and counts reasons without losing rows', () => {
    const rows = [
      { user_agent: UA.androidSnap, utm: snapUtm },
      { user_agent: UA.macSafari, utm: snapUtm },
      { user_agent: UA.curl, utm: snapUtm },
      { user_agent: UA.macChrome, utm: metaUtm }
    ];
    const split = splitTraffic(rows);
    expect(split.counted).toHaveLength(2);
    expect(split.excluded).toHaveLength(2);
    expect(split.counted.length + split.excluded.length).toBe(rows.length);
    expect(split.byReason).toEqual({ desktop_on_snap: 1, crawler: 1 });
  });
});

describe('adSetKeyOf', () => {
  it('reads the ad set id from utm_id on Snap', () => {
    const k = adSetKeyOf({ ...snapUtm, utm_id: '7807b736-2c88-40ee-be1a-1a4db58d038e' });
    expect(k.network).toBe('snap');
    expect(k.adSetId).toBe('7807b736-2c88-40ee-be1a-1a4db58d038e');
    expect(k.key).toBe('snap:7807b736-2c88-40ee-be1a-1a4db58d038e');
  });

  it('reads the ad set id from utm_term on Meta', () => {
    expect(adSetKeyOf(metaUtm).key).toBe('meta:6978093821081');
  });

  it('ignores a macro that never resolved', () => {
    // Snap stores "{{adSet.id}}" verbatim when the macro does not resolve.
    // Joining on it would merge every unresolved row into one fake ad set.
    const k = adSetKeyOf({ ...snapUtm, utm_id: '{{adSet.id}}' });
    expect(k.adSetId).toBeNull();
    expect(k.key).toBe('snap:name:men_25_40_casual_story_ind_lpv');
  });

  it('falls back to the ad set name so pre-id rows still group', () => {
    expect(adSetKeyOf(snapUtm).key).toBe('snap:name:men_25_40_casual_story_ind_lpv');
  });

  it('never collides a numeric Meta id with a Snap one', () => {
    const a = adSetKeyOf({ utm_source: 'snapchat', utm_id: '123' });
    const b = adSetKeyOf({ utm_source: 'ig', utm_term: '123' });
    expect(a.key).not.toBe(b.key);
  });
});
