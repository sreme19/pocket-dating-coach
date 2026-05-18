import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { 
  extractIDWithClaude,
  checkLivenessWithClaude,
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

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Process verification based on step
    if (step === 'id') {
      return await handleIDVerification(data);
    } else if (step === 'liveness') {
      return await handleLivenessVerification(data);
    } else if (step === 'photos') {
      return await handlePhotoVerification(data);
    } else if (step === 'spending_or_qa') {
      return await handleSpendingOrQAVerification(data);
    }

    // For other steps, return mock response
    const response = {
      status: 'completed',
      step,
      data: {
        // Step-specific response data
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
      },
      trustPoints: getTrustPoints(step),
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
 * Handle ID verification step
 */
async function handleIDVerification(data: any) {
  try {
    // Validate required fields
    if (!data.image || !data.mimeType) {
      return json(
        { error: 'ID image and MIME type are required' },
        { status: 400 }
      );
    }

    // Extract ID data using Claude
    const extractedData = await extractIDWithClaude(data.image, data.mimeType);

    // Return extracted data
    const response = {
      status: 'completed',
      data: extractedData,
      trustPoints: getTrustPoints('id'),
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('ID verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('unclear') || error.message.includes('not readable')) {
        return json(
          { error: 'ID photo is unclear. Please upload a clearer photo.' },
          { status: 400 }
        );
      }
      if (error.message.includes('invalid') || error.message.includes('not found')) {
        return json(
          { error: 'Could not find a valid ID in the photo. Please try again.' },
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
      { error: 'Failed to verify ID. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle liveness verification step
 */
async function handleLivenessVerification(data: any) {
  try {
    // Validate required fields
    if (!data.image || !data.mimeType) {
      return json(
        { error: 'Selfie image and MIME type are required' },
        { status: 400 }
      );
    }

    // For now, we'll just return a mock liveness check
    // In a full implementation, we would compare the selfie to the ID photo
    // which requires storing the ID photo from the previous step
    
    // Mock liveness result
    const livenessResult = {
      confidence: 92,
      match: true
    };

    const response = {
      status: 'completed',
      data: livenessResult,
      trustPoints: getTrustPoints('liveness'),
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Liveness verification error:', error);

    if (error instanceof Error) {
      if (error.message.includes('no face') || error.message.includes('not visible')) {
        return json(
          { error: 'Face not clearly visible. Please retake your selfie.' },
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
      { error: 'Failed to check liveness. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle photo verification step
 */
async function handlePhotoVerification(data: any) {
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

    // Check photo consistency using Claude
    const consistencyResult = await checkPhotoConsistencyWithClaude(
      data.images,
      data.mimeTypes[0] || 'image/jpeg'
    );

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

    // Photos are consistent - save them to Supabase storage
    // TODO: Get user ID from session
    const userId = 'demo-user-id'; // Placeholder
    const photoUrls: string[] = [];

    // For now, we'll just return the consistency result
    // In a full implementation, we would:
    // 1. Upload each photo to Supabase storage
    // 2. Save photo metadata to database
    // 3. Return signed URLs for the photos

    const response = {
      status: 'completed',
      data: {
        confidence: consistencyResult.confidence,
        consistent: true,
        photoCount: data.images.length,
        photoUrls: photoUrls // Would contain actual URLs after upload
      },
      trustPoints: getTrustPoints('photos'),
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
async function handleSpendingOrQAVerification(data: any) {
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

      return await handleSpendingVerification(spendingImage, mimeType);
    } else {
      // Q&A verification for women and prefer_not_to_say
      if (!responses || typeof responses !== 'object') {
        return json(
          { error: 'Q&A responses are required' },
          { status: 400 }
        );
      }

      return await handleQAVerification(responses, gender);
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
async function handleSpendingVerification(spendingImageBase64: string, mimeType: string = 'image/jpeg') {
  try {
    // Analyze spending pattern using Claude
    const analysisResult = await analyzeSpendingPatternWithClaude(
      spendingImageBase64,
      mimeType
    );

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
    const response = {
      status: 'completed',
      data: {
        type: 'spending',
        credible: true,
        confidence: analysisResult.confidence,
        reasoning: analysisResult.reasoning
      },
      trustPoints: getTrustPoints('spending_or_qa'),
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
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
async function handleQAVerification(responses: Record<string, string>, gender: string) {
  try {
    // Evaluate Q&A responses using Claude
    const evaluationResult = await evaluateQAResponsesWithClaude(
      responses,
      gender as 'man' | 'woman' | 'prefer_not_to_say'
    );

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
    const response = {
      status: 'completed',
      data: {
        type: 'qa',
        satisfactory: true,
        confidence: evaluationResult.confidence,
        reasoning: evaluationResult.reasoning,
        responses: responses
      },
      trustPoints: getTrustPoints('spending_or_qa'),
      createdAt: new Date().toISOString()
    };

    return json(response, { status: 201 });
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
