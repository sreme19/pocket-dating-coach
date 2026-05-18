import { describe, it, expect } from 'vitest';
import {
  calculateCompatibility,
  calculateArchetypeCompatibility,
  getCompatibilityLabel,
  getCompatibilityColor,
  getCompatibilityPercentage,
  isCompatibleMatch,
  sortByCompatibility,
  type CompatibilityScore
} from './matching';
import type { VerifiedVibeUser } from '../types';

// Mock user data
const mockUser1: VerifiedVibeUser = {
  id: 'user1',
  gender: 'man',
  archetype: 'marriage_minded_man',
  firstName: 'John',
  age: 28,
  city: 'New York',
  avatar: 'https://example.com/avatar1.jpg',
  about: 'Looking for something serious',
  looking: 'Long-term relationship',
  trustScore: 85,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockUser2: VerifiedVibeUser = {
  id: 'user2',
  gender: 'woman',
  archetype: 'safety_first_woman',
  firstName: 'Jane',
  age: 26,
  city: 'New York',
  avatar: 'https://example.com/avatar2.jpg',
  about: 'Seeking genuine connection',
  looking: 'Serious relationship',
  trustScore: 80,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockUser3: VerifiedVibeUser = {
  id: 'user3',
  gender: 'man',
  archetype: 'casual_man',
  firstName: 'Mike',
  age: 30,
  city: 'Los Angeles',
  avatar: 'https://example.com/avatar3.jpg',
  about: 'Just having fun',
  looking: 'Casual dating',
  trustScore: 45,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockUser4: VerifiedVibeUser = {
  id: 'user4',
  gender: 'woman',
  archetype: 'spoilt_woman',
  firstName: 'Sarah',
  age: 25,
  city: 'Los Angeles',
  avatar: 'https://example.com/avatar4.jpg',
  about: 'Ambitious and independent',
  looking: 'Fun and adventure',
  trustScore: 70,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('Compatibility Scoring', () => {
  describe('calculateCompatibility', () => {
    it('should calculate compatibility between two users', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.archetypeScore).toBeGreaterThanOrEqual(0);
      expect(result.archetypeScore).toBeLessThanOrEqual(100);
      expect(result.qaScore).toBeGreaterThanOrEqual(0);
      expect(result.qaScore).toBeLessThanOrEqual(100);
      expect(result.trustScore).toBeGreaterThanOrEqual(0);
      expect(result.trustScore).toBeLessThanOrEqual(100);
    });

    it('should have correct breakdown structure', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.archetype).toBeDefined();
      expect(result.breakdown.qa).toBeDefined();
      expect(result.breakdown.trust).toBeDefined();

      expect(result.breakdown.archetype.weight).toBe(0.6);
      expect(result.breakdown.qa.weight).toBe(0.3);
      expect(result.breakdown.trust.weight).toBe(0.1);
    });

    it('should calculate high compatibility for aligned archetypes', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      // Marriage-minded man + Safety-first woman should have high compatibility
      expect(result.total).toBeGreaterThan(50);
      expect(result.archetypeScore).toBeGreaterThan(50);
    });

    it('should calculate lower compatibility for conflicting archetypes', () => {
      const result = calculateCompatibility(mockUser1, mockUser3);

      // Marriage-minded man + Casual man should have lower compatibility
      expect(result.total).toBeLessThan(70);
    });

    it('should include matching traits', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result.matchingTraits).toBeDefined();
      expect(Array.isArray(result.matchingTraits)).toBe(true);
      expect(result.matchingTraits.length).toBeGreaterThan(0);
    });

    it('should include potential issues', () => {
      const result = calculateCompatibility(mockUser1, mockUser3);

      expect(result.potentialIssues).toBeDefined();
      expect(Array.isArray(result.potentialIssues)).toBe(true);
    });

    it('should consider Q&A answers when provided', () => {
      const answers1 = {
        spending: 'moderate',
        lifestyle: 'family-oriented',
        values: 'honesty'
      };

      const answers2 = {
        spending: 'moderate',
        lifestyle: 'family-oriented',
        values: 'honesty'
      };

      const result = calculateCompatibility(mockUser1, mockUser2, answers1, answers2);

      expect(result.qaScore).toBeGreaterThan(50);
    });

    it('should handle missing Q&A answers gracefully', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result.qaScore).toBe(50); // Neutral score when no answers provided
    });

    it('should boost compatibility for high trust scores', () => {
      const highTrustUser1 = { ...mockUser1, trustScore: 95 };
      const highTrustUser2 = { ...mockUser2, trustScore: 90 };

      const result = calculateCompatibility(highTrustUser1, highTrustUser2);

      expect(result.trustScore).toBeGreaterThan(80);
    });

    it('should reduce compatibility for low trust scores', () => {
      const lowTrustUser1 = { ...mockUser1, trustScore: 20 };
      const lowTrustUser2 = { ...mockUser2, trustScore: 30 };

      const result = calculateCompatibility(lowTrustUser1, lowTrustUser2);

      expect(result.trustScore).toBeLessThan(40);
    });

    it('should calculate casual man + spoilt woman as high compatibility', () => {
      const result = calculateCompatibility(mockUser3, mockUser4);

      expect(result.archetypeScore).toBeGreaterThan(60);
    });

    it('should calculate same archetype compatibility', () => {
      const sameArchetype1 = { ...mockUser1 };
      const sameArchetype2 = { ...mockUser1, id: 'user1b' };

      const result = calculateCompatibility(sameArchetype1, sameArchetype2);

      expect(result.archetypeScore).toBeGreaterThan(40);
    });

    it('should weight contributions correctly', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      const archetypeContribution = result.breakdown.archetype.contribution;
      const qaContribution = result.breakdown.qa.contribution;
      const trustContribution = result.breakdown.trust.contribution;

      const total = archetypeContribution + qaContribution + trustContribution;

      expect(Math.round(total)).toBe(result.total);
    });
  });

  describe('getCompatibilityLabel', () => {
    it('should return "Excellent Match" for score >= 85', () => {
      expect(getCompatibilityLabel(85)).toBe('Excellent Match');
      expect(getCompatibilityLabel(95)).toBe('Excellent Match');
      expect(getCompatibilityLabel(100)).toBe('Excellent Match');
    });

    it('should return "Great Match" for score 70-84', () => {
      expect(getCompatibilityLabel(70)).toBe('Great Match');
      expect(getCompatibilityLabel(75)).toBe('Great Match');
      expect(getCompatibilityLabel(84)).toBe('Great Match');
    });

    it('should return "Good Match" for score 55-69', () => {
      expect(getCompatibilityLabel(55)).toBe('Good Match');
      expect(getCompatibilityLabel(60)).toBe('Good Match');
      expect(getCompatibilityLabel(69)).toBe('Good Match');
    });

    it('should return "Possible Match" for score 40-54', () => {
      expect(getCompatibilityLabel(40)).toBe('Possible Match');
      expect(getCompatibilityLabel(45)).toBe('Possible Match');
      expect(getCompatibilityLabel(54)).toBe('Possible Match');
    });

    it('should return "Low Compatibility" for score 25-39', () => {
      expect(getCompatibilityLabel(25)).toBe('Low Compatibility');
      expect(getCompatibilityLabel(30)).toBe('Low Compatibility');
      expect(getCompatibilityLabel(39)).toBe('Low Compatibility');
    });

    it('should return "Very Low Compatibility" for score < 25', () => {
      expect(getCompatibilityLabel(0)).toBe('Very Low Compatibility');
      expect(getCompatibilityLabel(10)).toBe('Very Low Compatibility');
      expect(getCompatibilityLabel(24)).toBe('Very Low Compatibility');
    });
  });

  describe('getCompatibilityColor', () => {
    it('should return "green" for score >= 75', () => {
      expect(getCompatibilityColor(75)).toBe('green');
      expect(getCompatibilityColor(90)).toBe('green');
      expect(getCompatibilityColor(100)).toBe('green');
    });

    it('should return "yellow" for score 55-74', () => {
      expect(getCompatibilityColor(55)).toBe('yellow');
      expect(getCompatibilityColor(65)).toBe('yellow');
      expect(getCompatibilityColor(74)).toBe('yellow');
    });

    it('should return "orange" for score 35-54', () => {
      expect(getCompatibilityColor(35)).toBe('orange');
      expect(getCompatibilityColor(45)).toBe('orange');
      expect(getCompatibilityColor(54)).toBe('orange');
    });

    it('should return "red" for score < 35', () => {
      expect(getCompatibilityColor(0)).toBe('red');
      expect(getCompatibilityColor(20)).toBe('red');
      expect(getCompatibilityColor(34)).toBe('red');
    });
  });

  describe('getCompatibilityPercentage', () => {
    it('should return percentage string', () => {
      expect(getCompatibilityPercentage(75)).toBe('75%');
      expect(getCompatibilityPercentage(50)).toBe('50%');
      expect(getCompatibilityPercentage(100)).toBe('100%');
    });

    it('should round to nearest integer', () => {
      expect(getCompatibilityPercentage(75.4)).toBe('75%');
      expect(getCompatibilityPercentage(75.6)).toBe('76%');
    });

    it('should handle edge cases', () => {
      expect(getCompatibilityPercentage(0)).toBe('0%');
      expect(getCompatibilityPercentage(100)).toBe('100%');
    });
  });

  describe('isCompatibleMatch', () => {
    it('should return true for score above threshold', () => {
      expect(isCompatibleMatch(50)).toBe(true);
      expect(isCompatibleMatch(75)).toBe(true);
      expect(isCompatibleMatch(100)).toBe(true);
    });

    it('should return false for score below threshold', () => {
      expect(isCompatibleMatch(30)).toBe(false);
      expect(isCompatibleMatch(20)).toBe(false);
      expect(isCompatibleMatch(0)).toBe(false);
    });

    it('should use custom threshold', () => {
      expect(isCompatibleMatch(50, 60)).toBe(false);
      expect(isCompatibleMatch(65, 60)).toBe(true);
      expect(isCompatibleMatch(60, 60)).toBe(true);
    });

    it('should use default threshold of 40', () => {
      expect(isCompatibleMatch(40)).toBe(true);
      expect(isCompatibleMatch(39)).toBe(false);
    });
  });

  describe('sortByCompatibility', () => {
    it('should sort profiles by compatibility score in descending order', () => {
      const profiles = [
        { compatibilityScore: 50, name: 'Profile A' },
        { compatibilityScore: 80, name: 'Profile B' },
        { compatibilityScore: 60, name: 'Profile C' }
      ];

      const sorted = sortByCompatibility(profiles);

      expect(sorted[0].compatibilityScore).toBe(80);
      expect(sorted[1].compatibilityScore).toBe(60);
      expect(sorted[2].compatibilityScore).toBe(50);
    });

    it('should sort in ascending order when descending is false', () => {
      const profiles = [
        { compatibilityScore: 50, name: 'Profile A' },
        { compatibilityScore: 80, name: 'Profile B' },
        { compatibilityScore: 60, name: 'Profile C' }
      ];

      const sorted = sortByCompatibility(profiles, false);

      expect(sorted[0].compatibilityScore).toBe(50);
      expect(sorted[1].compatibilityScore).toBe(60);
      expect(sorted[2].compatibilityScore).toBe(80);
    });

    it('should not mutate original array', () => {
      const profiles = [
        { compatibilityScore: 50, name: 'Profile A' },
        { compatibilityScore: 80, name: 'Profile B' }
      ];

      const original = [...profiles];
      sortByCompatibility(profiles);

      expect(profiles).toEqual(original);
    });

    it('should handle empty array', () => {
      const profiles: any[] = [];
      const sorted = sortByCompatibility(profiles);

      expect(sorted).toEqual([]);
    });

    it('should handle single profile', () => {
      const profiles = [{ compatibilityScore: 75, name: 'Profile A' }];
      const sorted = sortByCompatibility(profiles);

      expect(sorted.length).toBe(1);
      expect(sorted[0].compatibilityScore).toBe(75);
    });
  });

  describe('Edge Cases', () => {
    it('should handle users with zero trust score', () => {
      const zeroTrustUser1 = { ...mockUser1, trustScore: 0 };
      const zeroTrustUser2 = { ...mockUser2, trustScore: 0 };

      const result = calculateCompatibility(zeroTrustUser1, zeroTrustUser2);

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should handle users with maximum trust score', () => {
      const maxTrustUser1 = { ...mockUser1, trustScore: 100 };
      const maxTrustUser2 = { ...mockUser2, trustScore: 100 };

      const result = calculateCompatibility(maxTrustUser1, maxTrustUser2);

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should handle partial Q&A answers', () => {
      const answers1 = {
        spending: 'moderate'
        // missing lifestyle and values
      };

      const answers2 = {
        spending: 'moderate',
        lifestyle: 'family-oriented',
        values: 'honesty'
      };

      const result = calculateCompatibility(mockUser1, mockUser2, answers1, answers2);

      expect(result.qaScore).toBeGreaterThanOrEqual(0);
      expect(result.qaScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty Q&A answers', () => {
      const answers1 = {};
      const answers2 = {};

      const result = calculateCompatibility(mockUser1, mockUser2, answers1, answers2);

      expect(result.qaScore).toBe(50); // Neutral score
    });

    it('should handle very different Q&A answers', () => {
      const answers1 = {
        spending: 'very high',
        lifestyle: 'party lifestyle',
        values: 'freedom'
      };

      const answers2 = {
        spending: 'very low',
        lifestyle: 'quiet lifestyle',
        values: 'stability'
      };

      const result = calculateCompatibility(mockUser1, mockUser2, answers1, answers2);

      expect(result.qaScore).toBeLessThan(50);
    });

    it('should handle identical Q&A answers', () => {
      const answers = {
        spending: 'moderate',
        lifestyle: 'balanced',
        values: 'honesty'
      };

      const result = calculateCompatibility(mockUser1, mockUser2, answers, answers);

      expect(result.qaScore).toBeGreaterThan(80);
    });
  });

  describe('Archetype Compatibility Matrix', () => {
    it('should have symmetric compatibility for some archetypes', () => {
      const casualManSpoiltWoman = calculateCompatibility(mockUser3, mockUser4);
      const spoiltWomanCasualMan = calculateCompatibility(mockUser4, mockUser3);

      // Both should have similar archetype scores
      expect(Math.abs(casualManSpoiltWoman.archetypeScore - spoiltWomanCasualMan.archetypeScore)).toBeLessThan(5);
    });

    it('should reflect marriage-minded + safety-first as high compatibility', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result.archetypeScore).toBeGreaterThan(70);
    });

    it('should reflect casual + safety-first as lower compatibility', () => {
      const result = calculateCompatibility(mockUser3, mockUser2);

      expect(result.archetypeScore).toBeLessThan(60);
    });
  });

  describe('Trust Score Impact', () => {
    it('should boost total score when both users have high trust', () => {
      const highTrustUser1 = { ...mockUser1, trustScore: 90 };
      const highTrustUser2 = { ...mockUser2, trustScore: 90 };

      const resultHighTrust = calculateCompatibility(highTrustUser1, highTrustUser2);
      const resultLowTrust = calculateCompatibility(mockUser1, mockUser2);

      expect(resultHighTrust.total).toBeGreaterThan(resultLowTrust.total);
    });

    it('should reduce total score when one user has low trust', () => {
      const lowTrustUser = { ...mockUser1, trustScore: 20 };

      const resultLowTrust = calculateCompatibility(lowTrustUser, mockUser2);
      const resultNormalTrust = calculateCompatibility(mockUser1, mockUser2);

      expect(resultLowTrust.total).toBeLessThan(resultNormalTrust.total);
    });
  });

  describe('Breakdown Calculations', () => {
    it('should have contributions that sum to total', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      const totalContribution =
        result.breakdown.archetype.contribution +
        result.breakdown.qa.contribution +
        result.breakdown.trust.contribution;

      expect(Math.round(totalContribution)).toBe(result.total);
    });

    it('should have correct weight distribution', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      const totalWeight =
        result.breakdown.archetype.weight +
        result.breakdown.qa.weight +
        result.breakdown.trust.weight;

      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    it('should have detailed descriptions', () => {
      const result = calculateCompatibility(mockUser1, mockUser2);

      expect(result.breakdown.archetype.details).toBeTruthy();
      expect(result.breakdown.qa.details).toBeTruthy();
      expect(result.breakdown.trust.details).toBeTruthy();
    });
  });
});
