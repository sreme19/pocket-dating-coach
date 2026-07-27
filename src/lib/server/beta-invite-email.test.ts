import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The referrer card is optional in both beta emails. Signups from an admin
 * recruiting link have no referrer_id at all, and a referrer row can always
 * fail to load — neither may block the email, so these assert that a null
 * referrer still renders a complete, name-free message with the store button.
 */

vi.mock('$env/dynamic/private', () => ({ env: { RESEND_API_KEY: 'test' } }));

const {
  buildEarlyAccessHtml,
  buildBetaConfirmationHtml,
  sendEarlyAccessEmail,
  sendBetaConfirmationEmail,
  buildWhatsappInvite,
  inviteUrlFor
} = await import('./beta-invite-email');

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

/**
 * The team keeps a record of every invite that goes out, but it must stay a
 * blind copy — the invitee may never see that anyone else was on the message.
 */
describe('early-access invite recipients', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);

  it('bccs the team on the invite and leaves the invitee the only visible recipient', async () => {
    await sendEarlyAccessEmail('tester@example.com', REFERRER, 'android');
    const body = sentBody();
    expect(body.to).toEqual(['tester@example.com']);
    expect(body.bcc).toEqual(['chris@wardrobeofamonk.com']);
  });

  it('does not copy anyone on the auto confirmation email', async () => {
    await sendBetaConfirmationEmail('tester@example.com', REFERRER);
    expect(sentBody().bcc).toBeUndefined();
  });
});

/**
 * The copyable invite in /admin/beta. It carries ONE link — the riteangle
 * /beta/{token}/app page — because an earlier version pasted her raw storage URL
 * plus the bare store URL and read like spam. These lock that: exactly one URL,
 * on our domain, with the device baked in, and no raw store or photo URL leaking
 * back into the text.
 */
describe('inviteUrlFor', () => {
  it('builds a riteangle /app link with the device baked in', () => {
    expect(inviteUrlFor('rvVN59Tk41yM', 'ios')).toBe(
      'https://www.riteangle.dating/beta/rvVN59Tk41yM/app?d=ios'
    );
    expect(inviteUrlFor('rvVN59Tk41yM', 'android')).toBe(
      'https://www.riteangle.dating/beta/rvVN59Tk41yM/app?d=android'
    );
  });

  it('escapes a token so it cannot break out of the path', () => {
    expect(inviteUrlFor('a/b?c', 'ios')).toBe(
      'https://www.riteangle.dating/beta/a%2Fb%3Fc/app?d=ios'
    );
  });
});

describe('buildWhatsappInvite', () => {
  const URL_IOS = 'https://www.riteangle.dating/beta/tok123/app?d=ios';

  it('contains exactly one link, and it is the invite page', () => {
    const { text } = buildWhatsappInvite(REFERRER, 'ios', URL_IOS);
    const urls = text.match(/https?:\/\/\S+/g) ?? [];
    expect(urls).toEqual([URL_IOS]);
  });

  it('no longer pastes her raw photo URL or a raw store URL', () => {
    const { text } = buildWhatsappInvite(REFERRER, 'ios', URL_IOS);
    expect(text).not.toContain('example.com/p.jpg');
    expect(text).not.toContain('testflight.apple.com');
    expect(text).not.toContain('play.google.com');
  });

  it('opens on words, not on a URL, and ends with the link', () => {
    const { text } = buildWhatsappInvite(REFERRER, 'ios', URL_IOS);
    expect(text.startsWith('Congratulations')).toBe(true);
    // Trailing sign-off aside, the link is the last thing of substance.
    expect(text.indexOf(URL_IOS)).toBeGreaterThan(text.indexOf('matched with'));
  });

  it('names her with age and city in the text', () => {
    const { text } = buildWhatsappInvite(REFERRER, 'ios', URL_IOS);
    expect(text).toContain('Priya · 27 · Bengaluru');
  });

  it('renders her card in the html flavour and links the same URL', () => {
    const { html } = buildWhatsappInvite(REFERRER, 'ios', URL_IOS);
    expect(html).toContain('<img src="https://example.com/p.jpg"');
    expect(html).toContain('Priya');
    expect(html).toContain(`href="${URL_IOS}"`);
  });

  it('drops the card and the name when there is no referrer (admin or private link)', () => {
    const { text, html } = buildWhatsappInvite(null, 'android', URL_IOS);
    expect(text).toContain(URL_IOS);
    expect(text).not.toContain('matched with');
    expect(text).not.toContain('your match');
    expect(html).not.toContain('<img');
  });

  it('escapes a referrer name that contains markup', () => {
    const { html } = buildWhatsappInvite(
      { ...REFERRER, first_name: '<script>x</script>' },
      'ios',
      URL_IOS
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
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
