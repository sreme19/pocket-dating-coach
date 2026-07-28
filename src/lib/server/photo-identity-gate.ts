/**
 * Profile-photo identity gate — "the pictures on a profile must be the profile owner".
 *
 * THE HOLE THIS CLOSES
 * Onboarding proves a live face exactly once: the liveness step stores an anchor
 * selfie (see anchor-selfie.ts) and that face IS the verified user. But the photos
 * step used to accept whatever images were uploaded — the only check
 * (checkPhotoConsistencyWithClaude) compared the uploads to EACH OTHER, needed ≥2
 * of them, and was explicitly non-blocking. So a user could clear liveness with a
 * real selfie and then publish a religious poster, a celebrity, or a screenshot as
 * their profile card, and Discover would happily show it: the feed only checked
 * that a `photos` verification row EXISTED.
 *
 * WHAT THIS DOES
 * Every candidate profile photo is compared against the anchor selfie in one Claude
 * Vision call. A photo is only publishable when it is (a) a real photograph of a
 * real person and (b) that person is the verified owner, at/above MATCH_CONFIDENCE.
 * Anything else is rejected with a user-facing reason. The caller (verify-step) then
 * stores ONLY the accepted photos and refuses the step outright when none pass, so a
 * mismatched photo never reaches Storage, the avatar, or the feed.
 *
 * FAILURE POSTURE
 *  - No anchor selfie yet (liveness skipped) → we cannot prove identity, so we fall
 *    back to the weaker "is this a real person at all" test, which still rejects the
 *    poster/screenshot case that motivated this gate. Status: 'unverified'.
 *  - Claude/infra error → 'error': fail OPEN so an API blip can't block onboarding,
 *    but the status is recorded so the rescreen task can revisit it. Failing open is
 *    what created the original hole, so 'error' is deliberately NOT the same as
 *    'passed' — read paths can treat it as unproven, and it is never 'rejected'.
 *  - Kill switch: PHOTO_IDENTITY_GATE='false' disables enforcement (status 'off').
 */

import { env } from '$env/dynamic/private';
import {
  matchPhotosToAnchorWithClaude,
  detectFaceInPhotosWithClaude,
  type AnchorPhotoVerdict,
} from '$lib/verified-vibe/server/verification';
import { loadAnchorSelfie } from '$lib/verified-vibe/server/anchor-selfie';

/** Minimum same-person confidence for a photo to be publishable. */
export const MATCH_CONFIDENCE = 60;

export type PhotoGateStatus =
  /** Compared against the anchor selfie; at least one photo is the verified owner. */
  | 'passed'
  /** Compared against the anchor selfie; NOTHING publishable. The step must be refused. */
  | 'rejected'
  /** No anchor selfie to compare against — only the weaker real-person test ran. */
  | 'unverified'
  /** The vision check could not run (API/infra). Failed open; not proof of anything. */
  | 'error'
  /** Kill switch off. */
  | 'off';

export interface PhotoGateDecision {
  status: PhotoGateStatus;
  /** Indexes (into the input array) of photos that may be published. */
  acceptedIndexes: number[];
  /** Rejected photos with a user-facing reason each. */
  rejected: Array<{ index: number; reason: string }>;
  /** One short message summarising the outcome, safe to show the user. */
  message: string;
}

/** Persisted alongside the photos verification step for auditing + read gating. */
export interface PhotoGateRecord {
  status: PhotoGateStatus;
  checked: number;
  accepted: number;
  rejectedIndexes: number[];
  checkedAt: string;
}

/** Enforcement is ON by default; PHOTO_IDENTITY_GATE='false' turns it off. */
export function photoIdentityGateEnabled(): boolean {
  return env.PHOTO_IDENTITY_GATE !== 'false';
}

const NOT_A_PERSON = 'This photo is not a photo of you.';
const NOT_YOU = "This photo doesn't match your verification selfie.";

