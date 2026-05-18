/**
 * Verified Vibe — Compatibility Scoring
 *
 * Calculates compatibility scores between users based on archetype matching
 * and Q&A answers. Considers trust scores in the matching algorithm.
 *
 * Compatibility Score Breakdown:
 * - Archetype Compatibility: 60% (based on archetype matching traits)
 * - Q&A Answers Alignment: 30% (based on spending/lifestyle answers)
 * - Trust Score Factor: 10% (considers both users' trust scores)
 *
 * Score Range: 0-100
 */

import type { Archetype, VerifiedVibeUser } from '../types';

export interface CompatibilityScore {
  total: number;
  archetypeScore: number;
  qaScore: number;
  trustScore: number;
  breakdown: {
    archetype: CompatibilityDetail;
    qa: CompatibilityDetail;
    trust: CompatibilityDetail;
  };
  matchingTraits: string[];
  potentialIssues: string[];
}

export interface CompatibilityDetail {
  score: number;
  weight: number;
  contribution: number;
  details: string;
}

export interface UserAnswers {
  spending?: string;
  lifestyle?: string;
  values?: string;
  [key: string]: any;
}

/**
 * Archetype compatibility matrix
 * Higher values indicate better compatibility
 */
const ARCHETYPE_COMPATIBILITY: Record<Archetype, Record<Archetype, number>> = {
  casual_man: {
    casual_man: 50,
    marriage_minded_man: 30,
    spoilt_woman: 70,
    safety_first_woman: 40
  },
  marriage_minded_man: {
    casual_man: 30,
    marriage_minded_man: 60,
    spoilt_woman: 50,
    safety_first_woman: 80
  },
  spoilt_woman: {
    casual_man: 70,
    marriage_minded_man: 50,
    spoilt_woman: 60,
    safety_first_woman: 40
  },
  safety_first_woman: {
    casual_man: 40,
    marriage_minded_man: 80,
    spoilt_woman: 40,
    safety_first_woman: 70
  }
};

/**
 * Calculate compatibility score between two users
 *
 * @param user1 - First user profile
 * @param user2 - Second user profile
 * @param user1Answers - User 1's Q&A answers
 * @param user2Answers - User 2's Q&A answers
 * @returns Compatibility score breakdown
 */
export function calculateCompatibility(
  user1: VerifiedVibeUser,
  user2: VerifiedVibeUser,
  user1Answers?: UserAnswers,
  user2Answers?: UserAnswers
): CompatibilityScore {
  const ARCHETYPE_WEIGHT = 0.6;
  const QA_WEIGHT = 0.3;
  const TRUST_WEIGHT = 0.1;

  // Calculate archetype compatibility
  const archetypeScore = calculateArchetypeCompatibility(user1.archetype, user2.archetype);
  const archetypeContribution = archetypeScore * ARCHETYPE_WEIGHT;

  // Calculate Q&A compatibility
  const qaScore = calculateQACompatibility(user1Answers, user2Answers);
  const qaContribution = qaScore * QA_WEIGHT;

  // Calculate trust score factor
  const trustScore = calculateTrustFactor(user1.trustScore, user2.trustScore);
  const trustContribution = trustScore * TRUST_WEIGHT;

  // Calculate total score
  const total = Math.round(archetypeContribution + qaContribution + trustContribution);

  // Get matching traits and potential issues
  const matchingTraits = getMatchingTraits(user1.archetype, user2.archetype);
  const potentialIssues = getPotentialIssues(user1.archetype, user2.archetype);

  return {
    total: Math.min(100, Math.max(0, total)),
    archetypeScore,
    qaScore,
    trustScore,
    breakdown: {
      archetype: {
        score: archetypeScore,
        weight: ARCHETYPE_WEIGHT,
        contribution: archetypeContribution,
        details: `Archetype compatibility between ${user1.archetype} and ${user2.archetype}`
      },
      qa: {
        score: qaScore,
        weight: QA_WEIGHT,
        contribution: qaContribution,
        details: 'Alignment based on spending habits, lifestyle, and values'
      },
      trust: {
        score: trustScore,
        weight: TRUST_WEIGHT,
        contribution: trustContribution,
        details: `Trust factor based on verification scores (${user1.trustScore} & ${user2.trustScore})`
      }
    },
    matchingTraits,
    potentialIssues
  };
}

