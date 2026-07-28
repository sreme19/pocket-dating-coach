/**
 * Hero-photo pick for women — the app chooses the lead photo, the owner doesn't.
 *
 * Until now a woman's hero was whichever photo the CLIENT tagged `lead`, which in
 * practice is just the first one she happened to upload. Upload order is a terrible
 * proxy for "the photo that makes someone open her profile", so this module ranks her
 * real uploads with ONE Claude vision call and records the winner on
 * `user_master_profile.data.heroPick`. Every read path floats that photo to slot 0
 * through buildPublicPhotos (see profile-photos.ts), so one stored pick moves the
 * hero on the card, the feed, the SSR profile page and Flutter at once.
 *
 * Ranking, not just re-ordering: `appeal` is how striking she looks in the shot, and
 * `heroReady` is the floor a photo must clear to carry a PUBLIC card at all (she is
 * the clear, recognisable subject; in focus; publishable). We only ever promote a
 * heroReady photo — if nothing clears the floor we write no pick and the existing
 * `lead`/upload order stands. Same posture as the identity gate: this feature can
 * improve the hero but must never make a profile worse than it was.
 *
 * MEN are skipped entirely: what a man displays is an AI portrait set whose `lead`
 * role is assigned at generation time, and his raw uploads are never shown.
 *
 * Cost discipline: one vision call per photo-set CHANGE, guarded by the same stable
 * hash photo-signals uses (re-ordering the same photos is a no-op, since the pick
 * itself is order-independent).
 */

import { getSupabase } from './supabase';
import { photoSetHash } from './photo-signals';

/** Bumping this invalidates stored picks so they are re-ranked under the new policy. */
export const HERO_PICK_VERSION = 1;

/** Max photos ranked in one call — matches the women's display cap. */
const MAX_PHOTOS = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface HeroPhotoScore {
  url: string;
  /** 0–100: how striking/attractive she looks in this photo. */
  appeal: number;
  /** Can this photo carry a public profile card at all? Only these can be promoted. */
  heroReady: boolean;
  /** <=12-word justification, kept for admin review / coaching. */
  why: string;
}

/** The record persisted on user_master_profile.data.heroPick. */
export interface HeroPick {
  /** The chosen hero's URL, or null when no photo cleared the heroReady floor. */
  url: string | null;
  scores: HeroPhotoScore[];
  /** Stable hash of the ranked photo set — skip re-ranking an unchanged set. */
  photoHash: string;
  pickedAt: string;
  version: number;
  /** 'ranked' = a hero was chosen; 'none-hero-ready' = left to the existing order. */
  reason: 'ranked' | 'none-hero-ready';
}

/**
 * Choose the hero out of scored photos. Deterministic and pure: highest `appeal`
 * among the photos that clear the heroReady floor, ties broken by the earlier
 * position so a re-run on an unchanged set can't shuffle the card.
 */
export function chooseHero(scores: HeroPhotoScore[]): { url: string; index: number } | null {
  let best = -1;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    if (!s.heroReady) continue;
    if (best === -1 || s.appeal > scores[best].appeal) best = i;
  }
  return best === -1 ? null : { url: scores[best].url, index: best };
}

/**
 * The hero URL a stored pick asks for, or null. Validated against the photo set being
 * displayed RIGHT NOW: a pick whose photo has since been removed (or re-screened out)
 * is ignored rather than pointing the card at a photo that is no longer on the profile.
 */
export function heroUrlFromPick(pick: unknown, currentUrls: string[]): string | null {
  const url = (pick as HeroPick | null)?.url;
  if (typeof url !== 'string' || !url) return null;
  return currentUrls.includes(url) ? url : null;
}

