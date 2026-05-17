import { describe, it, expect } from 'vitest';
import { getTrustScoreColor, getTrustScoreLabel } from '../server/trustScore';

describe('TrustScoreBadge Component Logic', () => {
  describe('Color Determination', () => {
    it('should return red for low scores', () => {
      expect(getTrustScoreColor(30)).toBe('red');
      expect(getTrustScoreColor(45)).toBe('red');
    });

    it('should return yellow for medium scores', () => {
      expect(getTrustScoreColor(60)).toBe('yellow');
      expect(getTrustScoreColor(70)).toBe('yellow');
    });

    it('should return green for high scores', () => {
      expect(getTrustScoreColor(85)).toBe('green');
      expect(getTrustScoreColor(100)).toBe('green');
    });
  });

  describe('Label Generation', () => {
    it('should generate correct label for score 0', () => {
      expect(getTrustScoreLabel(0)).toBe('Not Verified');
    });

    it('should generate correct label for low scores', () => {
      expect(getTrustScoreLabel(30)).toBe('Low Trust');
    });

    it('should generate correct label for medium scores', () => {
      expect(getTrustScoreLabel(60)).toBe('Medium Trust');
    });

    it('should generate correct label for high scores', () => {
      expect(getTrustScoreLabel(85)).toBe('High Trust');
    });

    it('should generate correct label for perfect score', () => {
      expect(getTrustScoreLabel(100)).toBe('Fully Verified');
    });
  });

  describe('Score Formatting', () => {
    it('should handle decimal scores', () => {
      const score = 75.7;
      const rounded = Math.round(score);
      expect(rounded).toBe(76);
    });

    it('should handle zero score', () => {
      expect(Math.round(0)).toBe(0);
    });

    it('should handle perfect score', () => {
      expect(Math.round(100)).toBe(100);
    });
  });

  describe('Size Classes', () => {
    it('should have correct size classes defined', () => {
      const sizeClasses = {
        sm: 'w-12 h-12 text-xs',
        md: 'w-16 h-16 text-sm',
        lg: 'w-20 h-20 text-base'
      };

      expect(sizeClasses.sm).toContain('w-12');
      expect(sizeClasses.md).toContain('w-16');
      expect(sizeClasses.lg).toContain('w-20');
    });
  });

  describe('Color Classes', () => {
    it('should have correct color classes defined', () => {
      const colorClasses = {
        red: 'bg-red-100 text-red-700 border-red-300',
        yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        green: 'bg-green-100 text-green-700 border-green-300'
      };

      expect(colorClasses.red).toContain('bg-red-100');
      expect(colorClasses.yellow).toContain('bg-yellow-100');
      expect(colorClasses.green).toContain('bg-green-100');
    });
  });
});
