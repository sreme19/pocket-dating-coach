import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import {
  extractIDWithClaude,
  checkLivenessWithClaude,
  checkSelfieLivenessWithClaude,
  checkPhotoConsistencyWithClaude,
  analyzeSpendingPatternWithClaude,
  evaluateQAResponsesWithClaude,
  claudeErrorResponse
} from '$lib/verified-vibe/server/verification';
import { enrollInPoolIfVerified } from '$lib/server/pool-registry';
import { recomputeAndNormalize } from '$lib/server/trust-normalize';
import { scheduleVectorRebuild } from '$lib/server/vector-rebuild';
import { storeAnchorSelfie, loadAnchorSelfie } from '$lib/verified-vibe/server/anchor-selfie';

/**
 * POST /api/verified-vibe/verify-step
 *
 * Process a verification step. Handles:
 * - Step 1: ID extraction
 * - Step 2: Liveness check
 * - Step 3: Photo consistency check and storage
 * - Step 4: Spending verification (men) or Q&A verification (women)
 *
 * Request body:
 * {
 *   step: 'photos' | 'spending_or_qa',
 *   data: {
 *     // For photos:
 *     images: string[] (base64-encoded images),
 *     mimeTypes: string[],
 *     labels: Record<string, string> (photo labels)
 *     
 *     // For spending (men):
 *     spendingImage: string (base64-encoded image),
 *     mimeType: string
 *     
 *     // For Q&A (women):
 *     responses: Record<string, string>,
 *     gender: 'man' | 'woman' | 'prefer_not_to_say'
 *   }
 * }
 *
 * Response:
 * {
 *   status: 'completed',
 *   data: {
 *     // Step-specific response data
 *   },
 *   trustPoints: number
 * }
 */
/** Resolve the authenticated user ID from the Authorization bearer token */
async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  // Use a per-request client with the user's JWT so RLS applies correctly
  const anonClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user } } = await anonClient.auth.getUser();
  return user?.id ?? null;
}

/**
 * Merge fields into user_master_profile (upsert). Best-effort — never throws.
 * Used by verify-step handlers to keep master profile in sync without a
 * separate mobile round-trip.
 */
async function updateMasterProfile(userId: string, fields: Record<string, unknown>): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data: existing } = await (supabase as any)
      .from('user_master_profile')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const prev = (existing?.data as Record<string, unknown>) ?? {};
    const merged = { ...prev, ...fields };
    const { error } = await (supabase as any)
      .from('user_master_profile')
      .upsert(
        { user_id: userId, data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.warn('[verify-step] master-profile update failed:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[verify-step] master-profile update failed:', e);
    return false;
  }
}