/**
 * Pure decision step — turns per-photo verdicts into accept/reject.
 * Split out from the I/O so it can be unit-tested without Claude or Supabase.
 *
 * @param verdicts - One verdict per candidate photo, in upload order
 * @param hasAnchor - Whether the verdicts were produced against a verified anchor
 *                    selfie (true) or the weaker real-person-only test (false)
 */
export function decidePhotoGate(
  verdicts: AnchorPhotoVerdict[],
  hasAnchor: boolean
): PhotoGateDecision {
  const acceptedIndexes: number[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  verdicts.forEach((v, index) => {
    if (!v.isRealPerson) {
      rejected.push({ index, reason: v.reason || NOT_A_PERSON });
      return;
    }
    // Without an anchor we can only confirm "a real person" — accept and mark the
    // whole set unverified rather than guess at identity.
    if (!hasAnchor) {
      acceptedIndexes.push(index);
      return;
    }
    if (v.sameAsAnchor !== true || v.confidence < MATCH_CONFIDENCE) {
      rejected.push({ index, reason: v.reason || NOT_YOU });
      return;
    }
    acceptedIndexes.push(index);
  });

  if (acceptedIndexes.length === 0) {
    return {
      status: 'rejected',
      acceptedIndexes,
      rejected,
      message: hasAnchor
        ? "None of these photos match your verification selfie. Please upload a photo of yourself — the same face you used for your selfie check."
        : "None of these look like a photo of a person. Please upload a clear photo of yourself.",
    };
  }

  return {
    status: hasAnchor ? 'passed' : 'unverified',
    acceptedIndexes,
    rejected,
    message:
      rejected.length === 0
        ? ''
        : `We kept ${acceptedIndexes.length} photo${acceptedIndexes.length === 1 ? '' : 's'} and removed ${rejected.length} that ${rejected.length === 1 ? "doesn't" : "don't"} match your verification selfie.`,
  };
}

/**
 * Screen a user's candidate profile photos against their verified anchor selfie.
 *
 * @param userId - Owner of the photos (null → nothing to compare against)
 * @param photos - Candidates as { data: base64 (no data: prefix), mime }
 */
export async function screenProfilePhotos(
  userId: string | null,
  photos: Array<{ data: string; mime: string }>
): Promise<PhotoGateDecision> {
  const allIndexes = photos.map((_, i) => i);
  const passthrough = (status: PhotoGateStatus, message = ''): PhotoGateDecision => ({
    status,
    acceptedIndexes: allIndexes,
    rejected: [],
    message,
  });

  if (!photoIdentityGateEnabled()) return passthrough('off');
  if (photos.length === 0) return passthrough('error');

  const anchor = userId ? await loadAnchorSelfie(userId) : null;

  try {
    if (anchor) {
      const verdicts = await matchPhotosToAnchorWithClaude(anchor, photos);
      return decidePhotoGate(verdicts, true);
    }

    // No verified face on file — fall back to "is there a real person here at all".
    const { faces } = await detectFaceInPhotosWithClaude(photos);
    const verdicts: AnchorPhotoVerdict[] = photos.map((_, i) => ({
      isRealPerson: faces[i] === true,
      sameAsAnchor: null,
      confidence: 0,
      reason: faces[i] === true ? '' : NOT_A_PERSON,
    }));
    return decidePhotoGate(verdicts, false);
  } catch (e) {
    // Fail OPEN on infra failure (see FAILURE POSTURE above) but never call it a pass.
    console.warn('[photo-identity-gate] screening failed (fail-open, status=error):', e);
    return passthrough('error');
  }
}

/** Build the record persisted on the photos verification step. */
export function gateRecord(decision: PhotoGateDecision, checkedAt: string): PhotoGateRecord {
  return {
    status: decision.status,
    checked: decision.acceptedIndexes.length + decision.rejected.length,
    accepted: decision.acceptedIndexes.length,
    rejectedIndexes: decision.rejected.map((r) => r.index),
    checkedAt,
  };
}