function mediaFromMime(mime: string): MediaType {
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'image/png';
  if (m.includes('webp')) return 'image/webp';
  if (m.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

/** Resolve a stored photo (hosted URL or inline dataURL) to base64 + media type. */
async function resolveImage(src: string): Promise<{ media_type: MediaType; data: string } | null> {
  if (src.startsWith('data:')) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(src);
    if (!m) return null;
    if (m[2].length * 0.75 > MAX_IMAGE_BYTES) return null;
    return { media_type: mediaFromMime(m[1]), data: m[2] };
  }
  if (!/^https?:\/\//.test(src)) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;
    const ct = res.headers.get('content-type')?.split(';')[0] ?? '';
    return {
      media_type: ct.startsWith('image/') ? mediaFromMime(ct) : mediaFromMime(src),
      data: Buffer.from(buf).toString('base64'),
    };
  } catch {
    return null;
  }
}

function buildPrompt(n: number): string {
  return `You are choosing the LEAD photo for a woman's dating profile — the single photo shown first on her card, and often the only one a man looks at before deciding to open her profile. She uploaded the ${n} photos that follow, each preceded by its number. The APP picks the lead, she does not, and the order she uploaded them in means nothing.

Score EVERY photo:
- "appeal" (0-100): how attractive and eye-catching SHE looks in this shot — face clearly visible and flattering, expression and eye contact, styling and grooming, figure and posture, lighting, framing and image quality. Judge the photo, not the person's worth. Be calibrated: 50 = ordinary snapshot, 80+ = clear standout, and do NOT give several photos the same score — separate them.
- "heroReady" (true/false): true only if this photo can carry a public profile card. Require ALL of: she is the clear, single subject (not a group shot where it's ambiguous which woman she is); her face is recognisable (not turned away, cropped off, hidden behind sunglasses or heavy shadow); it is in focus and not a screenshot/meme/text overlay/pet-or-scenery-only shot; and it is publishable — no nudity and no underwear-or-less shots.
- "why": at most 12 words on what makes it strong or weak.

Return ONLY minified JSON, no markdown or code fences:
{"photos":[{"i":1,"appeal":<0-100>,"heroReady":<true|false>,"why":"<=12 words>"}]}
Include exactly one entry per photo, with "i" matching the number it was labelled with.`;
}

interface ParsedScore {
  i: number;
  appeal: number;
  heroReady: boolean;
  why: string;
}

/** Parse the vision reply into per-photo scores, keyed by the 1-based photo number. */
function parseScores(raw: string): ParsedScore[] | null {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let p: any;
  try {
    p = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(p?.photos)) return null;
  const out: ParsedScore[] = [];
  for (const e of p.photos as any[]) {
    const i = Number(e?.i);
    const appeal = Number(e?.appeal);
    if (!Number.isFinite(i)) continue;
    out.push({
      i,
      appeal: Number.isFinite(appeal) ? Math.max(0, Math.min(100, Math.round(appeal))) : 0,
      heroReady: e?.heroReady === true,
      why: typeof e?.why === 'string' ? e.why.slice(0, 120) : '',
    });
  }
  return out.length > 0 ? out : null;
}

export interface PickHeroOpts {
  /** Re-rank even when the photo set is unchanged. */
  force?: boolean;
  /** Rank and report without writing anything. */
  dryRun?: boolean;
  /** Skip the DB gender lookup when the caller already knows (verify-step does). */
  knownGender?: string | null;
}

export interface PickHeroResult {
  status: 'picked' | 'unchanged' | 'skipped' | 'no-hero-ready' | 'error';
  /** The hero URL now in force (null when the existing order was left alone). */
  heroUrl?: string | null;
  scores?: HeroPhotoScore[];
  note?: string;
}

/**
 * Rank one woman's uploaded photos and persist the hero pick (plus mirror it to
 * avatar_url, which is what a photo-less read path falls back to for women).
 *
 * Never throws — a vision outage, an unreachable photo or a malformed reply all
 * leave the profile exactly as it was, showing the previous hero.
 */
export async function pickHeroPhoto(userId: string, opts: PickHeroOpts = {}): Promise<PickHeroResult> {
  if (!userId) return { status: 'skipped', note: 'no userId' };

  try {
    const db = getSupabase() as any;

    let gender = opts.knownGender;
    if (gender === undefined) {
      const { data: u } = await db
        .from('verified_vibe_users')
        .select('gender')
        .eq('id', userId)
        .maybeSingle();
      gender = (u as { gender?: string } | null)?.gender ?? null;
    }
    // Men display AI portraits whose lead role is set at generation time.
    if (gender === 'man') return { status: 'skipped', note: 'man — AI portraits carry their own lead' };

    const { data: row } = await db
      .from('user_master_profile')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const data = (row?.data ?? {}) as Record<string, unknown>;

    const photos = (Array.isArray(data.photos) ? data.photos : []) as Array<Record<string, unknown>>;
    const candidates = photos
      .map((p) => (typeof p?.dataUrl === 'string' ? p.dataUrl : typeof p?.url === 'string' ? p.url : null))
      .filter((u): u is string => !!u)
      .slice(0, MAX_PHOTOS);

    // Nothing to choose between: a single photo is the hero by default.
    if (candidates.length < 2) return { status: 'skipped', note: `${candidates.length} photo(s) — nothing to rank` };

    const hash = photoSetHash(photos as Array<{ label?: string; url?: string; dataUrl?: string }>);
    const prev = (data.heroPick ?? null) as HeroPick | null;
    if (!opts.force && prev && prev.photoHash === hash && prev.version === HERO_PICK_VERSION) {
      return { status: 'unchanged', heroUrl: prev.url, scores: prev.scores, note: 'same photo set already ranked' };
    }

    // Resolve the bytes. Only photos we can actually see are ranked, and their
    // position in `images` is what the prompt numbers, so indexes stay aligned.
    const images: Array<{ url: string; media_type: MediaType; data: string }> = [];
    for (const url of candidates) {
      const img = await resolveImage(url);
      if (img) images.push({ url, ...img });
    }
    if (images.length < 2) return { status: 'skipped', note: 'fewer than 2 photos are reachable' };

    const { getClaudeClient, CLAUDE_MODEL } = await import('$lib/claude');
    const client = getClaudeClient();
    const content: any[] = [{ type: 'text', text: buildPrompt(images.length) }];
    images.forEach((im, i) => {
      content.push({ type: 'text', text: `Photo ${i + 1}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } });
    });

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{ role: 'user', content }],
    });
    const block = response.content[0];
    if (!block || block.type !== 'text') return { status: 'error', note: 'no text reply from vision' };

    const parsed = parseScores(block.text);
    if (!parsed) return { status: 'error', note: 'unparseable vision reply' };

    // Map the model's 1-based numbers back onto our image list; a photo it failed to
    // score simply isn't eligible to be promoted.
    const byIndex = new Map(parsed.map((s) => [s.i, s]));
    const scores: HeroPhotoScore[] = images.map((im, i) => {
      const s = byIndex.get(i + 1);
      return {
        url: im.url,
        appeal: s?.appeal ?? 0,
        heroReady: s?.heroReady === true,
        why: s?.why ?? '',
      };
    });

    const winner = chooseHero(scores);
    const pick: HeroPick = {
      url: winner?.url ?? null,
      scores,
      photoHash: hash,
      pickedAt: new Date().toISOString(),
      version: HERO_PICK_VERSION,
      reason: winner ? 'ranked' : 'none-hero-ready',
    };

    if (opts.dryRun) {
      return {
        status: winner ? 'picked' : 'no-hero-ready',
        heroUrl: pick.url,
        scores,
        note: 'dry run — nothing written',
      };
    }

    await db
      .from('user_master_profile')
      .update({ data: { ...data, heroPick: pick }, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    // Keep avatar_url on the hero: it is her displayed thumbnail wherever a reader
    // has no photo array to build from (see pickHeroUrl's woman fallback).
    if (winner) {
      await db.from('verified_vibe_users').update({ avatar_url: winner.url }).eq('id', userId);
    }

    return {
      status: winner ? 'picked' : 'no-hero-ready',
      heroUrl: pick.url,
      scores,
      note: winner ? undefined : 'no photo cleared the hero floor — existing order kept',
    };
  } catch (e) {
    console.warn('[photo-hero] pick failed (non-fatal):', e);
    return { status: 'error', note: e instanceof Error ? e.message : 'unknown error' };
  }
}

export interface HeroBackfillResult {
  total: number;
  picked: number;
  unchanged: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  users: Array<{ userId: string; firstName: string | null } & PickHeroResult>;
}

/**
 * Backfill: rank the photos of every woman already on the platform, whose heroes are
 * currently whatever they uploaded first. One vision call per user with ≥2 photos,
 * hash-guarded so re-running is cheap. dryRun:true reports the ranking without writing.
 */
export async function runHeroPickBackfill(opts: {
  userIds?: string[];
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  includeSeed?: boolean;
} = {}): Promise<HeroBackfillResult> {
  const db = getSupabase() as any;
  const dryRun = opts.dryRun === true;

  let q = db
    .from('verified_vibe_users')
    .select('id, first_name')
    .eq('gender', 'woman')
    .is('deleted_at', null);
  if (!opts.includeSeed) q = q.eq('is_seed', false);
  if (opts.userIds?.length) q = q.in('id', opts.userIds);
  if (opts.limit) q = q.limit(opts.limit);

  const { data: users } = await q;
  const out: HeroBackfillResult['users'] = [];

  for (const u of users ?? []) {
    const res = await pickHeroPhoto(u.id, { force: opts.force, dryRun, knownGender: 'woman' });
    out.push({ userId: u.id, firstName: u.first_name ?? null, ...res });
  }

  return {
    total: out.length,
    picked: out.filter((r) => r.status === 'picked').length,
    unchanged: out.filter((r) => r.status === 'unchanged').length,
    skipped: out.filter((r) => r.status === 'skipped' || r.status === 'no-hero-ready').length,
    failed: out.filter((r) => r.status === 'error').length,
    dryRun,
    users: out,
  };
}