/**
 * Calculate archetype compatibility score
 *
 * @param archetype1 - First user's archetype
 * @param archetype2 - Second user's archetype
 * @returns Compatibility score 0-100
 */
function calculateArchetypeCompatibility(archetype1: Archetype, archetype2: Archetype): number {
  const score = ARCHETYPE_COMPATIBILITY[archetype1]?.[archetype2] ?? 50;
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate Q&A compatibility score
 *
 * @param answers1 - User 1's answers
 * @param answers2 - User 2's answers
 * @returns Compatibility score 0-100
 */
function calculateQACompatibility(answers1?: UserAnswers, answers2?: UserAnswers): number {
  // If either user hasn't answered Q&A, return neutral score
  if (!answers1 || !answers2) {
    return 50;
  }

  let alignmentScore = 0;
  let totalFactors = 0;

  // Check spending alignment
  if (answers1.spending && answers2.spending) {
    const spendingAlignment = compareAnswers(answers1.spending, answers2.spending);
    alignmentScore += spendingAlignment;
    totalFactors++;
  }

  // Check lifestyle alignment
  if (answers1.lifestyle && answers2.lifestyle) {
    const lifestyleAlignment = compareAnswers(answers1.lifestyle, answers2.lifestyle);
    alignmentScore += lifestyleAlignment;
    totalFactors++;
  }

  // Check values alignment
  if (answers1.values && answers2.values) {
    const valuesAlignment = compareAnswers(answers1.values, answers2.values);
    alignmentScore += valuesAlignment;
    totalFactors++;
  }

  // If no factors to compare, return neutral score
  if (totalFactors === 0) {
    return 50;
  }

  return Math.round(alignmentScore / totalFactors);
}

/**
 * Compare two answers for alignment
 *
 * @param answer1 - First answer
 * @param answer2 - Second answer
 * @returns Alignment score 0-100
 */
function compareAnswers(answer1: string, answer2: string): number {
  // Normalize answers
  const normalized1 = answer1.toLowerCase().trim();
  const normalized2 = answer2.toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) {
    return 100;
  }

  // Check for partial matches or similar keywords
  const keywords1 = normalized1.split(/\s+/);
  const keywords2 = normalized2.split(/\s+/);

  const commonKeywords = keywords1.filter((kw) => keywords2.includes(kw));
  const similarity = (commonKeywords.length / Math.max(keywords1.length, keywords2.length)) * 100;

  // If significant overlap, consider it a good match
  if (similarity >= 50) {
    return Math.round(similarity);
  }

  // Otherwise, return lower score
  return Math.max(20, Math.round(similarity / 2));
}

/**
 * Calculate trust factor
 *
 * @param trustScore1 - User 1's trust score
 * @param trustScore2 - User 2's trust score
 * @returns Trust factor 0-100
 */
function calculateTrustFactor(trustScore1: number, trustScore2: number): number {
  // Average of both trust scores
  const averageTrust = (trustScore1 + trustScore2) / 2;

  // Boost compatibility if both users have high trust scores
  if (trustScore1 >= 75 && trustScore2 >= 75) {
    return Math.min(100, averageTrust + 10);
  }

  // Reduce compatibility if either user has low trust score
  if (trustScore1 < 25 || trustScore2 < 25) {
    return Math.max(0, averageTrust - 15);
  }

  return Math.round(averageTrust);
}

/**
 * Get matching traits between two archetypes
 *
 * @param archetype1 - First archetype
 * @param archetype2 - Second archetype
 * @returns Array of matching trait descriptions
 */
