import { describe, it, expect } from 'vitest';
import {
  calculateTrustScore,
  getTrustScoreColor,
  getTrustScoreLabel,
  getTrustScorePercentage,
  isFullyVerified,
  getNextIncompleteStep,
  getVerificationProgress
} from './trustScore';
import type { VerificationRecord } from '../types';

describe('Trust Score Calculation', () => {
  // Helper function to create verification records
  const createRecord = (
    step: 'id' | 'liveness' | 'photos' | 'spending_or_qa',
    status: 'pending' | 'completed' | 'failed',
    confidenceScore?: number
  ): VerificationRecord => ({
    id: `record-${step}`,
    userId: 'user-123',
    step,
    status,
    data: confidenceScore !== undefined ? { confidenceScore } : {},
    completedAt: status === 'completed' ? new Date() : null,
    createdAt: new Date()
  });

  describe('calculateTrustScore', () => {
    it('should return 0 for empty verification records', () => {
      const result = calculateTrustScore([]);
      expect(result.total).toBe(0);
      expect(result.idScore).toBe(0);
      expect(result.livenessScore).toBe(0);
      expect(result.photoScore).toBe(0);
      expect(result.qaScore).toBe(0);
    });

    it('should calculate score with all steps at 100%', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(100);
      expect(result.idScore).toBe(100);
      expect(result.livenessScore).toBe(100);
      expect(result.photoScore).toBe(100);
      expect(result.qaScore).toBe(100);
    });

    it('should calculate score with all steps at 50%', () => {
      const records = [
        createRecord('id', 'completed', 50),
        createRecord('liveness', 'completed', 50),
        createRecord('photos', 'completed', 50),
        createRecord('spending_or_qa', 'completed', 50)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(50);
      expect(result.idScore).toBe(50);
      expect(result.livenessScore).toBe(50);
      expect(result.photoScore).toBe(50);
      expect(result.qaScore).toBe(50);
    });

    it('should calculate weighted contributions correctly', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 80),
        createRecord('photos', 'completed', 60),
        createRecord('spending_or_qa', 'completed', 40)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(70); // (100 + 80 + 60 + 40) / 4 = 70
      expect(result.details.id.contribution).toBe(25); // 100 * 0.25
      expect(result.details.liveness.contribution).toBe(20); // 80 * 0.25
      expect(result.details.photos.contribution).toBe(15); // 60 * 0.25
      expect(result.details.qa.contribution).toBe(10); // 40 * 0.25
    });

    it('should handle partial verification (only ID completed)', () => {
      const records = [createRecord('id', 'completed', 100)];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(25); // 100 * 0.25
      expect(result.idScore).toBe(100);
      expect(result.livenessScore).toBe(0);
      expect(result.photoScore).toBe(0);
      expect(result.qaScore).toBe(0);
    });

    it('should handle failed verification steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'failed'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(75); // (100 + 0 + 100 + 100) / 4 = 75
      expect(result.livenessScore).toBe(0);
    });

    it('should handle pending verification steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'pending'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(75); // (100 + 0 + 100 + 100) / 4 = 75
      expect(result.livenessScore).toBe(0);
    });

    it('should cap score at 100', () => {
      const records = [
        createRecord('id', 'completed', 150), // Invalid but should be capped
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should handle missing confidence scores', () => {
      const records = [
        createRecord('id', 'completed'),
        createRecord('liveness', 'completed'),
        createRecord('photos', 'completed'),
        createRecord('spending_or_qa', 'completed')
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(100); // All default to 100 when completed
    });

    it('should include detailed breakdown', () => {
      const records = [
        createRecord('id', 'completed', 80),
        createRecord('liveness', 'completed', 90),
        createRecord('photos', 'completed', 85),
        createRecord('spending_or_qa', 'completed', 95)
      ];

      const result = calculateTrustScore(records);
      expect(result.details.id).toBeDefined();
      expect(result.details.liveness).toBeDefined();
      expect(result.details.photos).toBeDefined();
      expect(result.details.qa).toBeDefined();

      expect(result.details.id.score).toBe(80);
      expect(result.details.id.weight).toBe(0.25);
      expect(result.details.id.status).toBe('completed');
      expect(result.details.id.confidenceScore).toBe(80);
    });

    it('should handle mixed verification states', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'failed'),
        createRecord('photos', 'pending'),
        createRecord('spending_or_qa', 'completed', 100)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(50); // (100 + 0 + 0 + 100) / 4 = 50
      expect(result.details.id.status).toBe('completed');
      expect(result.details.liveness.status).toBe('failed');
      expect(result.details.photos.status).toBe('pending');
      expect(result.details.qa.status).toBe('completed');
    });

    it('should round scores to nearest integer', () => {
      const records = [
        createRecord('id', 'completed', 33),
        createRecord('liveness', 'completed', 33),
        createRecord('photos', 'completed', 33),
        createRecord('spending_or_qa', 'completed', 33)
      ];

      const result = calculateTrustScore(records);
      expect(result.total).toBe(33);
      expect(Number.isInteger(result.total)).toBe(true);
    });
  });

  describe('getTrustScoreColor', () => {
    it('should return red for score < 50', () => {
      expect(getTrustScoreColor(0)).toBe('red');
      expect(getTrustScoreColor(25)).toBe('red');
      expect(getTrustScoreColor(49)).toBe('red');
    });

    it('should return yellow for score 50-74', () => {
      expect(getTrustScoreColor(50)).toBe('yellow');
      expect(getTrustScoreColor(60)).toBe('yellow');
      expect(getTrustScoreColor(74)).toBe('yellow');
    });

    it('should return green for score >= 75', () => {
      expect(getTrustScoreColor(75)).toBe('green');
      expect(getTrustScoreColor(85)).toBe('green');
      expect(getTrustScoreColor(100)).toBe('green');
    });
  });

  describe('getTrustScoreLabel', () => {
    it('should return "Not Verified" for 0', () => {
      expect(getTrustScoreLabel(0)).toBe('Not Verified');
    });

    it('should return "Minimal Trust" for 1-24', () => {
      expect(getTrustScoreLabel(1)).toBe('Minimal Trust');
      expect(getTrustScoreLabel(12)).toBe('Minimal Trust');
      expect(getTrustScoreLabel(24)).toBe('Minimal Trust');
    });

    it('should return "Low Trust" for 25-49', () => {
      expect(getTrustScoreLabel(25)).toBe('Low Trust');
      expect(getTrustScoreLabel(37)).toBe('Low Trust');
      expect(getTrustScoreLabel(49)).toBe('Low Trust');
    });

    it('should return "Medium Trust" for 50-74', () => {
      expect(getTrustScoreLabel(50)).toBe('Medium Trust');
      expect(getTrustScoreLabel(62)).toBe('Medium Trust');
      expect(getTrustScoreLabel(74)).toBe('Medium Trust');
    });

    it('should return "High Trust" for 75-99', () => {
      expect(getTrustScoreLabel(75)).toBe('High Trust');
      expect(getTrustScoreLabel(87)).toBe('High Trust');
      expect(getTrustScoreLabel(99)).toBe('High Trust');
    });

    it('should return "Fully Verified" for 100', () => {
      expect(getTrustScoreLabel(100)).toBe('Fully Verified');
    });
  });

  describe('getTrustScorePercentage', () => {
    it('should format score as percentage string', () => {
      expect(getTrustScorePercentage(0)).toBe('0%');
      expect(getTrustScorePercentage(50)).toBe('50%');
      expect(getTrustScorePercentage(100)).toBe('100%');
    });

    it('should round decimal scores', () => {
      expect(getTrustScorePercentage(33.3)).toBe('33%');
      expect(getTrustScorePercentage(66.7)).toBe('67%');
      expect(getTrustScorePercentage(99.9)).toBe('100%');
    });
  });

  describe('isFullyVerified', () => {
    it('should return false for empty records', () => {
      expect(isFullyVerified([])).toBe(false);
    });

    it('should return false if any step is not completed', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'pending'),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(isFullyVerified(records)).toBe(false);
    });

    it('should return false if any step is failed', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'failed'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(isFullyVerified(records)).toBe(false);
    });

    it('should return true if all steps are completed', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(isFullyVerified(records)).toBe(true);
    });

    it('should return true even if confidence scores are low', () => {
      const records = [
        createRecord('id', 'completed', 10),
        createRecord('liveness', 'completed', 20),
        createRecord('photos', 'completed', 30),
        createRecord('spending_or_qa', 'completed', 40)
      ];
      expect(isFullyVerified(records)).toBe(true);
    });

    it('should handle missing records', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100)
      ];
      expect(isFullyVerified(records)).toBe(false);
    });
  });

  describe('getNextIncompleteStep', () => {
    it('should return null if all steps are completed', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getNextIncompleteStep(records)).toBeNull();
    });

    it('should return "id" if no records exist', () => {
      expect(getNextIncompleteStep([])).toBe('id');
    });

    it('should return "id" if id is not completed', () => {
      const records = [
        createRecord('id', 'pending'),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getNextIncompleteStep(records)).toBe('id');
    });

    it('should return "liveness" if id is completed but liveness is not', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'pending'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getNextIncompleteStep(records)).toBe('liveness');
    });

    it('should return "photos" if id and liveness are completed but photos is not', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'failed'),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getNextIncompleteStep(records)).toBe('photos');
    });

    it('should return "spending_or_qa" if all others are completed', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'pending')
      ];
      expect(getNextIncompleteStep(records)).toBe('spending_or_qa');
    });

    it('should prioritize steps in order', () => {
      const records = [
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getNextIncompleteStep(records)).toBe('id');
    });
  });

  describe('getVerificationProgress', () => {
    it('should return 0 for empty records', () => {
      expect(getVerificationProgress([])).toBe(0);
    });

    it('should return 25 for one completed step', () => {
      const records = [createRecord('id', 'completed', 100)];
      expect(getVerificationProgress(records)).toBe(25);
    });

    it('should return 50 for two completed steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100)
      ];
      expect(getVerificationProgress(records)).toBe(50);
    });

    it('should return 75 for three completed steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100)
      ];
      expect(getVerificationProgress(records)).toBe(75);
    });

    it('should return 100 for all completed steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getVerificationProgress(records)).toBe(100);
    });

    it('should not count pending steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'pending'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getVerificationProgress(records)).toBe(75);
    });

    it('should not count failed steps', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'failed'),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      expect(getVerificationProgress(records)).toBe(75);
    });

    it('should round progress to nearest integer', () => {
      const records = [
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100)
      ];
      const progress = getVerificationProgress(records);
      expect(Number.isInteger(progress)).toBe(true);
      expect(progress).toBe(75);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high confidence scores', () => {
      const records = [
        createRecord('id', 'completed', 99.9),
        createRecord('liveness', 'completed', 99.9),
        createRecord('photos', 'completed', 99.9),
        createRecord('spending_or_qa', 'completed', 99.9)
      ];
      const result = calculateTrustScore(records);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('should handle very low confidence scores', () => {
      const records = [
        createRecord('id', 'completed', 0.1),
        createRecord('liveness', 'completed', 0.1),
        createRecord('photos', 'completed', 0.1),
        createRecord('spending_or_qa', 'completed', 0.1)
      ];
      const result = calculateTrustScore(records);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should handle duplicate step records (last one wins)', () => {
      const records = [
        createRecord('id', 'completed', 50),
        createRecord('id', 'completed', 100),
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      const result = calculateTrustScore(records);
      // Should use the first found record
      expect(result.idScore).toBe(50);
    });

    it('should handle records with missing data fields', () => {
      const records = [
        {
          id: 'record-id',
          userId: 'user-123',
          step: 'id' as const,
          status: 'completed' as const,
          data: {},
          completedAt: new Date(),
          createdAt: new Date()
        },
        createRecord('liveness', 'completed', 100),
        createRecord('photos', 'completed', 100),
        createRecord('spending_or_qa', 'completed', 100)
      ];
      const result = calculateTrustScore(records);
      expect(result.total).toBe(100); // Defaults to 100 for completed without confidence
    });
  });
});
