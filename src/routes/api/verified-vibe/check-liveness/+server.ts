import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkLivenessWithClaude } from '$lib/verified-vibe/server/verification';
import { logAppError } from '$lib/server/logAppError';

/**
 * POST /api/verified-vibe/check-liveness
 *
 * Check liveness by comparing selfie to ID photo using Claude Vision API.
 *
 * Request body:
 * {
 *   selfie: string (base64-encoded selfie image),
 *   idPhoto: string (base64-encoded ID photo),
 *   mimeType: string (e.g., "image/jpeg")
 * }
 *
 * Response:
 * {
 *   data: {
 *     confidence: number (0-100),
 *     match: boolean
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { selfie, idPhoto, mimeType } = body;

    // Validate required fields
    if (!selfie || !idPhoto || !mimeType) {
      return json(
        { error: 'Missing required fields: selfie, idPhoto, and mimeType' },
        { status: 400 }
      );
    }

    // Validate image format
    if (!mimeType.startsWith('image/')) {
      return json(
        { error: 'Invalid image format' },
        { status: 400 }
      );
    }

    // Validate base64 images
    if (typeof selfie !== 'string' || !selfie.match(/^[A-Za-z0-9+/=]+$/)) {
      return json(
        { error: 'Invalid base64 selfie data' },
        { status: 400 }
      );
    }

    if (typeof idPhoto !== 'string' || !idPhoto.match(/^[A-Za-z0-9+/=]+$/)) {
      return json(
        { error: 'Invalid base64 ID photo data' },
        { status: 400 }
      );
    }

    // Check liveness using Claude Vision
    const livenessResult = await checkLivenessWithClaude(selfie, idPhoto, mimeType);

    // Validate response structure
    if (typeof livenessResult.confidence !== 'number' || typeof livenessResult.match !== 'boolean') {
      return json(
        { error: 'Invalid response from verification service' },
        { status: 500 }
      );
    }

    // Validate confidence score range (0-100)
    if (livenessResult.confidence < 0 || livenessResult.confidence > 100) {
      return json(
        { error: 'Invalid confidence score from verification service' },
        { status: 500 }
      );
    }

    return json(
      {
        data: livenessResult
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Liveness check error:', error);
    logAppError(error, {
      feature: 'Face Verification',
      file: 'src/routes/api/verified-vibe/check-liveness/+server.ts',
      endpoint: 'POST /api/verified-vibe/check-liveness',
    }).catch(() => {});

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('no face') || error.message.includes('not visible')) {
        return json(
          { error: 'Face not clearly visible. Please retake your selfie.' },
          { status: 400 }
        );
      }
      if (error.message.includes('timeout') || error.message.includes('AbortError')) {
        return json(
          { error: 'Request took too long. Please check your connection and try again.' },
          { status: 504 }
        );
      }
      if (error.message.includes('API') || error.message.includes('429')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        return json(
          { error: 'Authentication error. Please contact support.' },
          { status: 500 }
        );
      }
    }

    return json(
      { error: 'Failed to check liveness. Please try again.' },
      { status: 500 }
    );
  }
};
