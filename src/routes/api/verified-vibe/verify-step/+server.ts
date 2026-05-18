import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import {
  checkPhotoConsistencyWithClaude,
  analyzeSpendingPatternWithClaude,
  evaluateQAResponsesWithClaude
} from '$lib/verified-vibe/server/verification';

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
      .from('verified_vibe_verification_steps')
      .upsert(
        { user_id: userId, step, trust_points: trustPoints, data: data ?? null, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,step' }
      );
  } catch (e) {
    console.error('persistVerificationStep error (non-fatal):', e);
  }
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
    if (step === 'photos') {
      return await handlePhotoVerification(data, userId);
    } else if (step === 'spending_or_qa') {
      return await handleSpendingOrQAVerification(data, userId);
    }

    // For id/liveness steps, return mock response and persist
    const trustPoints = getTrustPoints(step);
    const stepData = {
      ...(step === 'id' && {
        idNumber: 'DL123456',
        idName: 'Alexander Smith',
        idDOB: '1998-03-15',
        idExpiration: '2028-03-15'
      }),
      ...(step === 'liveness' && {
        confidence: 92,
        match: true
      })
    };

    if (userId) {
      await persistVerificationStep(userId, step, trustPoints, stepData);
    }

    const response = {
      status: 'completed',
      step,
      data: stepData,
      trustPoints,
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Verification step error:', error);
    return json(
      { error: 'Failed to process verification step' },
      { status: 500 }
    );
  }
};

/**
 * Handle photo verification step
 */
async function handlePhotoVerification(data: any, userId: string | null = null) {
  try {
    // Validate required fields
    if (!data.images || !Array.isArray(data.images) || data.images.length < 5) {
      return json(
        { error: 'At least 5 images are required' },
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

    // Check photo consistency using Claude (bypass in dev with VITE_SKIP_VERIFICATION=true)
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    const consistencyResult = skipVerification
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
    const stepData = {
      confidence: consistencyResult.confidence,
      consistent: true,
      photoCount: data.images.length
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

    // Determine verification type based on gender
    const isMale = gender === 'man';

    if (isMale) {
      // Spending verification for men
      if (!spendingImage) {
        return json(
          { error: 'Spending image is required for men' },
          { status: 400 }
        );
      }

      return await handleSpendingVerification(spendingImage, mimeType, userId);
    } else {
      // Q&A verification for women and prefer_not_to_say
      if (!responses || typeof responses !== 'object') {
        return json(
          { error: 'Q&A responses are required' },
          { status: 400 }
        );
      }

      return await handleQAVerification(responses, gender, userId);
    }
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
 * Handle Q&A verification for women
 */
async function handleQAVerification(responses: Record<string, string>, gender: string, userId: string | null = null) {
  try {
    const skipVerification = import.meta.env.VITE_SKIP_VERIFICATION === 'true';
    const evaluationResult = skipVerification
      ? { satisfactory: true, confidence: 0.99, reasoning: 'Bypassed in dev mode' }
      : await evaluateQAResponsesWithClaude(responses, gender as 'man' | 'woman' | 'prefer_not_to_say');

    // If Q&A is not satisfactory, return error
    if (!evaluationResult.satisfactory) {
      return json(
        {
          status: 'failed',
          data: {
            satisfactory: false,
            confidence: evaluationResult.confidence,
            reasoning: evaluationResult.reasoning
          },
          trustPoints: 0
        },
        { status: 400 }
      );
    }

    // Q&A is satisfactory
    const trustPoints = getTrustPoints('spending_or_qa');
    const stepData = {
      type: 'qa',
      satisfactory: true,
      confidence: evaluationResult.confidence,
      reasoning: evaluationResult.reasoning
    };

    if (userId) {
      await persistVerificationStep(userId, 'spending_or_qa', trustPoints, stepData);
    }

    return json({
      status: 'completed',
      data: { ...stepData, responses },
      trustPoints,
      createdAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Q&A verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }

    return json(
      { error: 'Failed to verify Q&A responses. Please try again.' },
      { status: 500 }
    );
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
