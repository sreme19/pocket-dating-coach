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
  checkLivenessWithClaude,
  type AnchorPhotoVerdict,
} from '$lib/verified-vibe/server/verification';
import { loadAnchorSelfie } from '$lib/verified-vibe/server/anchor-selfie';

// ── Thresholds ────────────────────────────────────────────────────────────────
// `confidence` from the vision pass is a SAME-PERSON score, 0–100 (see the prompt
// in matchPhotosToAnchorWithClaude: a genuine photo of the owner scores 70+, a
// different person or no person scores below 40). The band between the two is
// genuine uncertainty and must not be read as either answer.

/** At or above → this photo is confirmed to be the owner. */
export const MATCH_CONFIDENCE = 60;
/** Strictly below → this is confidently a DIFFERENT person. */
export const MISMATCH_CONFIDENCE = 40;

export type PhotoGateStatus =
  /** Compared against the anchor selfie; at least one photo is confirmed as the owner. */
  | 'passed'
  /** Compared against the anchor selfie; nothing is the owner AND something is provably not. */
  | 'rejected'
  /**
   * An anchor selfie existed but NO photo could be compared to it (every face was
   * turned away, distant, or obscured) — and nothing was disproven either. Not proof
   * of wrongdoing: the write path asks for a clearer photo, the read path leaves the
   * profile alone.
   */
  | 'unconfirmed'
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
  /** Photos we could not compare to the anchor. Publishable, but never proof of identity. */
  unverifiableIndexes: number[];
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
  /** How many photos were published without being confirmed (no comparable face). */
  unverifiable: number;
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
 * Pure decision step — turns per-photo verdicts into publish / can't-confirm / reject.
 * Split out from the I/O so it can be unit-tested without Claude or Supabase.
 *
 * THE THREE-WAY SPLIT MATTERS. An early version of this only asked "is this
 * confirmed to be the owner?" and removed everything else — which quietly deleted
 * back-turned shots, distant travel photos and heavily filtered photos from real
 * users' galleries ("person is facing away; no face visible" is not evidence of
 * anything). "I cannot tell" is now its own outcome:
 *
 *   - not a real person (poster, celebrity, screenshot, graphic) → REJECT
 *   - a confidently different person                            → REJECT
 *   - a real person whose face can't be compared                → keep, but it
 *     never counts as proof of identity
 *
 * A profile is publishable when at least ONE photo is confirmed to be the owner;
 * the unconfirmable ones then ride along, which is exactly the real-world rule
 * ("prove it's you once, then your artistic shots are fine").
 *
 * @param verdicts - One verdict per candidate photo, in upload order
 * @param hasAnchor - Whether the verdicts were produced against a verified anchor
 *                    selfie (true) or the weaker real-person-only test (false)
 */
