import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { RESEND_API_KEY: 'test' } }));

const { buildIssueReportHtml, issueSubject, isIssueCategory, ISSUE_CATEGORIES } =
  await import('../issue-report');

const BASE = {
  reporterId: '11111111-2222-3333-4444-555555555555',
  category: 'nudity' as const,
  surface: 'discover',
  description: 'This photo should not be here.',
  subjectUserId: '99999999-8888-7777-6666-555555555555',
  subjectUrl: 'https://example.supabase.co/storage/v1/object/public/profiles/users/x/photo_0.jpg',
  context: {},
};

describe('isIssueCategory', () => {
  it('accepts only the known categories', () => {
    for (const c of ISSUE_CATEGORIES) expect(isIssueCategory(c)).toBe(true);
    expect(isIssueCategory('spam')).toBe(false);
    expect(isIssueCategory('')).toBe(false);
    expect(isIssueCategory(undefined)).toBe(false);
    expect(isIssueCategory({ category: 'nudity' })).toBe(false);
  });
});

describe('issueSubject', () => {
  // The whole point of the email channel is that a human sees it fast. A content
  // report has to be distinguishable from a broken-button report in the inbox list.
  it('marks content reports urgent and leaves the rest plain', () => {
    expect(issueSubject('nudity')).toMatch(/URGENT/);
    expect(issueSubject('disturbing')).toMatch(/URGENT/);
    expect(issueSubject('bug')).not.toMatch(/URGENT/);
    expect(issueSubject('other')).not.toMatch(/URGENT/);
  });

  it('names the category so the inbox is scannable', () => {
    expect(issueSubject('wrong_person')).toMatch(/not the person/i);
  });
});

describe('buildIssueReportHtml', () => {
  it('carries the report details and links the subject profile', () => {
    const html = buildIssueReportHtml(BASE, 'abc-123');
    expect(html).toContain('Nudity or sexual content');
    expect(html).toContain('discover');
    expect(html).toContain('This photo should not be here.');
    expect(html).toContain(`/admin/users/${BASE.subjectUserId}`);
    expect(html).toContain('abc-123');
  });

  // Nobody should have a reported nude pushed at them in an email preview — the
  // reviewer decides when to look.
  it('links the reported image instead of embedding it', () => {
    const html = buildIssueReportHtml(BASE, 'abc-123');
    expect(html).toContain('open the reported image');
    expect(html).not.toContain('<img');
  });

  it('says plainly when the DB write failed and the email is the only record', () => {
    const html = buildIssueReportHtml(BASE, null);
    expect(html).toMatch(/only record/i);
  });

  it('renders a signed-out, subjectless bug report without inventing values', () => {
    const html = buildIssueReportHtml(
      { ...BASE, category: 'bug', reporterId: null, subjectUserId: null, subjectUrl: '', description: '' },
      'id-1'
    );
    expect(html).toContain('signed out');
    expect(html).toContain('not provided');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('escapes text that would otherwise inject markup', () => {
    const html = buildIssueReportHtml({ ...BASE, description: '<script>x</script>' }, 'id-1');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
