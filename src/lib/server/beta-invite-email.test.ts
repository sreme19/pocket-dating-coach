import { describe, it, expect, vi } from 'vitest';

/**
 * The referrer card is optional in both beta emails. Signups from an admin
 * recruiting link have no referrer_id at all, and a referrer row can always
 * fail to load — neither may block the email, so these assert that a null
 * referrer still renders a complete, name-free message with the store button.
 */

vi.mock('$env/dynamic/private', () => ({ env: { RESEND_API_KEY: 'test' } }));

const { buildEarlyAccessHtml, buildBetaConfirmationHtml } = await import('./beta-invite-email');

const REFERRER = {
  first_name: 'Priya',
  age: 27,
  city: 'Bengaluru',
  avatar_url: 'https://example.com/p.jpg',
  about: 'Reads too much, sleeps too little.',
};

describe('buildEarlyAccessHtml', () => {
  it('shows the referrer card when there is a referrer', () => {
    const html = buildEarlyAccessHtml(REFERRER, 'android', 'https://play.example');
    expect(html).toContain('Priya');
    expect(html).toContain('https://example.com/p.jpg');
    expect(html).toContain('https://play.example');
  });

  it('sends without a referrer: no card, no placeholder name, store button intact', () => {
    const html = buildEarlyAccessHtml(null, 'android', 'https://play.example');
    expect(html).toContain('early access member');
    expect(html).toContain('https://play.example');
    expect(html).toContain('Get it on Google Play');
    expect(html).not.toContain('your match');
    expect(html).not.toContain("You've been matched with");
  });
});

describe('buildBetaConfirmationHtml', () => {
  it('sends without a referrer: no card, no placeholder name', () => {
    const html = buildBetaConfirmationHtml(null);
    expect(html).toContain('riteangle beta list');
    expect(html).toContain('What happens next?');
    expect(html).not.toContain('your match');
  });
});
