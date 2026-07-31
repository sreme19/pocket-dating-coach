/**
 * Re-screen ALREADY-PUBLISHED profile photos against the owner's verification selfie.
 *
 * The identity gate in verify-step only protects photos uploaded from now on. Every
 * profile created before it existed was published unscreened, which is how a card
 * ended up showing a religious poster instead of its owner. This task walks existing
 * users, re-runs the same gate over their stored photos, and repairs the profile:
 *
 *  - photos that are NOT the verified owner are moved out of `data.photos` into
 *    `data.rejectedPhotos` (kept for audit / appeal, never displayed)
 *  - `avatar_url` is cleared when it pointed at a rejected photo
 *  - the photos verification step records `identityGate.status`, so the read gate in
 *    the discovery feed hides the profile until a real photo is uploaded
 *
 * Removing the photo from `data.photos` is the important half: all four read paths
 * (feed, match-profile, public-profile, SSR profile page) build their photo set from
 * that array via buildPublicPhotos, so a rejected photo disappears everywhere at once
 * instead of each reader needing to know about the verdict.
 *
 * MEN are skipped: what a man displays is an AI portrait generated from his uploads,
 * his raw photos are never public, and those portraits are — by design — not going to
 * "match a selfie" the way a real photo does.
 *
 * Idempotent, and dry-run capable (dryRun:true reports without writing).
 */

import { getSupabase } from './supabase';
import { screenProfilePhotos, gateRecord, type PhotoGateStatus } from './photo-identity-gate';
import { refreshPoolEntry, POOL_STATUS_PHOTO_REVIEW } from './pool-registry';

/** Max photos screened per user (one vision call), matching the display cap. */
const MAX_PHOTOS = 6;

export interface RescreenUserResult {
  userId: string;
  firstName: string | null;
  status: PhotoGateStatus | 'skipped';
  checked: number;
  kept: number;
  removed: number;
  /** Kept but never confirmed as the owner (no comparable face in the shot). */
  unconfirmed: number;
  reasons: string[];
  /** True when this user's stored profile was actually changed. */
  repaired: boolean;
  note?: string;
}

export interface RescreenResult {
  total: number;
  repaired: number;
  rejected: number;
  dryRun: boolean;
  users: RescreenUserResult[];
}

/** Fetch a hosted photo and return base64 + mime, or null if unreachable. */
async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString('base64'), mime: mime === 'image/jpg' ? 'image/jpeg' : mime };
  } catch {
    return null;
  }
}

