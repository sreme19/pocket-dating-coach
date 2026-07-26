/**
 * Referral-link modes (Refer & Earn).
 *
 * A member owns up to two links, distinguished by `verified_vibe_referral_links.mode`:
 *
 *   public  — the /beta landing shows their card (photo, name, age, city) and a
 *             cross-gender joiner is auto-matched to them.
 *   private — the landing shows nothing about them, and NO match is ever formed
 *             in either direction. Attribution and cash are IDENTICAL to public:
 *             same ledger, same tracks, same rates.
 *
 * Everything here exists to keep the `mode` column optional at runtime: migration
 * 20260726170526 may not have been run yet on a given environment (they are
 * applied by hand in the Supabase SQL editor), and a missing column must degrade
 * to "public only" rather than break Refer & Earn or the /beta landing.
 */

const TABLE = 'verified_vibe_referral_links';

/** Postgres `undefined_column` — the pre-migration `mode` case. */
const UNDEFINED_COLUMN = '42703';

export type LinkMode = 'public' | 'private';

export function isUndefinedColumn(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return `${code}` === UNDEFINED_COLUMN;
}

/** A row's mode, defaulting to 'public' — pre-migration rows have no column. */
export function modeOf(row: { mode?: string | null } | null | undefined): LinkMode {
  return row?.mode === 'private' ? 'private' : 'public';
}

/**
 * Select referral links with `mode` appended to `columns`, falling back to a
 * mode-less select when the column doesn't exist yet.
 *
 * `filter` receives the query builder so callers can add their own .eq()/.limit().
 * `hasMode` tells the caller whether private links are even representable — the
 * one thing it must not do pre-migration is *create* one.
 *
 * A non-column error is reported as no rows, matching how every existing caller
 * already treats a failed link read.
 */
export async function selectReferralLinks(
  db: any,
  columns: string,
  filter: (q: any) => any = (q) => q
): Promise<{ rows: Array<Record<string, any>>; hasMode: boolean }> {
  const withMode = await filter(db.from(TABLE).select(`${columns}, mode`));
  if (!withMode.error) return { rows: withMode.data ?? [], hasMode: true };
  if (!isUndefinedColumn(withMode.error)) return { rows: [], hasMode: true };

  const plain = await filter(db.from(TABLE).select(columns));
  return { rows: plain.data ?? [], hasMode: false };
}

/**
 * The mode of the link a signup came through, resolved from its `link_id`.
 *
 * `link_id` is NOT NULL on verified_vibe_beta_signups and the row cascade-deletes
 * with its link, so the link is the single source of truth for privacy — nothing
 * is denormalised onto the signup that could drift from it.
 */
export async function signupLinkMode(db: any, linkId: string | null | undefined): Promise<LinkMode> {
  if (!linkId) return 'public';
  const { rows } = await selectReferralLinks(db, 'id', (q) => q.eq('id', linkId).limit(1));
  return modeOf(rows[0]);
}
