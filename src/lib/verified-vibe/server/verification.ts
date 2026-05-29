/**
 * Verified Vibe — Server-side Verification Utilities
 *
 * Handles Claude Vision API integration for ID extraction, liveness checks,
 * and photo consistency analysis.
 */

import type { IDExtractionResult, LivenessCheckResult, PhotoConsistencyResult } from '../types';
import { ANTHROPIC_API_KEY as CLAUDE_API_KEY } from '$env/static/private';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

/**
 * Extract ID information from an image using Claude Vision
 *
 * @param base64Image - Base64-encoded image data
 * @param mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns Extracted ID data
 * @throws Error if extraction fails
 */
export async function extractIDWithClaude(
  base64Image: string,
  mimeType: string
): Promise<IDExtractionResult> {
  // Validate API key
  if (!CLAUDE_API_KEY) {
    console.error('ANTHROPIC_API_KEY environment variable not set');
    throw new Error('API configuration error. Please contact support.');
  }

  // Validate API key format (should start with sk-ant-)
  if (!CLAUDE_API_KEY.startsWith('sk-ant-')) {
    console.error('Invalid ANTHROPIC_API_KEY format');
    throw new Error('API configuration error. Please contact support.');
  }

  try {
    // Create abort controller for timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: `Extract the following information from this government ID image:
1. ID Number (driver's license number, passport number, Aadhaar number, etc.)
2. Full Name (as shown on the ID)
3. Date of Birth (in DD/MM/YYYY format)
4. Gender (M/F/Male/Female/Other as printed on the ID, or null if not present)
5. Expiration Date (in DD/MM/YYYY format, if visible)

Return ONLY a JSON object with these exact keys:
{
  "idNumber": "...",
  "idName": "...",
  "idDOB": "...",
  "idGender": "..." or null,
  "expirationDate": "..." or null
}

If the image is not a valid government ID or the information is not clearly readable, respond with:
{
  "error": "reason why extraction failed"
}

Do not include any other text or explanation.`
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Failed to process ID image';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // If error response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }

        console.error(`Claude API error (${response.status}):`, errorMessage);

        // Provide user-friendly error messages based on status
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication error. Please try again later.');
        } else if (response.status === 429) {
          throw new Error('Service is busy. Please wait a moment and try again.');
        } else if (response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      const content = data.content[0]?.text;

      if (!content) {
        console.error('No text content in Claude response');
        throw new Error('No response from Claude API');
      }

      // Parse the JSON response with better error handling
      // Claude 4.x wraps JSON in markdown code blocks — strip them first
      const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(stripped);
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', {
          content: content.substring(0, 200),
          error: parseError instanceof Error ? parseError.message : 'Unknown error'
        });
        throw new Error('Invalid response format from Claude API');
      }

      // Check for error in response
      if (parsedResponse.error) {
        throw new Error(`ID extraction failed: ${parsedResponse.error}`);
      }

      // Validate required fields are non-empty strings
      if (
        !parsedResponse.idNumber ||
        typeof parsedResponse.idNumber !== 'string' ||
        !parsedResponse.idName ||
        typeof parsedResponse.idName !== 'string' ||
        !parsedResponse.idDOB ||
        typeof parsedResponse.idDOB !== 'string'
      ) {
        console.error('Missing or invalid required ID fields:', parsedResponse);
        throw new Error('Could not extract all required information from ID. Please try with a clearer photo.');
      }

      return {
        idNumber: parsedResponse.idNumber.trim(),
        idName: parsedResponse.idName.trim(),
        idDOB: parsedResponse.idDOB.trim(),
        idGender: parsedResponse.idGender ? parsedResponse.idGender.trim() : undefined,
        expirationDate: parsedResponse.expirationDate ? parsedResponse.expirationDate.trim() : undefined
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Claude API request timeout');
        throw new Error('Request took too long. Please try again.');
      }

      throw fetchError;
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Unexpected error in extractIDWithClaude:', error);
    throw new Error('Failed to extract ID information. Please try again.');
  }
}

/**
 * Check liveness by comparing selfie to ID photo using Claude Vision
 *
 * @param selfieBase64 - Base64-encoded selfie image
 * @param idPhotoBase64 - Base64-encoded ID photo
 * @param mimeType - MIME type of the images
 * @returns Liveness check result with confidence score
 * @throws Error if check fails
 */
export async function checkLivenessWithClaude(
  selfieBase64: string,
  idPhotoBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<LivenessCheckResult> {
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are performing identity verification by comparing a government ID photo (Image 1) with a current selfie (Image 2).

CRITICAL CONTEXT:
- Government ID photos are often 5–20+ years old. The person WILL look older, may have different hair, gained/lost weight, and grown or shaved facial hair.
- Your job is to compare BONE STRUCTURE and FIXED GEOMETRY only — not appearance.

FOCUS ONLY on these immutable structural features:
1. Interpupillary distance (how far apart the eyes are)
2. Nose shape: bridge width, tip shape, nostril width
3. Face shape: overall outline (oval / square / round / heart)
4. Jaw and chin shape
5. Cheekbone prominence and position
6. Ear shape (if visible)
7. Brow ridge and forehead proportions

COMPLETELY IGNORE (these change over time or with camera angle):
- Hair color, length, or style
- Facial hair (beard, stubble, mustache) — the selfie person may have grown a beard since the ID photo
- Skin tone or texture (lighting differences)
- Weight or puffiness
- Glasses or accessories
- Photo quality, resolution, or angle differences
- Expression

Carefully study the fixed bone structure in both photos and determine if they are the same person photographed years apart.`
              },
              {
                type: 'text',
                text: 'Image 1 — Government ID photo (may be many years old):'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: idPhotoBase64
                }
              },
              {
                type: 'text',
                text: 'Image 2 — Current selfie:'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: selfieBase64
                }
              },
              {
                type: 'text',
                text: `Based on structural facial geometry alone (ignoring age, hair, beard, and appearance changes), what is your confidence these are the same person?

A score of 60+ means the structural features are consistent and this should pass verification.
A score below 40 means clearly different people.
Scores 40–59 indicate uncertainty — only fail if you are confident these are different people.

Return ONLY a JSON object:
{
  "confidence": <number 0-100>,
  "match": <boolean>,
  "reasoning": "<brief explanation focusing on specific structural features compared>"
}

Do not include any other text.`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error('No response from Claude API');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    } catch (e) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Invalid response format from Claude API');
    }

    // Use 55 as the pass threshold (not 80) — ID photos can be 10-20 years old,
    // so a confident structural match rarely scores above 75.
    const confidence = parsedResponse.confidence ?? 0;
    const match = parsedResponse.match === true || confidence >= 55;

    return {
      confidence,
      match
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to check liveness');
  }
}