function getMatchingTraits(archetype1: Archetype, archetype2: Archetype): string[] {
  const traits: string[] = [];

  // Define trait mappings for each archetype
  const traitMappings: Record<Archetype, string[]> = {
    casual_man: ['spontaneous', 'adventurous', 'independent', 'fun-loving'],
    marriage_minded_man: ['committed', 'stable', 'family-oriented', 'responsible'],
    spoilt_woman: ['confident', 'ambitious', 'social', 'enjoys luxury'],
    safety_first_woman: ['cautious', 'thoughtful', 'values security', 'seeks stability']
  };

  const traits1 = traitMappings[archetype1] || [];
  const traits2 = traitMappings[archetype2] || [];

  // Find common traits
  const commonTraits = traits1.filter((t) => traits2.includes(t));

  if (commonTraits.length > 0) {
    traits.push(`Both ${commonTraits.join(' and ')}`);
  }

  // Add complementary traits
  if (
    (archetype1 === 'casual_man' && archetype2 === 'spoilt_woman') ||
    (archetype1 === 'spoilt_woman' && archetype2 === 'casual_man')
  ) {
    traits.push('Complementary energy and interests');
  }

  if (
    (archetype1 === 'marriage_minded_man' && archetype2 === 'safety_first_woman') ||
    (archetype1 === 'safety_first_woman' && archetype2 === 'marriage_minded_man')
  ) {
    traits.push('Aligned life goals and values');
  }

  return traits.length > 0 ? traits : ['Potential for connection'];
}

/**
 * Get potential issues between two archetypes
 *
 * @param archetype1 - First archetype
 * @param archetype2 - Second archetype
 * @returns Array of potential issue descriptions
 */
function getPotentialIssues(archetype1: Archetype, archetype2: Archetype): string[] {
  const issues: string[] = [];

  // Check for conflicting archetypes
  if (
    (archetype1 === 'casual_man' && archetype2 === 'safety_first_woman') ||
    (archetype1 === 'safety_first_woman' && archetype2 === 'casual_man')
  ) {
    issues.push('Different relationship expectations');
  }

  if (
    (archetype1 === 'marriage_minded_man' && archetype2 === 'spoilt_woman') ||
    (archetype1 === 'spoilt_woman' && archetype2 === 'marriage_minded_man')
  ) {
    issues.push('Potential lifestyle differences');
  }

  // Check for same archetype (can be good or challenging)
  if (archetype1 === archetype2) {
    if (archetype1 === 'casual_man' || archetype1 === 'spoilt_woman') {
      issues.push('May need to establish commitment expectations');
    }
  }

  return issues;
}

/**
 * Get compatibility label
 *
 * @param score - Compatibility score 0-100
 * @returns Human-readable label
 */
export function getCompatibilityLabel(score: number): string {
  if (score >= 85) {
    return 'Excellent Match';
  }
  if (score >= 70) {
    return 'Great Match';
  }
  if (score >= 55) {
    return 'Good Match';
  }
  if (score >= 40) {
    return 'Possible Match';
  }
  if (score >= 25) {
    return 'Low Compatibility';
  }
  return 'Very Low Compatibility';
}

/**
 * Get compatibility color
 *
 * @param score - Compatibility score 0-100
 * @returns Color code: 'red' | 'orange' | 'yellow' | 'green'
 */
export function getCompatibilityColor(score: number): 'red' | 'orange' | 'yellow' | 'green' {
  if (score >= 75) {
    return 'green';
  }
  if (score >= 55) {
    return 'yellow';
  }
  if (score >= 35) {
    return 'orange';
  }
  return 'red';
}

/**
 * Get compatibility percentage for visual representation
 *
 * @param score - Compatibility score 0-100
 * @returns Percentage string (e.g., "75%")
 */
export function getCompatibilityPercentage(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Check if compatibility score is above threshold for matching
 *
 * @param score - Compatibility score 0-100
 * @param threshold - Minimum score threshold (default: 40)
 * @returns True if score meets threshold
 */
export function isCompatibleMatch(score: number, threshold: number = 40): boolean {
  return score >= threshold;
}

/**
 * Sort profiles by compatibility score
 *
 * @param profiles - Array of profiles with compatibility scores
 * @param descending - Sort in descending order (default: true)
 * @returns Sorted profiles
 */
export function sortByCompatibility(
  profiles: Array<{ compatibilityScore: number; [key: string]: any }>,
  descending: boolean = true
): Array<{ compatibilityScore: number; [key: string]: any }> {
  return [...profiles].sort((a, b) => {
    const diff = a.compatibilityScore - b.compatibilityScore;
    return descending ? -diff : diff;
  });
}
