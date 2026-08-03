import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Two invariants, both learned the hard way:
 *
 *  - The referrer card is optional in both beta emails. Signups from an admin
 *    recruiting link have no referrer_id at all, and a referrer row can always
 *    fail to load — neither may block the email, so a null referrer must still
 *    render a complete, name-free message with the store buttons.
 *  - Since open testing (2026-08-03) every invitee-facing email carries BOTH
 *    store links and promises no follow-up. A confirmation that told someone to
 *    wait for a personal invite would be waiting on a step that no longer runs.
 */

vi.mock('$env/dynamic/private', () => ({ env: { RESEND_API_KEY: 'test' } }));

const {
  buildEarlyAccessHtml,
  buildBetaConfirmationHtml,
  sendEarlyAccessEmail,
  sendBetaConfirmationEmail,
  sendNewSignupAlert,
  buildNewSignupAlertHtml,
  buildWhatsappInvite,
  inviteUrlFor
} = await import('./beta-invite-email');

const PLAY = 'https://play.google.com/store/apps/details?id=com.riteangle.app';
const TESTFLIGHT = 'https://testflight.apple.com/join/FxGV4VrC';

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

  it('offers the other store too, so a wrong device is not a dead end', () => {
    const android = buildEarlyAccessHtml(REFERRER, 'android', 'https://play.example');
    expect(android).toContain(TESTFLIGHT);

    const ios = buildEarlyAccessHtml(REFERRER, 'ios', TESTFLIGHT);
    expect(ios).toContain(PLAY);
  });

  it('still renders both stores with no device on file at all', () => {
    const html = buildEarlyAccessHtml(REFERRER, null);
    expect(html).toContain(PLAY);
    expect(html).toContain(TESTFLIGHT);
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
    expect(html).toContain('What happens next?');
    expect(html).not.toContain('your match');
  });

  it('is the invite: both store links, on every platform hint', () => {
    for (const platform of ['android', 'ios', null] as const) {
      const html = buildBetaConfirmationHtml(REFERRER, platform);
      expect(html).toContain(PLAY);
      expect(html).toContain(TESTFLIGHT);
    }
  });

  it('leads with the store they picked', () => {
    // The primary (filled, pink) button comes first in the markup.
    const ios = buildBetaConfirmationHtml(REFERRER, 'ios');
    expect(ios.indexOf(TESTFLIGHT)).toBeLessThan(ios.indexOf(PLAY));

    const android = buildBetaConfirmationHtml(REFERRER, 'android');
    expect(android.indexOf(PLAY)).toBeLessThan(android.indexOf(TESTFLIGHT));
  });

  it('does not promise a follow-up invite email — that step is gone', () => {
    const html = buildBetaConfirmationHtml(REFERRER, 'android');
    expect(html).not.toContain('follow-up email');
    expect(html).not.toContain('rolling out invites');
    expect(html).not.toContain('Sit tight');
  });
});

/**
 * The new-signup alert. It goes to the TEAM, not the invitee — so it may name
 * the referrer even on a private link, and it must carry the same fields the
 * admin table shows so nobody has to open the tab just to see who signed up.
 */
describe('new-signup alert', () => {
  const SIGNUP = {
    email: 'tester@example.com',
    whatsapp: '+91 90680 48277',
    platform: 'android' as const,
    referrerName: 'Priya',
    linkLabel: 'Personal link',
    mood: null,
    total: 40,
  };

  it('carries every field the admin row shows, plus the list position', () => {
    const html = buildNewSignupAlertHtml(SIGNUP);
    expect(html).toContain('tester@example.com');
    expect(html).toContain('+91 90680 48277');
    expect(html).toContain('Android');
    expect(html).toContain('Priya');
    expect(html).toContain('Personal link');
    expect(html).toContain('#40');
  });

  it('links the admin tab so the invite is one click away', () => {
    expect(buildNewSignupAlertHtml(SIGNUP)).toContain(
      'https://www.riteangle.dating/admin/beta'
    );
  });

  it('marks the blanks rather than lying about them', () => {
    const html = buildNewSignupAlertHtml({
      ...SIGNUP,
      whatsapp: '',
      platform: null,
      referrerName: null,
      linkLabel: 'Admin recruiting link',
      total: null,
    });
    expect(html).toContain('not provided');
    expect(html).toContain('Admin link');
    expect(html).not.toContain('on the list');
  });

  it('escapes a referrer name that contains markup', () => {
    const html = buildNewSignupAlertHtml({ ...SIGNUP, referrerName: '<script>x</script>' });
    expect(html).not.toContain('<script>');
  });

  it('is replyable to the signup, and says so instead of "do not reply"', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await sendNewSignupAlert(SIGNUP);
      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(body.to).toEqual(['chris@wardrobeofamonk.com']);
      expect(body.reply_to).toBe('tester@example.com');
      expect(body.subject).toContain('tester@example.com');
      expect(body.subject).toContain('Priya');
      expect(body.html).not.toContain("please don't reply");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
