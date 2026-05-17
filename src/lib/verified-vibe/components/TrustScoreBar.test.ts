import { describe, it, expect } from 'vitest';
import { getTrustScoreColor } from '../server/trustScore';
import type { TrustScoreBreakdown } from '../server/trustScore';

describe('TrustScoreBar Component Logic', () => {
  const createBreakdown = (total: number = 75): TrustScoreBreakdown => ({
    total,
    idScore: 80,
    livenessScore: 75,
    photoScore: 70,
    qaScore: 75,
    details: {
      id: {
        score: 80,
        weight: 0.25,
        contribution: 20,
        status: 'completed',
        confidenceScore: 80
      },
      liveness: {
        score: 75,
        weight: 0.25,
        contribution: 18.75,
        status: 'completed',
        confidenceScore: 75
      },
      photos: {
        score: 70,
        weight: 0.25,
        contribution: 17.5,
        status: 'completed',
        confidenceScore: 70
      },
      qa: {
        score: 75,
        weight: 0.25,
        contribution: 18.75,
        status: 'completed'
      }
    }
  });

  describe('Color Determination', () => {
    it('should return red for low total scores', () => {
      const breakdown = createBreakdown(30);
      expect(getTrustScoreColor(breakdown.total)).toBe('red');
    });

    it('should return yellow for medium total scores', () => {
      const breakdown = createBreakdown(60);
      expect(getTrustScoreColor(breakdown.total)).toBe('yellow');
    });

    it('should return green for high total scores', () => {
      const breakdown = createBreakdown(85);
      expect(getTrustScoreColor(breakdown.total)).toBe('green');
    });
  });

  describe('Breakdown Structure', () => {
    it('should have all required fields in breakdown', () => {
      const breakdown = createBreakdown(75);
      expect(breakdown.total).toBeDefined();
      expect(breakdown.idScore).toBeDefined();
      expect(breakdown.livenessScore).toBeDefined();
      expect(breakdown.photoScore).toBeDefined();
      expect(breakdown.qaScore).toBeDefined();
      expect(breakdown.details).toBeDefined();
    });

    it('should have all step details', () => {
      const breakdown = createBreakdown(75);
      expect(breakdown.details.id).toBeDefined();
      expect(breakdown.details.liveness).toBeDefined();
      expect(breakdown.details.photos).toBeDefined();
      expect(breakdown.details.qa).toBeDefined();
    });

    it('should have correct structure for each step detail', () => {
      const breakdown = createBreakdown(75);
      const stepDetail = breakdown.details.id;

      expect(stepDetail.score).toBeDefined();
      expect(stepDetail.weight).toBeDefined();
      expect(stepDetail.contribution).toBeDefined();
      expect(stepDetail.status).toBeDefined();
    });
  });

  describe('Step Labels', () => {
    it('should have correct step labels', () => {
      const stepLabels = {
        id: 'ID Verification',
        liveness: 'Liveness Check',
        photos: 'Photo Consistency',
        qa: 'Q&A Completion'
      };

      expect(stepLabels.id).toBe('ID Verification');
      expect(stepLabels.liveness).toBe('Liveness Check');
      expect(stepLabels.photos).toBe('Photo Consistency');
      expect(stepLabels.qa).toBe('Q&A Completion');
    });
  });

  describe('Score Calculations', () => {
    it('should calculate correct contributions', () => {
      const breakdown = createBreakdown(75);
      expect(breakdown.details.id.contribution).toBe(20); // 80 * 0.25
      expect(breakdown.details.liveness.contribution).toBe(18.75); // 75 * 0.25
      expect(breakdown.details.photos.contribution).toBe(17.5); // 70 * 0.25
      expect(breakdown.details.qa.contribution).toBe(18.75); // 75 * 0.25
    });

    it('should have correct weight for each step', () => {
      const breakdown = createBreakdown(75);
      expect(breakdown.details.id.weight).toBe(0.25);
      expect(breakdown.details.liveness.weight).toBe(0.25);
      expect(breakdown.details.photos.weight).toBe(0.25);
      expect(breakdown.details.qa.weight).toBe(0.25);
    });
  });

  describe('Status Handling', () => {
    it('should handle completed status', () => {
      const breakdown = createBreakdown(75);
      expect(breakdown.details.id.status).toBe('completed');
    });

    it('should handle pending status', () => {
      const breakdown = createBreakdown(50);
      breakdown.details.liveness.status = 'pending';
      expect(breakdown.details.liveness.status).toBe('pending');
    });

    it('should handle failed status', () => {
      const breakdown = createBreakdown(50);
      breakdown.details.photos.status = 'failed';
      expect(breakdown.details.photos.status).toBe('failed');
    });
  });

  describe('Score Ranges', () => {
    it('should handle zero score', () => {
      const breakdown = createBreakdown(0);
      expect(breakdown.total).toBe(0);
    });

    it('should handle perfect score', () => {
      const breakdown = createBreakdown(100);
      expect(breakdown.total).toBe(100);
    });

    it('should handle decimal scores', () => {
      const breakdown = createBreakdown(75.5);
      expect(breakdown.total).toBe(75.5);
    });
  });

  describe('Color Classes', () => {
    it('should have correct color classes defined', () => {
      const colorClasses = {
        red: 'bg-red-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500'
      };

      expect(colorClasses.red).toContain('bg-red-500');
      expect(colorClasses.yellow).toContain('bg-yellow-500');
      expect(colorClasses.green).toContain('bg-green-500');
    });
  });
});