export async function runPhotoRescreen(opts: {
  userIds?: string[];
  limit?: number;
  dryRun?: boolean;
  /** Re-screen even users already carrying an identityGate verdict. */
  force?: boolean;
} = {}): Promise<RescreenResult> {
  const db = getSupabase() as any;
  const dryRun = opts.dryRun === true;

  let q = db
    .from('verified_vibe_users')
    .select('id, first_name, gender, avatar_url')
    .eq('gender', 'woman')          // men display AI portraits, not their uploads
    .eq('is_seed', false)
    .is('deleted_at', null);
  if (opts.userIds?.length) q = q.in('id', opts.userIds);
  if (opts.limit) q = q.limit(opts.limit);

  const { data: users } = await q;
  const results: RescreenUserResult[] = [];

  for (const u of users ?? []) {
    const base: RescreenUserResult = {
      userId: u.id,
      firstName: u.first_name ?? null,
      status: 'skipped',
      checked: 0,
      kept: 0,
      removed: 0,
      unconfirmed: 0,
      reasons: [],
      repaired: false,
    };

    const { data: masterRow } = await db
      .from('user_master_profile')
      .select('data')
      .eq('user_id', u.id)
      .maybeSingle();
    const masterData: Record<string, any> = (masterRow?.data as any) ?? {};
    const photos: Array<Record<string, any>> = Array.isArray(masterData.photos) ? masterData.photos : [];

    const { data: stepRow } = await db
      .from('verified_vibe_verification')
      .select('id, data')
      .eq('user_id', u.id)
      .eq('step', 'photos')
      .maybeSingle();

    // Candidates = the master-profile photo list, PLUS avatar_url when it isn't
    // already in that list. A legacy profile can carry a displayed avatar with an
    // EMPTY photos array (pickHeroUrl falls back to avatar_url for women), so
    // screening only `data.photos` would skip the one image such a profile actually
    // shows. `photoIndex: null` marks the avatar-only candidate — it must never be
    // written back into data.photos, only cleared off the user row.
    const photoUrl = (p: Record<string, any>): string | null =>
      typeof p?.dataUrl === 'string' ? p.dataUrl : typeof p?.url === 'string' ? p.url : null;

    // Screening window. Every client caps a woman at 6 photos, so this normally
    // covers the whole set; if a legacy row somehow holds more, say so rather than
    // let the extras look screened.
    const slice = photos.slice(0, MAX_PHOTOS);
    const unscreenedTail = photos.length - slice.length;

    const candidates: Array<{ url: string; photoIndex: number | null }> = [];
    slice.forEach((p, i) => {
      const url = photoUrl(p);
      if (url) candidates.push({ url, photoIndex: i });
    });
    const avatarUrl = typeof u.avatar_url === 'string' ? u.avatar_url : null;
    if (avatarUrl && !candidates.some((c) => c.url === avatarUrl)) {
      candidates.push({ url: avatarUrl, photoIndex: null });
    }

    if (candidates.length === 0) {
      results.push({ ...base, note: 'no stored photos' });
      continue;
    }
    const priorGate = (stepRow?.data as any)?.identityGate;

    // NEVER re-litigate photos the gate itself approved at upload time — not even
    // under force. This is a hard rule, learned the expensive way: a user whose
    // fake photos had been removed did exactly what we asked, uploaded two real
    // photos, had them individually accepted by the gate on upload... and a forced
    // re-run then deleted them, because the same vision comparison came back
    // differently on a second look. Removing what we already approved is worse
    // than leaving an uncertain photo up. This task's job is legacy profiles that
    // were published BEFORE the gate existed; anything the gate has passed
    // judgement on belongs to human review, not to another model roll.
    if (priorGate?.clearedBy === 'profile-photo-upload') {
      results.push({ ...base, note: 'photos were approved by the gate on upload — human review only' });
      continue;
    }
    if (!opts.force && priorGate?.status) {
      results.push({ ...base, note: 'already screened (pass force to redo)' });
      continue;
    }

    const fetched = await Promise.all(candidates.map((c) => fetchAsBase64(c.url)));
    const screenable = fetched
      .map((f, k) => (f ? { f, i: candidates[k].photoIndex, url: candidates[k].url } : null))
      .filter((x): x is { f: { data: string; mime: string }; i: number | null; url: string } => x !== null);

    if (screenable.length === 0) {
      results.push({ ...base, note: 'photos unreachable' });
      continue;
    }

    const decision = await screenProfilePhotos(u.id, screenable.map((s) => s.f));
    // Map the decision's positions back onto `photos` indexes (null = the avatar-only
    // candidate, which has no slot in the photos array).
    const acceptedPhotoIdx = new Set(
      decision.acceptedIndexes.map((k) => screenable[k].i).filter((i): i is number => i !== null)
    );
    const rejectedReasons = decision.rejected.map(
      (r) => `${screenable[r.index].i === null ? 'avatar' : `#${screenable[r.index].i}`}: ${r.reason}`
    );
    const unconfirmedCount = decision.unverifiableIndexes.length;

    base.status = decision.status;
    base.checked = screenable.length;
    base.kept = acceptedPhotoIdx.size;
    base.removed = decision.rejected.length;
    base.unconfirmed = unconfirmedCount;
    base.reasons = rejectedReasons;
    if (unscreenedTail > 0) {
      base.note = `${unscreenedTail} photo(s) beyond the ${MAX_PHOTOS}-photo window were not screened`;
    }

    // Only an authoritative verdict may strip photos:
    //  - 'passed'      → at least one photo IS the owner; any rejects are safe to remove
    //  - 'rejected'    → nothing here was publishable at all
    //  - 'unconfirmed' → an anchor selfie exists, so a rejection here still rests on
    //    it: either the photo is not a human, or two independent passes agreed it is
    //    someone else. What 'unconfirmed' actually means is "no photo POSITIVELY
    //    confirmed the owner", which doesn't weaken those verdicts. It only became
    //    strippable when the gate stopped refusing faceless sets — before that, an
    //    'unconfirmed' decision could never carry a rejection.
    // 'unverified' (no anchor selfie), 'error' and 'off' still leave the profile
    // exactly as it is. Retro-actively deleting a real user's gallery on "I can't
    // tell" would be worse than the problem being fixed. The unconfirmable photos
    // themselves are never stripped on any path — they are never in `rejected`.
    const authoritative =
      decision.status === 'passed' ||
      decision.status === 'rejected' ||
      decision.status === 'unconfirmed';
    if (!authoritative || decision.rejected.length === 0) {
      if (!dryRun && authoritative && stepRow?.id) {
        await db
          .from('verified_vibe_verification')
          .update({ data: { ...(stepRow.data ?? {}), identityGate: gateRecord(decision, new Date().toISOString()) } })
          .eq('id', stepRow.id);
      }
      results.push({
        ...base,
        note: authoritative
          ? 'all photos are the owner or unconfirmable — nothing removed'
          : `left alone (${decision.status})`,
      });
      continue;
    }

    // Rejected photos: out of `photos`, into `rejectedPhotos` for the audit trail.
    // Only photos we actually screened AND rejected are removed. A photo we couldn't
    // download is left alone (unreachable ≠ mismatched), and anything past the
    // screening window is left alone too rather than being silently condemned.
    const rejectedPhotoIdx = new Set(
      decision.rejected.map((r) => screenable[r.index].i).filter((i): i is number => i !== null)
    );
    const keptPhotos = photos.filter((_, i) => !rejectedPhotoIdx.has(i));
    const removedPhotos = photos.filter((_, i) => rejectedPhotoIdx.has(i));
    // Every rejected URL, including the avatar-only candidate that has no photos slot.
    const rejectedUrls = new Set(decision.rejected.map((r) => screenable[r.index].url));
    const reasonByUrl = new Map(decision.rejected.map((r) => [screenable[r.index].url, r.reason]));
    const clearAvatar = typeof u.avatar_url === 'string' && rejectedUrls.has(u.avatar_url);

    base.repaired = true;

    if (!dryRun) {
      await db
        .from('user_master_profile')
        .update({
          data: {
            ...masterData,
            photos: keptPhotos,
            rejectedPhotos: [
              ...(Array.isArray(masterData.rejectedPhotos) ? masterData.rejectedPhotos : []),
              // Reason looked up BY URL: the rejected list can include the avatar-only
              // candidate, so positional pairing would attach the wrong explanation.
              ...removedPhotos.map((p) => ({
                ...p,
                rejectedAt: new Date().toISOString(),
                reason: reasonByUrl.get(String(photoUrl(p) ?? '')) ?? 'does not match verification selfie',
              })),
            ],
          },
        })
        .eq('user_id', u.id);

      if (clearAvatar) {
        // Promote a surviving photo to the avatar, else leave the profile photo-less
        // (the read gate then hides the card until a real photo is uploaded).
        const nextAvatar =
          keptPhotos.find((p) => p?.label === 'lead')?.dataUrl ?? keptPhotos[0]?.dataUrl ?? null;
        await db.from('verified_vibe_users').update({ avatar_url: nextAvatar ?? null }).eq('id', u.id);
      }

      if (stepRow?.id) {
        await db
          .from('verified_vibe_verification')
          .update({
            data: {
              ...(stepRow.data ?? {}),
              photoCount: keptPhotos.length,
              identityGate: gateRecord(decision, new Date().toISOString()),
            },
          })
          .eq('id', stepRow.id);
      }

      // Keep the distilled pool entry in step with the repaired photo set.
      await refreshPoolEntry(u.id).catch(() => {});

      // ...but a profile with NOTHING left that is its owner must not be served to
      // anyone. refreshPoolEntry force-sets availability_status='active', so this has
      // to come after it. Every matcher selects on 'active', so this is what actually
      // takes the profile out of matching — hiding it from Discover is not enough on
      // its own, since the nightly matcher would otherwise still pair it with someone.
      if (decision.status === 'rejected') {
        const { error: poolErr } = await db
          .from('vv_pool_profiles')
          .update({ availability_status: POOL_STATUS_PHOTO_REVIEW, last_updated: new Date().toISOString() })
          .eq('user_id', u.id);
        // Never let this abort the repair — the photos are already stripped, and a
        // silently-swallowed failure here is exactly how soft-deleted users stayed
        // matchable before migration 20260719141219. Surfaced in the result instead.
        if (poolErr) {
          console.error(`[photo-rescreen] could not pause pool entry for ${u.id}:`, poolErr);
          base.note = `PHOTOS STRIPPED BUT STILL MATCHABLE — pool update failed: ${poolErr.message ?? poolErr}`;
        }
      }
    }

    results.push(base);
  }

  return {
    total: results.length,
    repaired: results.filter((r) => r.repaired).length,
    rejected: results.filter((r) => r.status === 'rejected').length,
    dryRun,
    users: results,
  };
}
