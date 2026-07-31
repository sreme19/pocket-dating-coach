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
/** No-anchor path only: this photo shows a different person from the rest of the set. */
const NOT_THE_SAME_PERSON = "This photo shows someone other than the person in your other photos.";
/** No-anchor path only: no face to cross-check, and no verified selfie to fall back on. */
const NO_FACE_TO_CROSS_CHECK =
  'We need to see your face in this photo to confirm it is you. Finish the selfie check to post photos like this.';

/** "We removed 2 photos that aren't you." — only ever said about dropped photos. */
function removalNote(count: number): string {
  if (count === 0) return '';
  return `We removed ${count} photo${count === 1 ? '' : 's'} that ${count === 1 ? "isn't" : "aren't"} you. Your other photos are unchanged.`;
}

/**
 * Pure decision step — turns per-photo verdicts into publish / can't-confirm / reject.
 * Split out from the I/O so it can be unit-tested without Claude or Supabase.
 *
 * THE POLICY, AND WHY IT SPLITS ON THE SELFIE CHECK. What we can prove about a
 * photo depends entirely on whether there is a verified face on file, so the two
 * paths deliberately trade places on who gets the benefit of the doubt:
 *
 * WITH an anchor selfie (they finished the selfie check) — identity is already
 * proven once, so faceless photos are a feature, not a risk:
 *   - not a real human (poster, celebrity, screenshot, graphic, pet) → REJECT
 *   - a confidently different person                                → REJECT
 *   - anything else, INCLUDING no comparable face at all            → keep
 * A back-turned shot, a distant travel photo, a hands-and-bouquet shot are all
 * fine here: "prove it's you once, then your artistic shots are fine". This
 * publishes even when NOTHING in the batch could be matched — the status stays
 * 'unconfirmed' so the read path and the rescreen task can still tell the
 * difference, but it is never a reason to refuse the upload.
 *
 * WITHOUT an anchor selfie — there is no verified face, so the only identity
 * signal is whether the uploads agree with EACH OTHER. screenProfilePhotos
 * clusters them and writes the answer into `sameAsAnchor` (true = in the
 * cluster). Here a face is mandatory:
 *   - not a real human                          → REJECT
 *   - a different person from the rest of the set → REJECT
 *   - no comparable face to cross-check against   → REJECT
 *   - agrees with the rest of the set             → keep, still never proof
 * This is the stricter side on purpose: the faceless-photo grace above is
 * earned by doing the selfie check.
 *
 * Either way the set is only REFUSED outright when nothing at all survives.
 * A single bad photo among good ones never costs the user the good ones.
 *
 * @param verdicts - One verdict per candidate photo, in upload order
 * @param hasAnchor - Whether the verdicts were produced against a verified anchor
 *                    selfie (true) or against the rest of the set (false)
 */
