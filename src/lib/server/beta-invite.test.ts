import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Refer & Earn attribution: WHICH FLOW A SIGNUP COUNTS UNDER IS DECIDED BY THE
 * JOINER'S GENDER, never by which link variant was shared.
 *
 * There is one referral link per referrer ("invite women" and "invite men" are
 * the same token, differing only by the ?m=<mood> copy) and a signup row stores
 * no gender, so these four cases all have to resolve at verification time:
 *
 *   woman's link → man joins    → man track (25 INR)      + match
 *   woman's link → woman joins  → woman track (100/150)   , NO match
 *   man's link   → woman joins  → woman track (100/150)   + match to him
 *   man's link   → man joins    → attribution only: no cash, NO match
 *
 * A PRIVATE link (verified_vibe_referral_links.mode) cuts across all four: same
 * cash, same attribution, and NO match in either direction.
 *
 * These tests drive the real functions against a fake Supabase client and assert
 * on what was written, so a regression in the gender routing fails here.
 */

type Row = Record<string, any>;

/** Minimal stand-in for the PostgREST builder surface these functions use. */
function makeDb(opts: {
  users: Record<string, { gender: string }>;
  signup: Row | null;
  email?: string;
  existingMatch?: Row | null;
  rewardCount?: number;
  /** Mode of the link the signup came through (default 'public'). */
  linkMode?: 'public' | 'private';
  /** Simulate a database where migration 20260726170526 hasn't run yet. */
  noModeColumn?: boolean;
}) {
  const inserts: Record<string, Row[]> = {};
  const updates: Record<string, Row[]> = {};

  const record = (bag: Record<string, Row[]>, table: string, row: Row) => {
    (bag[table] ??= []).push(row);
  };

  const db: any = {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { email: opts.email ?? 'joiner@example.com' } },
        })),
      },
    },
    from(table: string) {
      const state: Row = { table, filters: {} };
      const builder: any = {
        select(cols?: string, cfg?: { count?: string; head?: boolean }) {
          state.counting = cfg?.count === 'exact';
          state.cols = cols ?? '';
          return builder;
        },
        eq(col: string, val: unknown) {
          state.filters[col] = val;
          return builder;
        },
        neq: () => builder,
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        insert(row: Row) {
          record(inserts, table, row);
          state.inserted = row;
          return builder;
        },
        update(row: Row) {
          record(updates, table, row);
          return builder;
        },
        async maybeSingle() {
          if (table === 'verified_vibe_users') {
            const u = opts.users[state.filters.id];
            return { data: u ? { id: state.filters.id, ...u } : null, error: null };
          }
          if (table === 'verified_vibe_beta_signups') return { data: opts.signup, error: null };
          if (table === 'verified_vibe_matches') {
            return { data: opts.existingMatch ?? null, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          return { data: { id: 'new-match-1' }, error: null };
        },
        // `await`ing the builder itself (the count queries and the referral-link
        // reads do this).
        then(resolve: (v: any) => void) {
          if (table === 'verified_vibe_referral_links') {
            // Pre-migration: selecting `mode` is an undefined_column error, and
            // the caller is expected to retry without it.
            if (opts.noModeColumn && `${state.cols}`.includes('mode')) {
              resolve({ data: null, error: { code: '42703' } });
              return;
            }
            resolve({
              data: [{ id: state.filters.id ?? 'link-1', mode: opts.linkMode ?? 'public' }],
              error: null,
            });
            return;
          }
          if (state.counting) {
            resolve({ count: opts.rewardCount ?? 0, error: null });
          } else {
            resolve({ data: null, error: null });
          }
        },
      };
      return builder;
    },
    _inserts: inserts,
    _updates: updates,
  };
  return db;
}

const WOMAN_REFERRER = 'referrer-woman';
const MAN_REFERRER = 'referrer-man';
const JOINER = 'joiner-1';

const signupFor = (referrerId: string): Row => ({
  id: 'signup-1',
  referrer_id: referrerId,
  link_id: 'link-1',
  status: 'pending',
  mood: 'casual',
});

let currentDb: any;
vi.mock('./supabase', () => ({ getSupabase: () => currentDb }));
vi.mock('./matchmaker-service', () => ({ sendMatchNotification: vi.fn(async () => {}) }));
vi.mock('./bestie-responder', () => ({ generateAndSendBestieOpener: vi.fn(async () => {}) }));

const rewards = (db: any): Row[] => db._inserts['vv_referral_rewards'] ?? [];
const matches = (db: any): Row[] => db._inserts['verified_vibe_matches'] ?? [];
const signupUpdates = (db: any): Row[] => db._updates['verified_vibe_beta_signups'] ?? [];