/** Save a completed step to Supabase (best-effort; does not fail the request) */
async function persistVerificationStep(
  userId: string,
  step: string,
  trustPoints: number,
  data?: Record<string, unknown>,
  status: string = 'completed'
): Promise<void> {
  try {
    const supabase = getSupabase();
    await (supabase as any)
      .from('verified_vibe_verification')
      .upsert(
        { user_id: userId, step, status, data: data ?? null, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,step' }
      );
    // Recompute + normalize trust score after every verification step
    recomputeAndNormalize(userId).catch((e) => console.warn('trust recompute failed (non-fatal):', e));
    // Live vector propagation (§11g): proofs change confidence → rebuild vectors.
    scheduleVectorRebuild(userId);
  } catch (e) {
    console.error('persistVerificationStep error (non-fatal):', e);
  }
}

// Minimum liveness confidence to award identity trust. Below this the selfie is
// stored for manual review and earns 0 points. The server is the source of truth:
// it stamps `underReview` into the step data so the client shows matching messaging
// (see handleLivenessVerification) instead of re-deriving a threshold of its own.
const LIVENESS_MIN_CONFIDENCE = 75;

/** Fetch the user's current verification row for a step (status + data), or null. */
async function getStepRow(userId: string, step: string): Promise<{ status?: string; data?: any } | null> {
  try {
    const supabase = getSupabase();
    const { data } = await (supabase as any)
      .from('verified_vibe_verification')
      .select('status, data')
      .eq('user_id', userId)
      .eq('step', step)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Promote a PENDING government-ID row to face-verified once the live-selfie step
 * has both proven genuineness AND matched the ID photo. Preserves the extracted
 * name so gated categories (spending/wealth/assets) can still name-match it.
 */
async function finalizeIdFaceVerified(userId: string): Promise<void> {
  try {
    const existing = await getStepRow(userId, 'id');
    const prev = (existing?.data as Record<string, unknown>) ?? {};
    await persistVerificationStep(
      userId,
      'id',
      getTrustPoints('id'),
      { ...prev, faceVerified: true, faceMatch: true },
      'completed'
    );
  } catch (e) {
    console.warn('[verify-step] finalize id faceVerified failed (non-fatal):', e);
  }
}

// Anchor selfie (verified reference face) helpers live in
// $lib/verified-vibe/server/anchor-selfie so proof-upload can reuse them.

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { step, data } = body;

    // Validate required fields
    if (!step || !data) {
      return json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate step is one of the allowed values
    const validSteps = ['id', 'liveness', 'photos', 'spending_or_qa'];
    if (!validSteps.includes(step)) {
      return json(
        { error: 'Invalid verification step' },
        { status: 400 }
      );
    }

    // Resolve authenticated user (optional — not required to process the step)
    const userId = await getUserIdFromRequest(request);

    // Process verification based on step
    if (step === 'id') {
      return await handleIDVerification(data, userId);
    } else if (step === 'liveness') {
      return await handleLivenessVerification(data, userId);
    } else if (step === 'photos') {
      return await handlePhotoVerification(data, userId);
    } else if (step === 'spending_or_qa') {
      return await handleSpendingOrQAVerification(data, userId);
    }

    return json({ error: 'Invalid verification step' }, { status: 400 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    console.error('Verification step error:', error);
    return json(
      { error: 'Failed to process verification step' },
      { status: 500 }
    );
  }
};

/**
 * Handle ID extraction step — calls Claude Vision to extract name, DOB, gender, ID number
 */
async function handleIDVerification(data: any, userId: string | null = null) {
  if (!data.image || !data.mimeType) {
    return json({ error: 'Image and mimeType are required' }, { status: 400 });
  }

  const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';

  try {
    // Face-gate FIRST. Identity is only VERIFIED from the ID when the ID photo
    // matches the user's verified anchor selfie (bar 55, enforced inside
    // checkLivenessWithClaude). A mismatch is REJECTED before anything else
    // happens — the name/data extraction never runs, nothing is persisted, no
    // points are awarded — and the client offers a re-upload. No anchor yet →
    // extraction runs but identity stays PENDING; the client captures a live
    // selfie (liveness step) that establishes the anchor and finalizes the ID.
    let faceMatch: boolean | null = null;
    let faceConfidence: number | null = null;
    let hasAnchor = false;
    if (userId && !skipVerification) {
      const anchor = await loadAnchorSelfie(userId);
      if (anchor) {
        hasAnchor = true;
        try {
          const live = await checkLivenessWithClaude(anchor, data.image, data.mimeType);
          faceMatch = live.match;
          faceConfidence = live.confidence;
        } catch (e) {
          // Couldn't compare (API/infra error). Treat as "not yet verified" and let
          // the client fall through to the live-selfie step rather than silently
          // passing an unverified ID.
          console.warn('anchor face match failed (non-fatal):', e);
          hasAnchor = false;
          faceMatch = null;
        }
        if (faceMatch === false) {
          return json({
            status: 'completed',
            step: 'id',
            data: { faceMatch: false, faceConfidence, faceVerified: false },
            trustPoints: 0,
          });
        }
      }
    }

    const result: any = skipVerification
      ? { idNumber: 'DEV-SKIP', idName: 'Dev User', idDOB: '01/01/1990', idGender: undefined, expirationDate: undefined }
      : await extractIDWithClaude(data.image, data.mimeType);

    const faceVerified = skipVerification || (hasAnchor && faceMatch === true);
    const enriched = { ...result, faceMatch, faceConfidence, faceVerified };
    const idPoints = getTrustPoints('id');

    if (userId) {
      if (faceVerified) {
        // Matches the anchor (or dev bypass) → completed + points.
        await persistVerificationStep(userId, 'id', idPoints, enriched, 'completed');
        enrollInPoolIfVerified(userId).catch(() => {});
      } else {
        // No anchor to compare against yet → keep the extracted name as a PENDING
        // row so the live-selfie step can finalize it, but never clobber an
        // already-completed (verified) ID row.
        const existingId = await getStepRow(userId, 'id');
        if (existingId?.status !== 'completed') {
          await persistVerificationStep(userId, 'id', 0, enriched, 'pending');
        }
      }
    }

    // Body always reports status:'completed' (the request was handled). The mobile
    // client keys off faceMatch: true → proceed, false → retake, null → capture a
    // live selfie. Points/persistence are gated above, not by this field.
    return json({ status: 'completed', step: 'id', data: enriched, trustPoints: faceVerified ? idPoints : 0 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    const message = error instanceof Error ? error.message : 'ID extraction failed';
    return json({ error: message }, { status: 422 });
  }
}

/**
 * Handle liveness check — compares selfie against the ID photo using Claude Vision
 */
async function handleLivenessVerification(data: any, userId: string | null = null) {
  if (!data.selfieImage) {
    return json({ error: 'Selfie is required' }, { status: 400 });
  }
  try {
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    const mimeType = data.mimeType ?? 'image/jpeg';
    const hasIdPhoto = typeof data.idPhotoBase64 === 'string' && data.idPhotoBase64.length > 0;

    let stepData: Record<string, unknown>;

    if (hasIdPhoto) {
      // Gov-ID gate selfie. Applies the SAME standard as onboarding — the selfie
      // must be a genuine live person (checkSelfieLivenessWithClaude) — AND it must
      // match the government-ID photo (checkLivenessWithClaude, bar 55). BOTH must
      // pass. Non-fatal: if Claude fails we return apiError:true so the client can
      // fail-open rather than hard-blocking on an outage.
      if (skipVerification) {
        stepData = { confidence: 99, match: true, live: true };
      } else {
        try {
          const [liveness, faceMatch] = await Promise.all([
            checkSelfieLivenessWithClaude(data.selfieImage, mimeType),
            checkLivenessWithClaude(data.selfieImage, data.idPhotoBase64, mimeType),
          ]);
          const livePass  = liveness.live === true && liveness.confidence >= LIVENESS_MIN_CONFIDENCE;
          const matchPass = faceMatch.match === true; // 55 bar applied inside checkLivenessWithClaude
          stepData = {
            confidence: faceMatch.confidence,
            match: livePass && matchPass,
            live: liveness.live,
            livenessConfidence: liveness.confidence,
          };
        } catch (e) {
          console.warn('[verify-step] gov-ID selfie check failed (non-fatal):', e);
          stepData = { confidence: 0, match: false, apiError: true };
        }
      }
    } else {
      // Onboarding path: no ID — run a liveness-only check and store the selfie
      // as the user's anchor face for later government-ID matching.
      const result = skipVerification
        ? { live: true, confidence: 99, reasoning: 'Bypassed in dev mode' }
        : await checkSelfieLivenessWithClaude(data.selfieImage, mimeType);
      let storedPath: string | null = null;
      if (userId && !skipVerification) {
        storedPath = await storeAnchorSelfie(userId, data.selfieImage);
      }
      // `match` mirrors `live` so existing clients reading match/confidence still work.
      stepData = {
        confidence: result.confidence,
        live: result.live,
        match: result.live,
        ...(storedPath ? { anchorSelfiePath: storedPath } : {})
      };
    }

    // Pass criteria differ per path:
    //  • gov-ID gate selfie (hasIdPhoto): stepData.match already encodes liveness
    //    AND the ID face-match (bar 55) — trust that combined decision directly.
    //  • onboarding selfie: gate on BOTH live=true AND confidence>=threshold.
    //    Checking confidence alone is insufficient: Claude may return live=false
    //    with a mid-range confidence (e.g. no face → live:false, confidence:0).
    // Both fail-open ONLY on our own API error so an outage never hard-blocks users.
    let passed: boolean;
    if (hasIdPhoto) {
      passed = stepData.apiError === true || stepData.match === true;
    } else {
      const confidence = typeof stepData.confidence === 'number' ? stepData.confidence : 0;
      const isLive = stepData.live === true || stepData.match === true;
      passed = isLive && confidence >= LIVENESS_MIN_CONFIDENCE;
    }

    // The ID-gate face-match also yields a verified face. If the user has no
    // anchor selfie yet (they never did the onboarding liveness step), store
    // this one so every later face check — ID matching and the face-gated proof
    // categories — reads from a single stored reference. An existing anchor is
    // NEVER overwritten: one selfie is the source of truth. Never store on the
    // apiError fail-open either: that face wasn't actually verified.
    if (hasIdPhoto && userId && !skipVerification && passed && stepData.apiError !== true) {
      const existingAnchor = await loadAnchorSelfie(userId);
      if (!existingAnchor) {
        const storedPath = await storeAnchorSelfie(userId, data.selfieImage);
        if (storedPath) stepData.anchorSelfiePath = storedPath;
      }
      // The live selfie proved genuineness AND matched the ID — promote the
      // pending government-ID row to face-verified (name + points now count).
      await finalizeIdFaceVerified(userId);
    }

    const trustPoints = passed ? getTrustPoints('liveness') : 0;
    const status = passed ? 'completed' : 'under_review';
    // Stamp the decision into the data the client receives (verifyStep returns
    // body.data, not the top-level status) so it shows the under-review screen
    // exactly when the score was actually withheld.
    stepData.underReview = !passed;

    if (userId) {
      if (passed) {
        await persistVerificationStep(userId, 'liveness', trustPoints, stepData, status);
        enrollInPoolIfVerified(userId).catch(() => {});
      } else {
        // A failed attempt must never downgrade an already-completed liveness
        // row (e.g. a poor gate selfie after onboarding passed) — that would
        // silently change the trust score on a FAILURE.
        const existing = await getStepRow(userId, 'liveness');
        if (existing?.status !== 'completed') {
          await persistVerificationStep(userId, 'liveness', 0, stepData, status);
        }
      }
    }

    return json({ status, step: 'liveness', data: stepData, trustPoints }, { status: 201 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    const message = error instanceof Error ? error.message : 'Liveness check failed';
    return json({ error: message }, { status: 422 });
  }
}

/**
 * Handle photo verification step
 */
async function handlePhotoVerification(data: any, userId: string | null = null) {
  try {
    // Validate required fields
    if (!data.images || !Array.isArray(data.images) || data.images.length < 1) {
      return json(
        { error: 'At least 1 image is required' },
        { status: 400 }
      );
    }

    if (!data.mimeTypes || data.mimeTypes.length !== data.images.length) {
      return json(
        { error: 'MIME types must match number of images' },
        { status: 400 }
      );
    }

    if (!data.labels || typeof data.labels !== 'object') {
      return json(
        { error: 'Photo labels are required' },
        { status: 400 }
      );
    }

    // Photo consistency check — informational only, never blocks the user.
    // The liveness step already verified the user's real face; if someone
    // uploads mismatched photos their profile quality suffers but we don't
    // hard-reject them here.
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    let consistencyResult = { consistent: true, confidence: 0.99 };
    if (!skipVerification && data.images.length >= 2) {
      try {
        consistencyResult = await checkPhotoConsistencyWithClaude(data.images, data.mimeTypes[0] || 'image/jpeg');
        if (!consistencyResult.consistent) {
          console.warn('[verify-step] photo consistency low — proceeding anyway (non-blocking)');
        }
      } catch (err) {
        console.warn('[verify-step] photo consistency check failed (non-fatal), proceeding:', err);
      }
    }

    const trustPoints = getTrustPoints('photos');

    // Upload photos to Supabase Storage and set avatar_url
    let avatarUrl: string | null = null;
    const allPhotoItems: Array<{ dataUrl: string; label: string }> = [];

    if (userId) {
      try {
        const supabase = getSupabase();
        const mimeToExt: Record<string, string> = {
          'image/jpeg': 'jpg', 'image/jpg': 'jpg',
          'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'
        };

        // Find which index is the 'lead' photo (fall back to index 0).
        // Mobile sends 'main' as the first label so also match that.
        const labels: Record<string, string> = data.labels ?? {};
        const leadIndex = Object.entries(labels)
          .find(([, v]) => v === 'lead' || v === 'main')?.[0] ?? '0';

        for (let i = 0; i < data.images.length; i++) {
          const mime = data.mimeTypes[i] ?? 'image/jpeg';
          const ext = mimeToExt[mime] ?? 'jpg';
          const path = `users/${userId}/photo_${i}.${ext}`;
          const buffer = Buffer.from(data.images[i], 'base64');

          const { error: uploadErr } = await supabase.storage
            .from('profiles')
            .upload(path, buffer, { contentType: mime, upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(path);
            const publicUrl = urlData.publicUrl;
            const isLead = String(i) === String(leadIndex);
            allPhotoItems.push({ dataUrl: publicUrl, label: isLead ? 'lead' : 'photo' });
            if (isLead) avatarUrl = publicUrl;
          }
        }

        if (avatarUrl) {
          await supabase
            .from('verified_vibe_users')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId);
        }

        // Persist hosted URLs to user_master_profile.photos so the mobile
        // profile screen can display them without another upload.
        if (allPhotoItems.length > 0) {
          await updateMasterProfile(userId, { photos: allPhotoItems });
        }
      } catch (uploadErr) {
        console.error('Photo storage upload error (non-fatal):', uploadErr);
      }
    }

    const stepData = {
      confidence: consistencyResult.confidence,
      consistent: true,
      photoCount: data.images.length,
      ...(avatarUrl && { avatarUrl })
    };

    if (userId) {
      await persistVerificationStep(userId, 'photos', trustPoints, stepData);
      enrollInPoolIfVerified(userId).catch(() => {});
    }

    const response = {
      status: 'completed',
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    console.error('Photo verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('consistency')) {
        return json(
          { error: 'Failed to analyze photo consistency. Please try again.' },
          { status: 400 }
        );
      }
      if (error.message.includes('API')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }

    return json(
      { error: 'Failed to verify photos. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle spending or Q&A verification step
 */
async function handleSpendingOrQAVerification(data: any, userId: string | null = null) {
  try {
    const { spendingImage, responses, gender, mimeType } = data;

    // For testing: if no data provided, return mock response
    if (!spendingImage && !responses) {
      return json(
        {
          status: 'completed',
          data: {
            type: 'mock',
            verified: true
          },
          trustPoints: getTrustPoints('spending_or_qa'),
          createdAt: new Date().toISOString()
        },
        { status: 201 }
      );
    }

    // The current onboarding flow is Q&A-only for EVERY archetype (DrawnTo +
    // HowYouLive); the old spending-receipt upload is no longer part of the
    // flow. So whenever responses are present we persist them as Q&A regardless
    // of archetype — previously casual_generous_man was gated to a spending
    // proof that the client never sends, so its answers were silently dropped
    // (returned 400 and never written to verified_vibe_verification).
    const hasResponses = responses && typeof responses === 'object' && Object.keys(responses).length > 0;

    if (hasResponses) {
      // Guard against an oversized Q&A payload. Legit onboarding answers are a few
      // hundred bytes; reject anything that's clearly an attempt to flood storage
      // or downstream prompts. ~20 KB serialized is generous headroom.
      let serializedSize = 0;
      try { serializedSize = JSON.stringify(responses).length; } catch { serializedSize = Number.MAX_SAFE_INTEGER; }
      if (Object.keys(responses).length > 100 || serializedSize > 20000) {
        return json({ error: 'Q&A responses payload is too large' }, { status: 400 });
      }
      return await handleQAVerification(responses, gender, userId);
    }

    // Legacy fallback: only analyse a spending image when one is actually supplied.
    if (spendingImage) {
      return await handleSpendingVerification(spendingImage, mimeType, userId);
    }

    return json({ error: 'Q&A responses are required' }, { status: 400 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    console.error('Spending/Q&A verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }

    return json(
      { error: 'Failed to verify spending/Q&A. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle spending verification for men
 */
async function handleSpendingVerification(spendingImageBase64: string, mimeType: string = 'image/jpeg', userId: string | null = null) {
  try {
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    const analysisResult = skipVerification
      ? { credible: true, confidence: 0.99, reasoning: 'Bypassed in dev mode' }
      : await analyzeSpendingPatternWithClaude(spendingImageBase64, mimeType);

    // If spending is not credible, return error
    if (!analysisResult.credible) {
      return json(
        {
          status: 'failed',
          data: {
            credible: false,
            confidence: analysisResult.confidence,
            reasoning: analysisResult.reasoning
          },
          trustPoints: 0
        },
        { status: 400 }
      );
    }

    // Spending is credible
    const trustPoints = getTrustPoints('spending_or_qa');
    const stepData = {
      type: 'spending',
      credible: true,
      confidence: analysisResult.confidence,
      reasoning: analysisResult.reasoning
    };

    if (userId) {
      await persistVerificationStep(userId, 'spending_or_qa', trustPoints, stepData);
    }

    return json({
      status: 'completed',
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    console.error('Spending verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }

    return json(
      { error: 'Failed to verify spending. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle Q&A verification — saves preference responses without AI gating.
 * The purpose of Q&A is to collect dating preferences, not to approve/reject
 * users based on answer quality, so we skip the Claude evaluation entirely.
 */
async function handleQAVerification(responses: Record<string, string>, gender: string, userId: string | null = null) {
  try {
    const hasResponses = responses && typeof responses === 'object' && Object.keys(responses).length > 0;
    if (!hasResponses) {
      return json({ error: 'Q&A responses are required' }, { status: 400 });
    }

    // Merge with any previously-saved Q&A answers so a later step (HowYouLive)
    // doesn't overwrite an earlier one (DrawnTo). The row is upserted on
    // (user_id, step), so without this the second POST would replace the first.
    // New answers win per-key; previously-saved keys are preserved.
    let mergedResponses: Record<string, unknown> = { ...responses };
    if (userId) {
      try {
        const supabase = getSupabase();
        const { data: existing } = await (supabase as any)
          .from('verified_vibe_verification')
          .select('data')
          .eq('user_id', userId)
          .eq('step', 'spending_or_qa')
          .eq('status', 'completed')
          .maybeSingle();
        const prev = (existing?.data?.responses as Record<string, unknown>) ?? {};
        mergedResponses = { ...prev, ...responses };
      } catch (e) {
        console.warn('Q&A merge: could not load existing responses (non-fatal):', e);
      }
    }

    const trustPoints = getTrustPoints('spending_or_qa');
    const stepData = {
      type: 'qa',
      satisfactory: true,
      confidence: 100,
      reasoning: 'Responses collected',
      responses: mergedResponses
    };

    if (userId) {
      await persistVerificationStep(userId, 'spending_or_qa', trustPoints, stepData);
      // The pool distiller reads ONLY user_master_profile, so this mirror is the
      // authoritative path for onboarding answers reaching the matchmaker. Gate
      // enrollment on a successful write so we never enroll with empty preferences.
      const synced = await updateMasterProfile(userId, { onboarding: mergedResponses });
      if (synced) {
        enrollInPoolIfVerified(userId).catch(() => {});
      } else {
        console.warn('[verify-step] skipped pool enroll — onboarding master-sync failed for', userId);
      }
    }

    return json({
      status: 'completed',
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    const svcErr = claudeErrorResponse(error);
    if (svcErr) return svcErr;
    console.error('Q&A verification error:', error);
    return json({ error: 'Failed to save Q&A responses. Please try again.' }, { status: 500 });
  }
}

/**
 * Get trust points for a verification step
 */
function getTrustPoints(step: string): number {
  const points: Record<string, number> = {
    id: 10,
    liveness: 10,
    photos: 15,
    spending_or_qa: 10
  };
  return points[step] || 0;
}
