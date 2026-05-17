import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

    // TODO: Process verification based on step
    // Step 1: ID extraction (Claude vision)
    // - Extract ID number, name, DOB, expiration date
    // - Save to verification record
    // - Return extracted data for confirmation

    // Step 2: Liveness check (Claude vision)
    // - Compare selfie to ID photo
    // - Return confidence score (0-100)
    // - If confidence > 80%, mark as passed

    // Step 3: Photo consistency (Claude vision)
    // - Analyze all photos for consistency
    // - Return confidence score (0-100)
    // - If consistent, mark as passed

    // Step 4: Spending/Q&A (Claude text analysis)
    // - For men: Analyze spending pattern
    // - For women: Evaluate Q&A responses
    // - Return pass/fail status

    // Mock response
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
        }),
        ...(step === 'photos' && {
          confidence: 88,
          consistent: true,
          photoCount: 5
        }),
        ...(step === 'spending_or_qa' && {
          verified: true,
          type: 'spending' // or 'qa'
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
