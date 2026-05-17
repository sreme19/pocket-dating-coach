import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { calculateTrustScore, getTrustScoreColor, getTrustScoreLabel } from '$lib/verified-vibe/server/trustScore';
import type { VerificationRecord } from '$lib/verified-vibe/types';

interface CalculateTrustScoreRequest {
  userId: string;
  verificationRecords: VerificationRecord[];
}

interface CalculateTrustScoreResponse {
  data: {
    total: number;
    idScore: number;
    livenessScore: number;
    photoScore: number;
    qaScore: number;
    color: 'red' | 'yellow' | 'green';
    label: string;
    details: {
      id: {
        score: number;
        weight: number;
        contribution: number;
        status: string;
        confidenceScore?: number;
      };
      liveness: {
        score: number;
        weight: number;
        contribution: number;
        status: string;
        confidenceScore?: number;
      };
      photos: {
        score: number;
        weight: number;
        contribution: number;
        status: string;
        confidenceScore?: number;
      };
      qa: {
        score: number;
        weight: number;
        contribution: number;
        status: string;
      };
    };
  };
}

/**
 * POST /api/verified-vibe/calculate-trust-score
 *
 * Calculates a user's trust score based on all verification steps.
 * Each step contributes 25% to the final score (0-100).
 *
 * Request body:
 * {
 *   userId: string,
 *   verificationRecords: VerificationRecord[]
 * }
 *
 * Response:
 * {
 *   data: {
 *     total: number (0-100),
 *     idScore: number,
 *     livenessScore: number,
 *     photoScore: number,
 *     qaScore: number,
 *     color: 'red' | 'yellow' | 'green',
 *     label: string,
 *     details: { ... }
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as CalculateTrustScoreRequest;

    // Validate request
    if (!body.userId) {
      return json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!body.verificationRecords || !Array.isArray(body.verificationRecords)) {
      return json(
        { error: 'verificationRecords array is required' },
        { status: 400 }
      );
    }

    // Calculate trust score
    const breakdown = calculateTrustScore(body.verificationRecords);

    // Get color and label
    const color = getTrustScoreColor(breakdown.total);
    const label = getTrustScoreLabel(breakdown.total);

    const response: CalculateTrustScoreResponse = {
      data: {
        total: breakdown.total,
        idScore: breakdown.idScore,
        livenessScore: breakdown.livenessScore,
        photoScore: breakdown.photoScore,
        qaScore: breakdown.qaScore,
        color,
        label,
        details: breakdown.details
      }
    };

    return json(response);
  } catch (error) {
    console.error('Trust score calculation error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
