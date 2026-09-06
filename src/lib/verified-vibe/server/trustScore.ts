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
  lifestyleSignals: number; // spending proof
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
    lifestyleSignals: qaScore,
    emotionalSafety: 0,
    socialLegitimacy: 0,
  };
}

/**
 * Weighted CG total — different weight distribution than the generic score.
 * Identity 20% · Lifestyle depth 25% · Lifestyle signals 30% · Safety 15% · Social 10%
 *
 * NOTE: `lifestyleSignals` was named `generositySignals` until 2026-07-29. Pure
 * rename — weights are unchanged and computed totals are identical. The old name
 * described a man's spend as generosity toward a partner, which is the framing App
 * Review cited under Guideline 1.1.4. Do not reintroduce it.
 */
export function calculateCGTotal(subscores: CGTrustSubscores): number {
  return Math.min(100, Math.round(
    subscores.identity        * 0.20 +
    subscores.lifestyleDepth  * 0.25 +
    subscores.lifestyleSignals * 0.30 +
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

/**
 * The trust score shown on a Discover card.
 *
 * Reads the stored, cohort-normalized score and nothing else. This used to sum
 * 25 points per completed verification ROW, which produced two separate bugs:
 * a member who re-completed a step was counted twice and rendered as "125%"
 * (clamped in 6b8f3a42), and — the reason this function now does almost
 * nothing — the number disagreed with every other screen showing it. Measured
 * 2026-09-06 against live data: 123 of 146 members read a different trust
 * score on their card than on their detail view, by up to 20 points.
 *
 * There were four formulas. The card scored 25/step; the detail view
 * (public-profile) scored core*20 + proof*4; a member's own profile
 * (mobile/lib/api.dart) scored weighted steps plus per-category proof points;
 * and trustScore.ts weighted four steps by confidence. None matched
 * verified_vibe_users.trust_score, which trust-recompute.ts calls "the SINGLE
 * source of truth" and trust-normalize.ts records as the product decision:
 * the normalized value IS the trust score. It is what the matchmaker, the
 * Bestie flags, the pool registry and admin have always read.
 *
 * So the fix is not a better formula here. It is no formula here.
 *
 * Kept as a named function rather than inlining `p.trust_score` so the rule has
 * one place to be tested, and so the next person who wants to "just adjust the
 * card score" finds this note instead of an expression.
 */
export function displayTrustScore(profile: { trust_score?: number | null }): number {
  const stored = profile?.trust_score;
  if (typeof stored !== 'number' || Number.isNaN(stored)) return 0;
  return Math.min(100, Math.max(0, Math.round(stored)));
}
