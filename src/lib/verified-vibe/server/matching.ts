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
  casual_generous_man: {
    casual_generous_man: 45, hopeless_romantic_man: 30, rebound_healing_man: 35,
    untouched_heart_man: 30, forever_focused_man: 25, traditional_matrimony_man: 20,
    spoiled_casual_woman: 85, hopeless_romantic_woman: 65, rebound_healing_woman: 65,
    untouched_heart_woman: 45, forever_focused_woman: 35, traditional_matrimony_woman: 25
  },
  hopeless_romantic_man: {
    casual_generous_man: 30, hopeless_romantic_man: 50, rebound_healing_man: 40,
    untouched_heart_man: 40, forever_focused_man: 45, traditional_matrimony_man: 50,
    spoiled_casual_woman: 45, hopeless_romantic_woman: 85, rebound_healing_woman: 55,
    untouched_heart_woman: 65, forever_focused_woman: 65, traditional_matrimony_woman: 65
  },
  rebound_healing_man: {
    casual_generous_man: 35, hopeless_romantic_man: 40, rebound_healing_man: 55,
    untouched_heart_man: 35, forever_focused_man: 30, traditional_matrimony_man: 25,
    spoiled_casual_woman: 65, hopeless_romantic_woman: 50, rebound_healing_woman: 85,
    untouched_heart_woman: 65, forever_focused_woman: 40, traditional_matrimony_woman: 35
  },
  untouched_heart_man: {
    casual_generous_man: 30, hopeless_romantic_man: 40, rebound_healing_man: 35,
    untouched_heart_man: 55, forever_focused_man: 50, traditional_matrimony_man: 45,
    spoiled_casual_woman: 35, hopeless_romantic_woman: 65, rebound_healing_woman: 55,
    untouched_heart_woman: 85, forever_focused_woman: 65, traditional_matrimony_woman: 55
  },
  forever_focused_man: {
    casual_generous_man: 25, hopeless_romantic_man: 45, rebound_healing_man: 30,
    untouched_heart_man: 50, forever_focused_man: 60, traditional_matrimony_man: 60,
    spoiled_casual_woman: 30, hopeless_romantic_woman: 65, rebound_healing_woman: 40,
    untouched_heart_woman: 65, forever_focused_woman: 85, traditional_matrimony_woman: 85
  },
  traditional_matrimony_man: {
    casual_generous_man: 20, hopeless_romantic_man: 50, rebound_healing_man: 25,
    untouched_heart_man: 45, forever_focused_man: 60, traditional_matrimony_man: 65,
    spoiled_casual_woman: 25, hopeless_romantic_woman: 65, rebound_healing_woman: 35,
    untouched_heart_woman: 55, forever_focused_woman: 85, traditional_matrimony_woman: 85
  },
  spoiled_casual_woman: {
    casual_generous_man: 85, hopeless_romantic_man: 45, rebound_healing_man: 65,
    untouched_heart_man: 35, forever_focused_man: 30, traditional_matrimony_man: 25,
    spoiled_casual_woman: 55, hopeless_romantic_woman: 45, rebound_healing_woman: 50,
    untouched_heart_woman: 40, forever_focused_woman: 30, traditional_matrimony_woman: 25
  },
  hopeless_romantic_woman: {
    casual_generous_man: 65, hopeless_romantic_man: 85, rebound_healing_man: 50,
    untouched_heart_man: 65, forever_focused_man: 65, traditional_matrimony_man: 65,
    spoiled_casual_woman: 45, hopeless_romantic_woman: 60, rebound_healing_woman: 55,
    untouched_heart_woman: 55, forever_focused_woman: 50, traditional_matrimony_woman: 50
  },
  rebound_healing_woman: {
    casual_generous_man: 65, hopeless_romantic_man: 55, rebound_healing_man: 85,
    untouched_heart_man: 55, forever_focused_man: 40, traditional_matrimony_man: 35,
    spoiled_casual_woman: 50, hopeless_romantic_woman: 55, rebound_healing_woman: 60,
    untouched_heart_woman: 50, forever_focused_woman: 40, traditional_matrimony_woman: 35
  },
  untouched_heart_woman: {
    casual_generous_man: 45, hopeless_romantic_man: 65, rebound_healing_man: 65,
    untouched_heart_man: 85, forever_focused_man: 65, traditional_matrimony_man: 55,
    spoiled_casual_woman: 40, hopeless_romantic_woman: 55, rebound_healing_woman: 50,
    untouched_heart_woman: 60, forever_focused_woman: 55, traditional_matrimony_woman: 50
  },
  forever_focused_woman: {
    casual_generous_man: 35, hopeless_romantic_man: 65, rebound_healing_man: 40,
    untouched_heart_man: 65, forever_focused_man: 85, traditional_matrimony_man: 85,
    spoiled_casual_woman: 30, hopeless_romantic_woman: 50, rebound_healing_woman: 40,
    untouched_heart_woman: 55, forever_focused_woman: 65, traditional_matrimony_woman: 65
  },
  traditional_matrimony_woman: {
    casual_generous_man: 25, hopeless_romantic_man: 65, rebound_healing_man: 35,
    untouched_heart_man: 55, forever_focused_man: 85, traditional_matrimony_man: 85,
    spoiled_casual_woman: 25, hopeless_romantic_woman: 50, rebound_healing_woman: 35,
    untouched_heart_woman: 50, forever_focused_woman: 65, traditional_matrimony_woman: 70
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

  const traitMappings: Record<Archetype, string[]> = {
    casual_generous_man: ['spontaneous', 'adventurous', 'generous', 'fun-loving'],
    hopeless_romantic_man: ['romantic', 'emotional', 'expressive', 'committed'],
    rebound_healing_man: ['open', 'self-aware', 'growing', 'present'],
    untouched_heart_man: ['genuine', 'careful', 'sincere', 'loyal'],
    forever_focused_man: ['ambitious', 'stable', 'dependable', 'goal-oriented'],
    traditional_matrimony_man: ['family-oriented', 'stable', 'principled', 'responsible'],
    spoiled_casual_woman: ['confident', 'social', 'enjoys luxury', 'fun-loving'],
    hopeless_romantic_woman: ['romantic', 'expressive', 'emotional', 'committed'],
    rebound_healing_woman: ['open', 'resilient', 'self-aware', 'growing'],
    untouched_heart_woman: ['sincere', 'careful', 'genuine', 'loyal'],
    forever_focused_woman: ['ambitious', 'stable', 'goal-oriented', 'dependable'],
    traditional_matrimony_woman: ['family-oriented', 'principled', 'stable', 'responsible']
  };

  const traits1 = traitMappings[archetype1] || [];
  const traits2 = traitMappings[archetype2] || [];
  const commonTraits = traits1.filter((t) => traits2.includes(t));

  if (commonTraits.length > 0) {
    traits.push(`Both value being ${commonTraits.join(' and ')}`);
  }

  const score = ARCHETYPE_COMPATIBILITY[archetype1]?.[archetype2] ?? 45;
  if (score >= 80) traits.push('Highly complementary energy');
  else if (score >= 65) traits.push('Good potential for connection');

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

  const score = ARCHETYPE_COMPATIBILITY[archetype1]?.[archetype2] ?? 45;

  if (score < 35) {
    issues.push('Very different relationship expectations');
  } else if (score < 50) {
    issues.push('May need to align on relationship goals early');
  }

  if (
    (archetype1 === 'casual_generous_man' && archetype2 === 'traditional_matrimony_woman') ||
    (archetype1 === 'traditional_matrimony_woman' && archetype2 === 'casual_generous_man') ||
    (archetype1 === 'traditional_matrimony_man' && archetype2 === 'spoiled_casual_woman') ||
    (archetype1 === 'spoiled_casual_woman' && archetype2 === 'traditional_matrimony_man')
  ) {
    issues.push('Significant lifestyle differences to navigate');
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
