import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The join alert has to survive the state a brand-new row is actually in: the
 * profile exists seconds after the OTP, so name/city/age/archetype are usually
 * still empty and the auth email lookup can fail outright. None of that may
 * suppress the alert — the whole point is to hear about the join immediately.
 */

vi.mock('$env/dynamic/private', () => ({ env: { RESEND_API_KEY: 'test' } }));

const {
  buildNewMemberAlertHtml,
  newMemberSubject,
  sendNewMemberAlert,
  memberHeadline,
  memberProfilePath,
  formatJoinedAt,
  isRealMember,
} = await import('../new-member-alert');

const MEMBER = {
  id: '11111111-2222-3333-4444-555555555555',
  name: 'Missi',
  email: 'missi@example.com',
  age: 19,
  city: 'Rudrapur',
  gender: 'Woman',
  archetype: 'just_friends_woman',
  joinedAt: '2026-07-28T14:12:00.000Z',
};

/** A row saved the moment the account exists — nothing filled in yet. */
const BARE_MEMBER = {
  id: '99999999-8888-7777-6666-555555555555',
  name: null,
  email: null,
  age: null,
  city: null,
  gender: null,
  archetype: null,
  joinedAt: '2026-07-28T14:12:00.000Z',
};

describe('isRealMember', () => {
  it('alerts on real signups only', () => {
    expect(isRealMember({ is_seed: false })).toBe(true);
    expect(isRealMember({ is_seed: true })).toBe(false);
  });

  it('treats an unset is_seed as seed, matching the admin Type column', () => {
    expect(isRealMember({ is_seed: null })).toBe(false);
    expect(isRealMember({})).toBe(false);
  });
});

describe('memberHeadline', () => {
  it('reads as name, age · city when the profile is filled in', () => {
    expect(memberHeadline(MEMBER)).toBe('Missi, 19 · Rudrapur');
  });

  it('falls back to "New member" with no invented age or city', () => {
    expect(memberHeadline(BARE_MEMBER)).toBe('New member');
  });

  it('drops only the parts that are missing', () => {
    expect(memberHeadline({ ...MEMBER, city: '  ' })).toBe('Missi, 19');
    expect(memberHeadline({ ...MEMBER, name: null })).toBe('New member, 19 · Rudrapur');
  });
});

describe('formatJoinedAt', () => {
  it('renders the join time in IST, not UTC', () => {
    // 14:12 UTC is 19:42 IST the same day.
    const out = formatJoinedAt('2026-07-28T14:12:00.000Z');
    expect(out).toContain('28 Jul 2026');
    expect(out).toContain('7:42');
    expect(out).toContain('IST');
  });

  it('passes an unparseable timestamp through rather than showing "Invalid Date"', () => {
    expect(formatJoinedAt('not-a-date')).toBe('not-a-date');
  });
});

describe('memberProfilePath', () => {
  // The team wants the member-facing profile, previewed from the side that
  // would actually see it — same link the admin Users table builds.
  it('previews a woman as a man would see her', () => {
    expect(memberProfilePath(MEMBER)).toBe(
      `/verified-vibe/profile/${MEMBER.id}?adminPreview=1&as=man`
    );
  });

  it('previews a man as a woman would see him', () => {
    expect(memberProfilePath({ id: 'abc', gender: 'man' })).toContain('as=woman');
  });

  it('previews an unset gender as a man rather than dropping the viewer', () => {
    expect(memberProfilePath(BARE_MEMBER)).toContain('as=man');
  });
});

describe('buildNewMemberAlertHtml', () => {
  it('carries the member details and a link to their profile', () => {
    const html = buildNewMemberAlertHtml(MEMBER, 43);
    expect(html).toContain('Missi, 19 · Rudrapur');
    expect(html).toContain('missi@example.com');
    expect(html).toContain('just_friends_woman');
    expect(html).toContain(`/verified-vibe/profile/${MEMBER.id}?adminPreview=1&amp;as=man`);
    expect(html).not.toContain('/admin/users/');
    expect(html).toContain('#43');
  });

  it('renders a bare row as "not set yet" instead of blank cells or "null"', () => {
    const html = buildNewMemberAlertHtml(BARE_MEMBER, null);
    expect(html).toContain('not set yet');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
    expect(html).toContain(`/verified-vibe/profile/${BARE_MEMBER.id}?adminPreview=1`);
  });

  it('drops the member number when the count could not be read', () => {
    expect(buildNewMemberAlertHtml(MEMBER, null)).not.toContain('member <strong>#');
  });

  it('escapes a name that would otherwise inject markup', () => {
    const html = buildNewMemberAlertHtml({ ...MEMBER, name: '<script>x</script>' }, null);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('newMemberSubject', () => {
  it('names the member so the inbox is scannable', () => {
    expect(newMemberSubject(MEMBER, 43)).toBe('New member joined — Missi, 19 · Rudrapur (#43)');
  });

  it('still says something useful for an empty profile', () => {
    expect(newMemberSubject(BARE_MEMBER, null)).toBe('New member joined — New member');
  });
});

describe('sendNewMemberAlert', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);

  it('goes to the team inbox and lets them reply straight to the member', async () => {
    await sendNewMemberAlert(MEMBER, 43);
    const body = sentBody();
    expect(body.to).toEqual(['chris@wardrobeofamonk.com']);
    expect(body.reply_to).toBe('missi@example.com');
    expect(body.subject).toContain('Missi');
  });

  it('sends without a reply-to when the auth email could not be resolved', async () => {
    await sendNewMemberAlert(BARE_MEMBER, null);
    const body = sentBody();
    expect(body.to).toEqual(['chris@wardrobeofamonk.com']);
    expect(body.reply_to).toBeUndefined();
  });
});