export function decidePhotoGate(
  verdicts: AnchorPhotoVerdict[],
  hasAnchor: boolean
): PhotoGateDecision {
  const confirmed: number[] = [];
  const unverifiableIndexes: number[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  verdicts.forEach((v, index) => {
    // Not a person at all — the poster / celebrity / screenshot case. Unambiguous.
    if (!v.isRealPerson) {
      rejected.push({ index, reason: v.reason || NOT_A_PERSON });
      return;
    }
    // Without an anchor we can only confirm "a real person" — publish and mark the
    // whole set unverified rather than guess at identity.
    if (!hasAnchor) {
      unverifiableIndexes.push(index);
      return;
    }
    if (v.sameAsAnchor === true && v.confidence >= MATCH_CONFIDENCE) {
      confirmed.push(index);
      return;
    }
    // Confidently a different person → reject.
    if (v.sameAsAnchor === false && v.confidence < MISMATCH_CONFIDENCE) {
      rejected.push({ index, reason: v.reason || NOT_YOU });
      return;
    }
    // Everything else — no comparable face, or a score in the uncertain band — is
    // "cannot tell". Never delete a real person's photo on a maybe.
    unverifiableIndexes.push(index);
  });

  const acceptedIndexes = [...confirmed, ...unverifiableIndexes].sort((a, b) => a - b);

  // Nothing confirmed, and something provably not the owner → refuse the set.
  if (confirmed.length === 0 && rejected.length > 0) {
    return {
      status: 'rejected',
      acceptedIndexes: [],
      unverifiableIndexes: [],
      rejected: [
        ...rejected,
        ...unverifiableIndexes.map((index) => ({
          index,
          reason: verdicts[index].reason || 'We could not see your face clearly enough to confirm it is you.',
        })),
      ],
      message: hasAnchor
        ? "None of these photos match your verification selfie. Please upload a photo of yourself — the same face you used for your selfie check."
        : "None of these look like a photo of a person. Please upload a clear photo of yourself.",
    };
  }

  // Nothing confirmed but nothing disproven either: real people, no comparable face.
  // Ask for a clearer photo rather than accusing them of anything.
  if (confirmed.length === 0 && hasAnchor) {
    return {
      status: 'unconfirmed',
      acceptedIndexes,
      unverifiableIndexes,
      rejected,
      message:
        "We couldn't see your face clearly enough in these to confirm it's you. Add one photo where your face is clearly visible — after that, photos like these are fine.",
    };
  }

  return {
    status: hasAnchor ? 'passed' : 'unverified',
    acceptedIndexes,
    unverifiableIndexes,
    rejected,
    message:
      rejected.length === 0
        ? ''
        : `We removed ${rejected.length} photo${rejected.length === 1 ? '' : 's'} that ${rejected.length === 1 ? "isn't" : "aren't"} you. Your other photos are unchanged.`,
  };
}

/**
 * Second-opinion pass over the photos the set-level screen called a DIFFERENT PERSON.
 *
 * Removing a real user's photo is the one action here we cannot take back gracefully,
 * and face comparison is exactly where vision models are least reliable — the first
 * pass over the live pool produced four "different person" verdicts on one user whose
 * other photos it confirmed. So a single opinion is never enough to condemn: each
 * flagged photo is re-compared by checkLivenessWithClaude, a DIFFERENT prompt built
 * for one-to-one structural face matching, and the photo survives unless that
 * adjudicator independently agrees it is not the owner.
 *
 * Disagreement (or an adjudication that errors) downgrades the photo to
 * "cannot compare" — kept, but never counted as proof of identity.
 *
 * Pure so it can be tested without Claude.
 *
 * @param verdicts - Verdicts from the set-level screen
 * @param adjudications - index → same-person score 0-100, or null when unavailable
 */
export function applyAdjudication(
  verdicts: AnchorPhotoVerdict[],
  adjudications: Map<number, number | null>
): AnchorPhotoVerdict[] {
  return verdicts.map((v, i) => {
    if (v.sameAsAnchor !== false) return v;
    const score = adjudications.get(i);
    // No second opinion available → do not condemn on one.
    if (score == null) {
      return { ...v, sameAsAnchor: null, reason: v.reason || 'We could not confirm this is you.' };
    }
    // Both passes agree it is somebody else.
    if (score < MISMATCH_CONFIDENCE) return { ...v, confidence: Math.min(v.confidence, score) };
    // The adjudicator is not convinced → treat as unconfirmable, not as an impostor.
    return { ...v, sameAsAnchor: null, confidence: score, reason: 'We could not confirm this is you.' };
  });
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
    // Nothing was compared, so nothing is confirmed — the whole set is unproven.
    unverifiableIndexes: allIndexes,
    rejected: [],
    message,
  });

  if (!photoIdentityGateEnabled()) return passthrough('off');
  if (photos.length === 0) return passthrough('error');

  const anchor = userId ? await loadAnchorSelfie(userId) : null;

  try {
    if (anchor) {
      const verdicts = await matchPhotosToAnchorWithClaude(anchor, photos);

      // Anything called a different person gets a second, independent opinion before
      // we act on it (see applyAdjudication). Only the flagged photos cost a call.
      const flagged = verdicts
        .map((v, i) => (v.sameAsAnchor === false ? i : -1))
        .filter((i) => i >= 0);
      if (flagged.length === 0) return decidePhotoGate(verdicts, true);

      const adjudications = new Map<number, number | null>(
        await Promise.all(
          flagged.map(async (i): Promise<[number, number | null]> => {
            try {
              const r = await checkLivenessWithClaude(anchor, photos[i].data, photos[i].mime);
              return [i, r.confidence];
            } catch (e) {
              console.warn(`[photo-identity-gate] adjudication failed for photo ${i}:`, e);
              return [i, null];
            }
          })
        )
      );
      return decidePhotoGate(applyAdjudication(verdicts, adjudications), true);
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
    unverifiable: decision.unverifiableIndexes.length,
    rejectedIndexes: decision.rejected.map((r) => r.index),
    checkedAt,
  };
}