describe('Refer & Earn attribution by joiner gender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a MAN joining a woman's link counts on the man track (25 INR) and matches her", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'man' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
    });
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(JOINER);

    expect(rewards(currentDb)).toHaveLength(1);
    expect(rewards(currentDb)[0]).toMatchObject({
      track: 'man',
      amount_inr: 25,
      referrer_id: WOMAN_REFERRER,
      status: 'payable',
    });
    // Cross-gender, so a match IS formed (user1 = man, user2 = woman).
    expect(matches(currentDb)).toHaveLength(1);
    expect(matches(currentDb)[0]).toMatchObject({ user1_id: JOINER, user2_id: WOMAN_REFERRER });
    expect(signupUpdates(currentDb)[0]).toMatchObject({ status: 'matched' });
  });

  it("a WOMAN joining a woman's link counts on the woman track and forms NO match", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'woman' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
      rewardCount: 0,
    });
    const { awardReferralRewardIfEligible } = await import('./beta-invite');
    await awardReferralRewardIfEligible(JOINER);

    expect(rewards(currentDb)).toHaveLength(1);
    expect(rewards(currentDb)[0]).toMatchObject({ amount_inr: 100, referrer_id: WOMAN_REFERRER });
    // The woman track omits `track` so the column default supplies it.
    expect(rewards(currentDb)[0].track).toBeUndefined();
    // Two women are never matched to each other.
    expect(matches(currentDb)).toHaveLength(0);
    expect(signupUpdates(currentDb)[0]).toMatchObject({ status: 'rewarded' });
  });

  it("a WOMAN joining a man's link counts on the woman track AND matches him", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'woman' }, [MAN_REFERRER]: { gender: 'man' } },
      signup: signupFor(MAN_REFERRER),
      rewardCount: 0,
    });
    const { awardReferralRewardIfEligible } = await import('./beta-invite');
    await awardReferralRewardIfEligible(JOINER);

    expect(rewards(currentDb)).toHaveLength(1);
    expect(rewards(currentDb)[0]).toMatchObject({ amount_inr: 100, referrer_id: MAN_REFERRER });
    expect(matches(currentDb)).toHaveLength(1);
    expect(matches(currentDb)[0]).toMatchObject({ user1_id: MAN_REFERRER, user2_id: JOINER });
  });

  it("a MAN joining another man's link is attributed only — no cash, no match", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'man' }, [MAN_REFERRER]: { gender: 'man' } },
      signup: signupFor(MAN_REFERRER),
    });
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(JOINER);

    // men→men is a deferred flow: no reward…
    expect(rewards(currentDb)).toHaveLength(0);
    // …and no same-gender match (this used to mint a man↔man match).
    expect(matches(currentDb)).toHaveLength(0);
    // The signup is still closed, so his attribution to the referrer stands.
    expect(signupUpdates(currentDb)[0]).toMatchObject({
      status: 'matched',
      matched_user_id: JOINER,
    });
  });

  it('the woman track charges 150 INR once she is past her first 25', async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'woman' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
      rewardCount: 25,
    });
    const { awardReferralRewardIfEligible } = await import('./beta-invite');
    await awardReferralRewardIfEligible(JOINER);

    expect(rewards(currentDb)[0]).toMatchObject({ amount_inr: 150, reward_index: 26 });
  });

  it("a MAN joining a woman's PRIVATE link is paid for but NOT matched to her", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'man' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
      linkMode: 'private',
    });
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(JOINER);

    // Cash and attribution are unchanged by privacy…
    expect(rewards(currentDb)).toHaveLength(1);
    expect(rewards(currentDb)[0]).toMatchObject({
      track: 'man',
      amount_inr: 25,
      referrer_id: WOMAN_REFERRER,
    });
    // …but her private link never puts him in her matches.
    expect(matches(currentDb)).toHaveLength(0);
    expect(signupUpdates(currentDb)[0]).toMatchObject({
      status: 'rewarded',
      matched_user_id: JOINER,
    });
  });

  it("a WOMAN joining a man's PRIVATE link is paid for but NOT matched to him", async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'woman' }, [MAN_REFERRER]: { gender: 'man' } },
      signup: signupFor(MAN_REFERRER),
      rewardCount: 0,
      linkMode: 'private',
    });
    const { awardReferralRewardIfEligible } = await import('./beta-invite');
    await awardReferralRewardIfEligible(JOINER);

    expect(rewards(currentDb)).toHaveLength(1);
    expect(rewards(currentDb)[0]).toMatchObject({ amount_inr: 100, referrer_id: MAN_REFERRER });
    // The man→woman auto-match is his usual upside; the private link forgoes it.
    expect(matches(currentDb)).toHaveLength(0);
  });

  it('a database without the `mode` column behaves exactly as before (public)', async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'man' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
      noModeColumn: true,
    });
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(JOINER);

    expect(rewards(currentDb)).toHaveLength(1);
    expect(matches(currentDb)).toHaveLength(1);
    expect(signupUpdates(currentDb)[0]).toMatchObject({ status: 'matched' });
  });

  it('a referral past its track cap is recorded as a 0 INR void row', async () => {
    currentDb = makeDb({
      users: { [JOINER]: { gender: 'man' }, [WOMAN_REFERRER]: { gender: 'woman' } },
      signup: signupFor(WOMAN_REFERRER),
      rewardCount: 1000, // man-track cap
    });
    const { redeemBetaInviteIfEligible } = await import('./beta-invite');
    await redeemBetaInviteIfEligible(JOINER);

    expect(rewards(currentDb)[0]).toMatchObject({
      track: 'man',
      amount_inr: 0,
      status: 'void',
      reward_index: 1001,
    });
  });
});
