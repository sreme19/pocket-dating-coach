import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$env/static/private';

interface CheckPhotoConsistencyRequest {
  images: string[]; // base64 encoded images
  mimeTypes: string[];
}

interface PhotoConsistencyResult {
  confidence: number;
  consistent: boolean;
}

/**
 * POST /api/verified-vibe/check-photo-consistency
 *
 * Analyzes multiple photos to determine if they are all of the same person.
 * Uses Claude Vision API to compare photos and return a confidence score.
 *
 * Request body:
 * {
 *   images: string[] - base64 encoded images
 *   mimeTypes: string[] - MIME types for each image
 * }
 *
 * Response:
 * {
 *   data: {
 *     confidence: number (0-100),
 *     consistent: boolean (confidence >= 80%)
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  // Create abort controller for timeout (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    let body: CheckPhotoConsistencyRequest;
    try {
      body = (await request.json()) as CheckPhotoConsistencyRequest;
    } catch {
      clearTimeout(timeoutId);
      return json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate request
    if (!body.images || !Array.isArray(body.images) || body.images.length < 1) {
      clearTimeout(timeoutId);
      return json(
        { error: 'At least 1 image is required' },
        { status: 400 }
      );
    }

    if (!body.mimeTypes || body.mimeTypes.length !== body.images.length) {
      clearTimeout(timeoutId);
      return json(
        { error: 'MIME types must match number of images' },
        { status: 400 }
      );
    }

    // Validate base64 images
    for (let i = 0; i < body.images.length; i++) {
      if (typeof body.images[i] !== 'string' || !body.images[i].match(/^[A-Za-z0-9+/=]+$/)) {
        clearTimeout(timeoutId);
        return json(
          { error: `Invalid base64 data for image ${i + 1}` },
          { status: 400 }
        );
      }
    }

    // Build Claude message with images
    const imageContent = body.images.map((image, index) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: body.mimeTypes[index] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image
      }
    }));

    // Add text prompt
    const content = [
      ...imageContent,
      {
        type: 'text' as const,
        text: `Analyze these ${body.images.length} photos carefully. Determine if they are all of the same person.

Consider:
- Facial features (shape, proportions, distinctive marks)
- Eye color and shape
- Nose shape and size
- Mouth and lips
- Skin tone and texture
- Hair color and style (may vary)
- Overall facial structure

Provide your analysis as JSON with:
{
  "confidence": <number 0-100>,
  "consistent": <boolean>,
  "reasoning": "<brief explanation>"
}

Be strict: if there's any doubt, lower the confidence. Only mark as consistent if confidence >= 80%.`
      }
    ];

    // Call Claude API with timeout
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to analyze photos';
      try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
      } catch {
        // If response is not JSON, use generic message
        errorMessage = `Server error (${response.status}). Please try again.`;
      }
      console.error('Claude API error:', errorMessage);
      return json(
        { error: errorMessage },
        { status: response.status >= 500 ? 503 : 500 }
      );
    }

    let claudeResponse;
    try {
      claudeResponse = await response.json();
    } catch {
      return json(
        { error: 'Invalid response from verification service' },
        { status: 500 }
      );
    }

    const textContent = claudeResponse.content?.find(
      (block: any) => block.type === 'text'
    );

    if (!textContent || !textContent.text) {
      return json(
        { error: 'No response from verification service' },
        { status: 500 }
      );
    }

    // Parse Claude's response with safer JSON extraction
    let result: PhotoConsistencyResult;
    try {
      // Extract JSON from response (Claude might include extra text)
      // Use a more specific regex to avoid greedy matching
      const jsonMatch = textContent.text.match(/\{[\s\S]*?"confidence"[\s\S]*?"consistent"[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate parsed response structure
      if (typeof parsed.confidence !== 'number' || typeof parsed.consistent !== 'boolean') {
        throw new Error('Invalid response structure');
      }

      // Validate confidence score range (0-100)
      if (parsed.confidence < 0 || parsed.confidence > 100) {
        throw new Error('Invalid confidence score');
      }

      result = {
        confidence: Math.round(parsed.confidence),
        consistent: parsed.confidence >= 80
      };
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textContent.text);
      return json(
        { error: 'Failed to parse analysis results' },
        { status: 500 }
      );
    }

    return json({
      data: result
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Photo consistency check error:', error);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return json(
        { error: 'Request took too long. Please check your connection and try again.' },
        { status: 504 }
      );
    }

    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