/**
 * Check photo consistency using Claude Vision
 *
 * @param photoBase64Array - Array of base64-encoded photo images
 * @param mimeType - MIME type of the images
 * @returns Photo consistency result
 * @throws Error if check fails
 */
export async function checkPhotoConsistencyWithClaude(
  photoBase64Array: string[],
  mimeType: string = 'image/jpeg'
): Promise<PhotoConsistencyResult> {
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  if (photoBase64Array.length < 2) {
    throw new Error('At least 2 photos are required for consistency check');
  }

  try {
    // Build message content with all images
    const messageContent: any[] = [
      {
        type: 'text',
        text: `Analyze these ${photoBase64Array.length} photos. Are they all of the same person?`
      }
    ];

    // Add all images
    photoBase64Array.forEach((base64, index) => {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: base64
        }
      });
    });

    messageContent.push({
      type: 'text',
      text: `Rate your confidence that all these photos are of the same person on a scale of 0-100.

Return ONLY a JSON object:
{
  "confidence": <number 0-100>,
  "consistent": <boolean>,
  "reasoning": "<brief explanation>"
}

Do not include any other text.`
    });

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error('No response from Claude API');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    } catch (e) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Invalid response format from Claude API');
    }

    return {
      confidence: parsedResponse.confidence || 0,
      consistent: parsedResponse.consistent || parsedResponse.confidence >= 80
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to check photo consistency');
  }
}

/**
 * Analyze spending pattern from bank statement or screenshot using Claude Vision
 *
 * @param spendingImageBase64 - Base64-encoded image of bank statement or spending screenshot
 * @param mimeType - MIME type of the image
 * @returns Spending analysis result
 * @throws Error if analysis fails
 */
export async function analyzeSpendingPatternWithClaude(
  spendingImageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ credible: boolean; confidence: number; reasoning: string }> {
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  const isPDF = mimeType === 'application/pdf';

  try {
    const mediaBlock = isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: spendingImageBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: spendingImageBase64 } };

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(isPDF ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {})
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this bank statement or spending screenshot. Assess the credibility of the spending pattern shown.'
              },
              mediaBlock,
              {
                type: 'text',
                text: `Evaluate the spending pattern for credibility. Consider:
1. Is this a legitimate bank statement or spending record?
2. Does the spending pattern appear authentic and consistent?
3. Are there any red flags or signs of manipulation?

Rate your confidence that this is a credible spending pattern on a scale of 0-100.

Return ONLY a JSON object:
{
  "credible": <boolean>,
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation of the spending pattern and credibility assessment>"
}

Do not include any other text.`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error('No response from Claude API');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    } catch (e) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Invalid response format from Claude API');
    }

    return {
      credible: parsedResponse.credible || parsedResponse.confidence >= 75,
      confidence: parsedResponse.confidence || 0,
      reasoning: parsedResponse.reasoning || 'Unable to assess spending pattern'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to analyze spending pattern');
  }
}

/**
 * Evaluate Q&A responses for honesty and clarity using Claude
 *
 * @param responses - Record of Q&A responses
 * @param gender - User's gender for context
 * @returns Q&A evaluation result
 * @throws Error if evaluation fails
 */
export async function evaluateQAResponsesWithClaude(
  responses: Record<string, string>,
  gender: 'man' | 'woman' | 'prefer_not_to_say' = 'prefer_not_to_say'
): Promise<{ satisfactory: boolean; confidence: number; reasoning: string }> {
  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  try {
    // Format responses for Claude
    const formattedResponses = Object.entries(responses)
      .map(([key, value]) => `Q: ${key}\nA: ${value}`)
      .join('\n\n');

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Evaluate these Q&A responses from a ${gender} user on a dating app. Assess the honesty, clarity, and authenticity of their answers.

${formattedResponses}

Consider:
1. Are the responses genuine and thoughtful?
2. Do they show self-awareness and clarity about dating intent?
3. Are there any red flags or signs of dishonesty?
4. Is the writing clear and coherent?
5. Do the responses suggest a serious dating intent?

Rate your confidence that these responses are satisfactory (honest, clear, and authentic) on a scale of 0-100.

Return ONLY a JSON object:
{
  "satisfactory": <boolean>,
  "confidence": <number 0-100>,
  "reasoning": "<brief explanation of the Q&A quality and authenticity>"
}

Do not include any other text.`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error('No response from Claude API');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    } catch (e) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Invalid response format from Claude API');
    }

    return {
      satisfactory: parsedResponse.satisfactory || parsedResponse.confidence >= 70,
      confidence: parsedResponse.confidence || 0,
      reasoning: parsedResponse.reasoning || 'Unable to evaluate Q&A responses'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to evaluate Q&A responses');
  }
}
