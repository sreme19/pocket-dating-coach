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
  evaluateQAResponsesWithClaude
} from '$lib/verified-vibe/server/verification';
import { enrollInPoolIfVerified } from '$lib/server/pool-registry';
import { recomputeAndNormalize } from '$lib/server/trust-normalize';

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
async function updateMasterProfile(userId: string, fields: Record<string, unknown>): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: existing } = await (supabase as any)
      .from('user_master_profile')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    const prev = (existing?.data as Record<string, unknown>) ?? {};
    const merged = { ...prev, ...fields };
    await (supabase as any)
      .from('user_master_profile')
      .upsert(
        { user_id: userId, data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (e) {
    console.warn('[verify-step] master-profile update failed (non-fatal):', e);
  }
}

/** Save a completed step to Supabase (best-effort; does not fail the request) */
async function persistVerificationStep(
  userId: string,
  step: string,
  trustPoints: number,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getSupabase();
    await (supabase as any)
      .from('verified_vibe_verification')
      .upsert(
        { user_id: userId, step, status: 'completed', data: data ?? null, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,step' }
      );
    // Recompute + normalize trust score after every verification step
    recomputeAndNormalize(userId).catch((e) => console.warn('trust recompute failed (non-fatal):', e));
  } catch (e) {
    console.error('persistVerificationStep error (non-fatal):', e);
  }
}

// ── Anchor selfie (onboarding liveness face) ─────────────────────────────────
// The onboarding selfie is stored as the user's "anchor face" and later matched
// against a government ID when they upload a name-bearing document.
const ANCHOR_BUCKET = 'profiles';
const anchorSelfiePath = (userId: string) => `identity/${userId}/anchor_selfie.jpg`;

/** Upload the onboarding selfie to Storage as the anchor face. Returns the path or null. */
async function storeAnchorSelfie(userId: string, base64: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const path = anchorSelfiePath(userId);
    const buffer = Buffer.from(base64, 'base64');
    const { error } = await supabase.storage
      .from(ANCHOR_BUCKET)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) { console.warn('anchor selfie upload failed (non-fatal):', error); return null; }
    return path;
  } catch (e) { console.warn('anchor selfie upload error (non-fatal):', e); return null; }
}

/** Download the stored anchor selfie as base64, or null if none exists. */
async function loadAnchorSelfie(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(ANCHOR_BUCKET).download(anchorSelfiePath(userId));
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return buf.toString('base64');
  } catch { return null; }
}

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
    const result: any = skipVerification
      ? { idNumber: 'DEV-SKIP', idName: 'Dev User', idDOB: '01/01/1990', idGender: undefined, expirationDate: undefined }
      : await extractIDWithClaude(data.image, data.mimeType);

    // Match the ID photo against the onboarding anchor selfie, if one exists.
    // Warn-only: a low match is flagged for review, never hard-blocked.
    let faceMatch: boolean | null = null;
    let faceConfidence: number | null = null;
    if (userId && !skipVerification) {
      const anchor = await loadAnchorSelfie(userId);
      if (anchor) {
        try {
          const live = await checkLivenessWithClaude(anchor, data.image, data.mimeType);
          faceMatch = live.match;
          faceConfidence = live.confidence;
        } catch (e) {
          console.warn('anchor face match failed (non-fatal):', e);
        }
      }
    }

    const enriched = { ...result, faceMatch, faceConfidence };
    const trustPoints = getTrustPoints('id');
    if (userId && !skipVerification) {
      await persistVerificationStep(userId, 'id', trustPoints, enriched);
      enrollInPoolIfVerified(userId).catch(() => {});
    }
    return json({ status: 'completed', step: 'id', data: enriched, trustPoints });
  } catch (error) {
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
      // Legacy / explicit path: compare the selfie against a provided ID photo.
      const result = skipVerification
        ? { confidence: 99, match: true }
        : await checkLivenessWithClaude(data.selfieImage, data.idPhotoBase64, mimeType);
      stepData = { confidence: result.confidence, match: result.match };
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

    // Always treat as completed — low-confidence results go to manual review
    // rather than hard-blocking the user. The client surfaces "under review"
    // messaging when confidence < 50.
    const trustPoints = getTrustPoints('liveness');

    if (userId) {
      await persistVerificationStep(userId, 'liveness', trustPoints, stepData);
      enrollInPoolIfVerified(userId).catch(() => {});
    }

    return json({ status: 'completed', step: 'liveness', data: stepData, trustPoints }, { status: 201 });
  } catch (error) {
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

    // Check photo consistency using Claude (bypass in dev or when only 1 photo uploaded)
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    const consistencyResult = skipVerification || data.images.length < 2
      ? { consistent: true, confidence: 0.99 }
      : await checkPhotoConsistencyWithClaude(data.images, data.mimeTypes[0] || 'image/jpeg');

    // If photos are not consistent, return error
    if (!consistencyResult.consistent) {
      return json(
        {
          status: 'failed',
          data: {
            confidence: consistencyResult.confidence,
            consistent: false,
            reason: 'Photos are not consistent. Please upload photos of the same person.'
          },
          trustPoints: 0
        },
        { status: 400 }
      );
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
    }

    const response = {
      status: 'completed',
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
  } catch (error) {
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
      return await handleQAVerification(responses, gender, userId);
    }

    // Legacy fallback: only analyse a spending image when one is actually supplied.
    if (spendingImage) {
      return await handleSpendingVerification(spendingImage, mimeType, userId);
    }

    return json({ error: 'Q&A responses are required' }, { status: 400 });
  } catch (error) {
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
      // Mirror onboarding responses into user_master_profile so the web profile
      // and AI context have them without waiting for the mobile sync call.
      await updateMasterProfile(userId, { onboarding: mergedResponses });
    }

    return json({
      status: 'completed',
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
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
