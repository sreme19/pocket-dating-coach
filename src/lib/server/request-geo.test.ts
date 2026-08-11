import { describe, it, expect } from 'vitest';
import { countryFromRequest, geoFromRequest } from './request-geo';

/**
 * The decode is the whole reason this file has tests.
 *
 * Vercel percent-encodes the city header, and skipping that step fails in the
 * way that does not look like a failure: the column fills, the dashboard
 * renders, and one city quietly becomes two rows each holding half its traffic.
 * A missing city would have been noticed on the first chart; a split one might
 * never be.
 */

function req(headers: Record<string, string>): Request {
  return new Request('https://riteangle.dating/get', { headers });
}

describe('countryFromRequest', () => {
  it('reads and upper-cases the Vercel header', () => {
    expect(countryFromRequest(req({ 'x-vercel-ip-country': 'in' }))).toBe('IN');
  });

  it('falls back to the Cloudflare header', () => {
    expect(countryFromRequest(req({ 'cf-ipcountry': 'ID' }))).toBe('ID');
  });

  it('rejects the anonymising-proxy and Tor placeholders', () => {
    // Storing these as countries would put a market that does not exist onto a
    // spend-allocation chart.
    expect(countryFromRequest(req({ 'cf-ipcountry': 'XX' }))).toBeNull();
    expect(countryFromRequest(req({ 'cf-ipcountry': 'T1' }))).toBeNull();
  });

  it('rejects anything that is not two letters', () => {
    expect(countryFromRequest(req({ 'x-vercel-ip-country': 'India' }))).toBeNull();
    expect(countryFromRequest(req({ 'x-vercel-ip-country': '' }))).toBeNull();
  });
});

describe('geoFromRequest', () => {
  it('decodes a percent-encoded city', () => {
    const geo = geoFromRequest(req({ 'x-vercel-ip-city': 'New%20Delhi' }));
    expect(geo.city).toBe('New Delhi');
  });

  it('decodes non-ASCII city names', () => {
    const geo = geoFromRequest(req({ 'x-vercel-ip-city': 'Bengal%C5%ABru' }));
    expect(geo.city).toBe('Bengalūru');
  });

  it('keeps an already-plain city unchanged', () => {
    expect(geoFromRequest(req({ 'x-vercel-ip-city': 'Bangalore' })).city).toBe('Bangalore');
  });

  it('keeps the raw value when the encoding is malformed', () => {
    // decodeURIComponent throws on a lone '%'. A slightly ugly label still tells
    // you which market it was; a null tells you nothing.
    expect(geoFromRequest(req({ 'x-vercel-ip-city': 'Bad%City' })).city).toBe('Bad%City');
  });

  it('strips control characters rather than storing them', () => {
    const geo = geoFromRequest(req({ 'x-vercel-ip-city': 'Pune%09%0A' }));
    expect(geo.city).toBe('Pune');
  });

  it('caps an absurdly long city name', () => {
    const geo = geoFromRequest(req({ 'x-vercel-ip-city': 'a'.repeat(500) }));
    expect(geo.city?.length).toBe(80);
  });

  it('upper-cases the region and keeps it as the bare subdivision code', () => {
    // `KA`, never `IN-KA` — reassembling the full ISO code here would mean
    // guessing the country half for the rows whose country header went missing.
    expect(geoFromRequest(req({ 'x-vercel-ip-country-region': 'ka' })).region).toBe('KA');
  });

  it('returns nulls when the edge sent nothing', () => {
    expect(geoFromRequest(req({}))).toEqual({ country: null, city: null, region: null });
  });

  it('returns null for an empty city header rather than an empty string', () => {
    // An empty string in the column would group as its own city on every chart.
    expect(geoFromRequest(req({ 'x-vercel-ip-city': '%20%20' })).city).toBeNull();
  });

  it('reads all three together', () => {
    const geo = geoFromRequest(
      req({
        'x-vercel-ip-country': 'IN',
        'x-vercel-ip-city': 'Bangalore',
        'x-vercel-ip-country-region': 'KA'
      })
    );
    expect(geo).toEqual({ country: 'IN', city: 'Bangalore', region: 'KA' });
  });
});