export function decidePhotoGate(
  verdicts: AnchorPhotoVerdict[],
  hasAnchor: boolean
): PhotoGateDecision {
  const confirmed: number[] = [];
  const unverifiableIndexes: number[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];

  verdicts.forEach((v, index) => {
    // Not a person at all — the poster / celebrity / screenshot case. Unambiguous,
    // and the one rejection that applies on BOTH paths.
    if (!v.isRealPerson) {
      rejected.push({ index, reason: v.reason || NOT_A_PERSON });
      return;
    }

    if (!hasAnchor) {
      // Outlier: a real person, but not the person in the rest of the photos.
      if (v.sameAsAnchor === false) {
        rejected.push({ index, reason: v.reason || NOT_THE_SAME_PERSON });
        return;
      }
      // No face to cross-check and no verified selfie to fall back on, so this
      // photo has nothing tying it to the account. Ask for the selfie check.
      if (v.sameAsAnchor === null) {
        rejected.push({ index, reason: v.reason || NO_FACE_TO_CROSS_CHECK });
        return;
      }
      // In the cluster — publishable, but consistency is not identity.
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

  // Only refuse when there is nothing left to publish. Anything that survived is
  // worth keeping, even if the batch also contained a poster or an impostor.
  if (acceptedIndexes.length === 0) {
    return {
      status: 'rejected',
      acceptedIndexes: [],
      unverifiableIndexes: [],
      rejected,
      message: hasAnchor
        ? 'None of these photos match your verification selfie. Please upload a photo of yourself — the same face you used for your selfie check.'
        : 'None of these look like a clear photo of you. Please upload photos of yourself with your face visible.',
    };
  }

  if (!hasAnchor) {
    return {
      status: 'unverified',
      acceptedIndexes,
      unverifiableIndexes,
      rejected,
      message: removalNote(rejected.length),
    };
  }

  // Verified owner, but nothing in this batch could be matched to the selfie. The
  // photos go live regardless (rule: a proven owner may post faceless photos) —
  // this is a nudge, not a refusal.
  if (confirmed.length === 0) {
    const nudge =
      "We couldn't match your face in these to your selfie check, so they're posted as-is. Adding one photo where your face is clearly visible helps people trust your profile.";
    return {
      status: 'unconfirmed',
      acceptedIndexes,
      unverifiableIndexes,
      rejected,
      message: rejected.length === 0 ? nudge : `${removalNote(rejected.length)} ${nudge}`,
    };
  }

  return {
    status: 'passed',
    acceptedIndexes,
    unverifiableIndexes,
    rejected,
    message: removalNote(rejected.length),
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
 * detectFaceInPhotosWithClaude answers one question — "is there a clearly
 * identifiable real human face here" — and a `false` covers both "not a human"
 * (poster, pet, landscape) and "a human whose face is too small or obscured to
 * identify". On the no-anchor path both are rejections, so the conflation costs
 * us nothing in the decision; it only means the reason has to be true of both.
 */
const NO_CLEAR_FACE = "We couldn't see a clear photo of a person's face here.";

/**
 * Turn a face sweep plus one round of same-person comparisons into per-photo
 * verdicts for the no-anchor path. Pure, so the clustering rule is testable
 * without Claude.
 *
 * `sameAsAnchor` means "in the cluster" here, not "is the verified owner" —
 * there is no verified owner on this path.
 *
 * @param faces - Per photo: a clearly identifiable real human face was found
 * @param reference - Index of the photo whose face defines the cluster (null → none)
 * @param compared - Index → verdict from comparing that photo against the reference
 */
export function clusterVerdicts(
  faces: boolean[],
  reference: number | null,
  compared: Map<number, AnchorPhotoVerdict>
): AnchorPhotoVerdict[] {
  return faces.map((hasFace, i) => {
    if (hasFace !== true) {
      return { isRealPerson: false, sameAsAnchor: null, confidence: 0, reason: NO_CLEAR_FACE };
    }
    // The reference face is the cluster by definition.
    if (i === reference) {
      return { isRealPerson: true, sameAsAnchor: true, confidence: 100, reason: '' };
    }
    const v = compared.get(i);
    // A face we could not get a comparison for (short/failed vision response).
    // Fail open — it has a real face, and a missing answer is not evidence.
    if (!v) return { isRealPerson: true, sameAsAnchor: true, confidence: 0, reason: '' };
    // An inconclusive score is not "a different person" — keep it in the cluster
    // rather than deleting a real user's photo on a maybe.
    if (v.sameAsAnchor === false && v.confidence >= MISMATCH_CONFIDENCE) {
      return { ...v, sameAsAnchor: true, reason: '' };
    }
    if (v.sameAsAnchor === null) {
      return { ...v, sameAsAnchor: true, reason: '' };
    }
    return v;
  });
}

/**
 * Which face should define "the rest of the set"? Comparing everything to
 * whichever photo happened to be uploaded first is wrong when that photo is
 * itself the odd one out — a set of five photos of Alice plus one of Bob must
 * drop Bob, not the five. So: flip to the opposing camp when it is strictly
 * larger than the reference's own.
 *
 * @param agreeCount - Photos that matched the current reference (excluding it)
 * @param differIndexes - Photos confidently NOT the current reference
 * @returns The index to re-run against, or null to keep the current reference
 */
export function shouldReanchor(agreeCount: number, differIndexes: number[]): number | null {
  return differIndexes.length > agreeCount + 1 ? differIndexes[0] : null;
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

    // ── No verified face on file ────────────────────────────────────────────────
    // We cannot ask "is this the owner", so we ask the next best thing: "is this
    // the same person as the rest of these photos". A real face is required, and
    // the odd one out is dropped. See decidePhotoGate for why this path is the
    // stricter of the two.
    const { faces } = await detectFaceInPhotosWithClaude(photos);
    const faceIndexes = photos.map((_, i) => i).filter((i) => faces[i] === true);

    // Fewer than two faces: there is no "rest of the set" to cross-check against,
    // so the lone face defines the cluster on its own.
    if (faceIndexes.length < 2) {
      return decidePhotoGate(clusterVerdicts(faces, faceIndexes[0] ?? null, new Map()), false);
    }

    /** Compare every other face against one photo's face. */
    const compareAgainst = async (ref: number) => {
      const others = faceIndexes.filter((i) => i !== ref);
      const verdicts = await matchPhotosToAnchorWithClaude(
        photos[ref].data,
        others.map((i) => photos[i]),
        photos[ref].mime
      );
      const byIndex = new Map<number, AnchorPhotoVerdict>();
      others.forEach((original, i) => {
        if (verdicts[i]) byIndex.set(original, verdicts[i]);
      });
      const differ = others.filter((i) => {
        const v = byIndex.get(i);
        return v?.sameAsAnchor === false && v.confidence < MISMATCH_CONFIDENCE;
      });
      const agree = others.filter((i) => byIndex.get(i)?.sameAsAnchor === true).length;
      return { byIndex, differ, agree };
    };

    let ref = faceIndexes[0];
    let pass = await compareAgainst(ref);

    // The first photo may itself be the impostor — re-run from the larger camp.
    const reanchor = shouldReanchor(pass.agree, pass.differ);
    if (reanchor !== null) {
      ref = reanchor;
      pass = await compareAgainst(ref);
    }

    return decidePhotoGate(clusterVerdicts(faces, ref, pass.byIndex), false);
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
