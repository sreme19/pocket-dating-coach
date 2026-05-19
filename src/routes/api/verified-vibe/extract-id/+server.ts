import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractIDWithClaude } from '$lib/verified-vibe/server/verification';

/**
 * POST /api/verified-vibe/extract-id
 *
 * Extract ID information from an uploaded image using Claude Vision API.
 *
 * Request body:
 * {
 *   image: string (base64-encoded image),
 *   mimeType: string (e.g., "image/jpeg")
 * }
 *
 * Response:
 * {
 *   data: {
 *     idNumber: string,
 *     idName: string,
 *     idDOB: string,
 *     expirationDate?: string
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { image, mimeType } = body;

    // Validate required fields
    if (!image || !mimeType) {
      return json(
        { error: 'Missing required fields: image and mimeType' },
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

    // Validate base64 image
    if (typeof image !== 'string' || !image.match(/^[A-Za-z0-9+/=]+$/)) {
      return json(
        { error: 'Invalid base64 image data' },
        { status: 400 }
      );
    }

    // Extract ID data using Claude Vision
    const extractedData = await extractIDWithClaude(image, mimeType);

    return json(
      {
        data: extractedData
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('ID extraction error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('unclear') || message.includes('not readable') || message.includes('clearer')) {
        return json(
          { error: 'ID photo is unclear. Please upload a clearer photo.' },
          { status: 400 }
        );
      }
      if (message.includes('invalid') || message.includes('not found') || message.includes('not a valid')) {
        return json(
          { error: 'Could not find a valid ID in the photo. Please try again.' },
          { status: 400 }
        );
      }
      if (message.includes('timeout') || message.includes('took too long')) {
        return json(
          { error: 'Request took too long. Please try again.' },
          { status: 408 }
        );
      }
      if (message.includes('busy') || message.includes('rate')) {
        return json(
          { error: 'Service is busy. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      if (message.includes('authentication') || message.includes('configuration')) {
        return json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }

      // Return the error message from the backend function if it's user-friendly
      if (message.includes('extraction failed') || message.includes('required information')) {
        return json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return json(
      { error: 'Failed to extract ID information. Please try again.' },
      { status: 500 }
    );
  }
};
