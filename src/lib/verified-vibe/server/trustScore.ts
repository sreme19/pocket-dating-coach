/**
 * Verified Vibe — Trust Score Calculation
 *
 * Calculates a user's trust score based on all verification steps.
 * Each step contributes 25% to the final score (0-100).
 *
 * Trust Score Breakdown:
 * - ID Verification: 25% (confidence score from ID extraction)
 * - Liveness Check: 25% (confidence score from face comparison)
 * - Photo Consistency: 25% (confidence score from photo analysis)
 * - Q&A Completion: 25% (binary: 0 if incomplete, 100 if complete)
 */

import type { VerificationRecord } from '../types';

export interface TrustScoreBreakdown {
  total: number;
  idScore: number;
  livenessScore: number;
  photoScore: number;
  qaScore: number;
  details: {
    id: TrustScoreDetail;
    liveness: TrustScoreDetail;
    photos: TrustScoreDetail;
    qa: TrustScoreDetail;
  };
}

export interface TrustScoreDetail {
  score: number;
  weight: number;
  contribution: number;
  status: 'pending' | 'completed' | 'failed';
  confidenceScore?: number;
}

/**
 * Calculate trust score from verification records
 *
 * @param verificationRecords - Array of verification records (one per step)
 * @returns Trust score breakdown with total and per-step scores
 */
export function calculateTrustScore(verificationRecords: VerificationRecord[]): TrustScoreBreakdown {
  const WEIGHT = 0.25; // Each step is 25%

  // Find records for each step
  const idRecord = verificationRecords.find((r) => r.step === 'id');
  const livenessRecord = verificationRecords.find((r) => r.step === 'liveness');
  const photoRecord = verificationRecords.find((r) => r.step === 'photos');
  const qaRecord = verificationRecords.find((r) => r.step === 'spending_or_qa');

  // Calculate score for each step
  const idScore = calculateStepScore(idRecord);
  const livenessScore = calculateStepScore(livenessRecord);
  const photoScore = calculateStepScore(photoRecord);
  const qaScore = calculateStepScore(qaRecord);

  // Calculate weighted contributions
  const idContribution = idScore * WEIGHT;
  const livenessContribution = livenessScore * WEIGHT;
  const photoContribution = photoScore * WEIGHT;
  const qaContribution = qaScore * WEIGHT;

  // Calculate total score
  const total = Math.round(
    idContribution + livenessContribution + photoContribution + qaContribution
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    idScore,
    livenessScore,
    photoScore,
    qaScore,
    details: {
      id: {
        score: idScore,
        weight: WEIGHT,
        contribution: idContribution,
        status: idRecord?.status || 'pending',
        confidenceScore: idRecord?.data?.confidenceScore
      },
      liveness: {
        score: livenessScore,
        weight: WEIGHT,
        contribution: livenessContribution,
        status: livenessRecord?.status || 'pending',
        confidenceScore: livenessRecord?.data?.confidenceScore
      },
      photos: {
        score: photoScore,
        weight: WEIGHT,
        contribution: photoContribution,
        status: photoRecord?.status || 'pending',
        confidenceScore: photoRecord?.data?.confidenceScore
      },
      qa: {
        score: qaScore,
        weight: WEIGHT,
        contribution: qaContribution,
        status: qaRecord?.status || 'pending'
      }
    }
  };
}

/**
 * Calculate score for a single verification step
 *
 * @param record - Verification record for the step
 * @returns Score 0-100
 */
function calculateStepScore(record: VerificationRecord | undefined): number {
  if (!record) {
    return 0; // Not started
  }

  if (record.status === 'failed') {
    return 0; // Failed verification
  }

  if (record.status === 'pending') {
    return 0; // Not completed
  }

  if (record.status === 'under_review') {
    return 0; // Score withheld pending manual review (e.g. low-confidence selfie)
  }

  // For completed records, use confidence score if available
  if (record.data?.confidenceScore !== undefined) {
    return Math.round(record.data.confidenceScore);
  }

  // For Q&A step, just check if completed
  if (record.step === 'spending_or_qa' && record.status === 'completed') {
    return 100;
  }

  // Default to 100 if completed but no confidence score
  return 100;
}

