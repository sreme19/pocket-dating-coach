import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
  calculateCompatibility,
  getCompatibilityColor,
  getCompatibilityLabel,
  type UserAnswers
} from '$lib/verified-vibe/server/matching';
import type { VerifiedVibeUser } from '$lib/verified-vibe/types';

interface CalculateCompatibilityRequest {
  user1: VerifiedVibeUser;
  user2: VerifiedVibeUser;
  user1Answers?: UserAnswers;
  user2Answers?: UserAnswers;
}

interface CalculateCompatibilityResponse {
  data: {
    total: number;
    archetypeScore: number;
    qaScore: number;
    trustScore: number;
    label: string;
    color: 'red' | 'orange' | 'yellow' | 'green';
    breakdown: {
      archetype: {
        score: number;
        weight: number;
        contribution: number;
        details: string;
      };
      qa: {
        score: number;
        weight: number;
        contribution: number;
        details: string;
      };
      trust: {
        score: number;
        weight: number;
        contribution: number;
        details: string;
      };
    };
    matchingTraits: string[];
    potentialIssues: string[];
  };
}

/**
 * POST /api/verified-vibe/calculate-compatibility
 *
 * Calculates compatibility score between two users based on:
 * - Archetype compatibility (60%)
 * - Q&A answers alignment (30%)
 * - Trust score factor (10%)
 *
 * Request body:
 * {
 *   user1: VerifiedVibeUser,
 *   user2: VerifiedVibeUser,
 *   user1Answers?: UserAnswers,
 *   user2Answers?: UserAnswers
 * }
 *
 * Response:
 * {
 *   data: {
 *     total: number (0-100),
 *     archetypeScore: number,
 *     qaScore: number,
 *     trustScore: number,
 *     label: string,
 *     color: 'red' | 'orange' | 'yellow' | 'green',
 *     breakdown: { ... },
 *     matchingTraits: string[],
 *     potentialIssues: string[]
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as CalculateCompatibilityRequest;

    // Validate request
    if (!body.user1 || !body.user2) {
      return json(
        { error: 'user1 and user2 are required' },
        { status: 400 }
      );
    }

    if (!body.user1.id || !body.user2.id) {
      return json(
        { error: 'Both users must have valid IDs' },
        { status: 400 }
      );
    }

    // Calculate compatibility
    const compatibility = calculateCompatibility(
      body.user1,
      body.user2,
      body.user1Answers,
      body.user2Answers
    );

    // Get label and color
    const label = getCompatibilityLabel(compatibility.total);
    const color = getCompatibilityColor(compatibility.total);

    const response: CalculateCompatibilityResponse = {
      data: {
        total: compatibility.total,
        archetypeScore: compatibility.archetypeScore,
        qaScore: compatibility.qaScore,
        trustScore: compatibility.trustScore,
        label,
        color,
        breakdown: compatibility.breakdown,
        matchingTraits: compatibility.matchingTraits,
        potentialIssues: compatibility.potentialIssues
      }
    };

    return json(response);
  } catch (error) {
    console.error('Compatibility calculation error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