/**
 * Get color coding for trust score
 *
 * @param score - Trust score 0-100
 * @returns Color code: 'red' | 'yellow' | 'green'
 */
export function getTrustScoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score < 50) {
    return 'red';
  }
  if (score < 75) {
    return 'yellow';
  }
  return 'green';
}

/**
 * Get trust score label
 *
 * @param score - Trust score 0-100
 * @returns Human-readable label
 */
export function getTrustScoreLabel(score: number): string {
  if (score === 0) {
    return 'Not Verified';
  }
  if (score < 25) {
    return 'Minimal Trust';
  }
  if (score < 50) {
    return 'Low Trust';
  }
  if (score < 75) {
    return 'Medium Trust';
  }
  if (score < 100) {
    return 'High Trust';
  }
  return 'Fully Verified';
}

/**
 * Get trust score percentage for visual representation
 *
 * @param score - Trust score 0-100
 * @returns Percentage string (e.g., "75%")
 */
export function getTrustScorePercentage(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Check if user has completed all verification steps
 *
 * @param verificationRecords - Array of verification records
 * @returns True if all steps are completed
 */
export function isFullyVerified(verificationRecords: VerificationRecord[]): boolean {
  const steps: Array<'id' | 'liveness' | 'photos' | 'spending_or_qa'> = [
    'id',
    'liveness',
    'photos',
    'spending_or_qa'
  ];

  return steps.every((step) => {
    const record = verificationRecords.find((r) => r.step === step);
    return record && record.status === 'completed';
  });
}

/**
 * Get next incomplete verification step
 *
 * @param verificationRecords - Array of verification records
 * @returns Next step to complete, or null if all complete
 */
export function getNextIncompleteStep(
  verificationRecords: VerificationRecord[]
): 'id' | 'liveness' | 'photos' | 'spending_or_qa' | null {
  const steps: Array<'id' | 'liveness' | 'photos' | 'spending_or_qa'> = [
    'id',
    'liveness',
    'photos',
    'spending_or_qa'
  ];

  for (const step of steps) {
    const record = verificationRecords.find((r) => r.step === step);
    if (!record || record.status !== 'completed') {
      return step;
    }
  }

  return null;
}

// ── Casual Generous archetype ────────────────────────────────────────────────

export interface CGTrustSubscores {
  identity: number;         // ID + liveness average
  lifestyleDepth: number;   // photo consistency
  generositySignals: number; // spending proof
  emotionalSafety: number;  // behavioural — always 0 until messaging data exists
  socialLegitimacy: number; // proof connections — 0 until connected
}

/**
 * Map generic verification records onto the 5 Casual Generous subscores.
 * Scores that require live behavioural data (emotionalSafety, socialLegitimacy)
 * are held at 0 until those pipelines exist.
 */
export function calculateCGSubscores(verificationRecords: VerificationRecord[]): CGTrustSubscores {
  const { idScore, livenessScore, photoScore, qaScore } = calculateTrustScore(verificationRecords);
  return {
    identity: Math.round((idScore + livenessScore) / 2),
    lifestyleDepth: photoScore,
    generositySignals: qaScore,
    emotionalSafety: 0,
    socialLegitimacy: 0,
  };
}

/**
 * Weighted CG total — different weight distribution than the generic score.
 * Identity 20% · Lifestyle 25% · Generosity 30% · Safety 15% · Social 10%
 */
export function calculateCGTotal(subscores: CGTrustSubscores): number {
  return Math.min(100, Math.round(
    subscores.identity        * 0.20 +
    subscores.lifestyleDepth  * 0.25 +
    subscores.generositySignals * 0.30 +
    subscores.emotionalSafety * 0.15 +
    subscores.socialLegitimacy * 0.10
  ));
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get verification progress percentage
 *
 * @param verificationRecords - Array of verification records
 * @returns Progress 0-100
 */
export function getVerificationProgress(verificationRecords: VerificationRecord[]): number {
  const steps: Array<'id' | 'liveness' | 'photos' | 'spending_or_qa'> = [
    'id',
    'liveness',
    'photos',
    'spending_or_qa'
  ];

  const completedCount = steps.filter((step) => {
    const record = verificationRecords.find((r) => r.step === step);
    return record && record.status === 'completed';
  }).length;

  return Math.round((completedCount / steps.length) * 100);
}
