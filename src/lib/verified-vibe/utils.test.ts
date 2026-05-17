import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateTrustScore,
  getTrustScoreRange,
  calculateVerificationProgress,
  getVerificationStatus,
  getMatchedArchetypes,
  isValidMatch,
  formatTrustScore,
  formatDistance,
  formatTime,
  validateEmail,
  validateAge,
  validatePhoneNumber,
  formatDate,
  getTimeAgo,
  calculateAge,
  saveToLocalStorage,
  getFromLocalStorage,
  removeFromLocalStorage,
  clearVerifiedVibeLocalStorage,
} from './utils';
import type { VerificationRecord } from './types';

// ============================================================================
// TRUST SCORE CALCULATION TESTS
// ============================================================================

describe('calculateTrustScore', () => {
  it('should return 0 for empty verification records', () => {
    const score = calculateTrustScore([]);
    expect(score.total).toBe(0);
    expect(score.identity.score).toBe(0);
    expect(score.lifestyle.score).toBe(0);
    expect(score.intent.score).toBe(0);
  });

  it('should calculate identity score correctly', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: 'user1',
        step: 'liveness',
        status: 'completed',
        data: { confidence: 85 },
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const score = calculateTrustScore(records);
    expect(score.identity.score).toBe(30); // 10 + 10 + 10
  });

  it('should calculate lifestyle score correctly', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'photos',
        status: 'completed',
        data: { consistent: true, quality: 'high' },
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const score = calculateTrustScore(records);
    expect(score.lifestyle.score).toBe(45); // 15 + 15 + 15
  });

  it('should cap total score at 100', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: 'user1',
        step: 'liveness',
        status: 'completed',
        data: { confidence: 85 },
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '3',
        userId: 'user1',
        step: 'photos',
        status: 'completed',
        data: { consistent: true, quality: 'high' },
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '4',
        userId: 'user1',
        step: 'spending_or_qa',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const score = calculateTrustScore(records);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

describe('getTrustScoreRange', () => {
  it('should return excellent for score >= 80', () => {
    const range = getTrustScoreRange(85);
    expect(range.range).toBe('excellent');
    expect(range.color).toBe('emerald');
  });

  it('should return high for score 60-79', () => {
    const range = getTrustScoreRange(70);
    expect(range.range).toBe('high');
    expect(range.color).toBe('lime');
  });

  it('should return medium for score 40-59', () => {
    const range = getTrustScoreRange(50);
    expect(range.range).toBe('medium');
    expect(range.color).toBe('amber');
  });

  it('should return low for score < 40', () => {
    const range = getTrustScoreRange(30);
    expect(range.range).toBe('low');
    expect(range.color).toBe('red');
  });
});

// ============================================================================
// VERIFICATION PROGRESS TESTS
// ============================================================================

describe('calculateVerificationProgress', () => {
  it('should return 0 for no completed steps', () => {
    const progress = calculateVerificationProgress([]);
    expect(progress).toBe(0);
  });

  it('should return 25 for 1 completed step', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const progress = calculateVerificationProgress(records);
    expect(progress).toBe(25);
  });

  it('should return 100 for all completed steps', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: 'user1',
        step: 'liveness',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '3',
        userId: 'user1',
        step: 'photos',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '4',
        userId: 'user1',
        step: 'spending_or_qa',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const progress = calculateVerificationProgress(records);
    expect(progress).toBe(100);
  });
});

describe('getVerificationStatus', () => {
  it('should return not_started for empty records', () => {
    const status = getVerificationStatus([]);
    expect(status.status).toBe('not_started');
    expect(status.progress).toBe(0);
  });

  it('should return in_progress for partial completion', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const status = getVerificationStatus(records);
    expect(status.status).toBe('in_progress');
    expect(status.progress).toBe(25);
  });

  it('should return completed for all steps done', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '2',
        userId: 'user1',
        step: 'liveness',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '3',
        userId: 'user1',
        step: 'photos',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: '4',
        userId: 'user1',
        step: 'spending_or_qa',
        status: 'completed',
        data: {},
        completedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const status = getVerificationStatus(records);
    expect(status.status).toBe('completed');
    expect(status.progress).toBe(100);
  });

  it('should return failed if any step failed', () => {
    const records: VerificationRecord[] = [
      {
        id: '1',
        userId: 'user1',
        step: 'id',
        status: 'failed',
        data: {},
        completedAt: null,
        createdAt: new Date(),
      },
    ];

    const status = getVerificationStatus(records);
    expect(status.status).toBe('failed');
  });
});

// ============================================================================
// ARCHETYPE MATCHING TESTS
// ============================================================================

describe('isValidMatch', () => {
  it('should return true for man and woman archetypes', () => {
    expect(isValidMatch('casual_man', 'spoilt_woman')).toBe(true);
    expect(isValidMatch('marriage_minded_man', 'safety_first_woman')).toBe(true);
  });

  it('should return false for same gender archetypes', () => {
    expect(isValidMatch('casual_man', 'marriage_minded_man')).toBe(false);
    expect(isValidMatch('spoilt_woman', 'safety_first_woman')).toBe(false);
  });

  it('should return false for invalid archetypes', () => {
    expect(isValidMatch('invalid_archetype' as any, 'spoilt_woman')).toBe(false);
  });
});

describe('getMatchedArchetypes', () => {
  it('should return women archetypes for man archetype', () => {
    const matched = getMatchedArchetypes('casual_man');
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((a) => a.gender === 'woman')).toBe(true);
  });

  it('should return men archetypes for woman archetype', () => {
    const matched = getMatchedArchetypes('spoilt_woman');
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((a) => a.gender === 'man')).toBe(true);
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('formatTrustScore', () => {
  it('should format score correctly', () => {
    expect(formatTrustScore(81.5)).toBe('82/100');
    expect(formatTrustScore(50)).toBe('50/100');
    expect(formatTrustScore(0)).toBe('0/100');
  });
});

describe('formatDistance', () => {
  it('should format distance in miles', () => {
    expect(formatDistance(2.5, 'mi')).toBe('2.5 mi');
    expect(formatDistance(10, 'mi')).toBe('10.0 mi');
  });

  it('should format distance in kilometers', () => {
    expect(formatDistance(2.5, 'km')).toContain('km');
  });
});

describe('formatTime', () => {
  it('should format time correctly', () => {
    expect(formatTime(0)).toBe('< 1 minute');
    expect(formatTime(1)).toBe('1 minute');
    expect(formatTime(10)).toBe('~10 minutes');
    expect(formatTime(60)).toBe('1 hour');
    expect(formatTime(90)).toBe('1h 30m');
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateEmail', () => {
  it('should validate correct emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.co.uk')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
  });
});

describe('validateAge', () => {
  it('should accept valid ages', () => {
    expect(validateAge(18)).toBe(true);
    expect(validateAge(25)).toBe(true);
    expect(validateAge(100)).toBe(true);
  });

  it('should reject invalid ages', () => {
    expect(validateAge(17)).toBe(false);
    expect(validateAge(121)).toBe(false);
    expect(validateAge(-1)).toBe(false);
  });
});

describe('validatePhoneNumber', () => {
  it('should validate correct phone numbers', () => {
    expect(validatePhoneNumber('1234567890')).toBe(true);
    expect(validatePhoneNumber('(123) 456-7890')).toBe(true);
    expect(validatePhoneNumber('123-456-7890')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(validatePhoneNumber('123')).toBe(false);
    expect(validatePhoneNumber('abc')).toBe(false);
  });
});

// ============================================================================
// DATE/TIME TESTS
// ============================================================================

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2026-05-17');
    const formatted = formatDate(date);
    expect(formatted).toContain('May');
    expect(formatted).toContain('17');
    expect(formatted).toContain('2026');
  });

  it('should handle string dates', () => {
    const formatted = formatDate('2026-05-17');
    expect(formatted).toContain('May');
  });
});

describe('calculateAge', () => {
  it('should calculate age correctly', () => {
    const dob = new Date('2000-01-01');
    const age = calculateAge(dob);
    expect(age).toBeGreaterThanOrEqual(25);
  });

  it('should handle string dates', () => {
    const age = calculateAge('2000-01-01');
    expect(age).toBeGreaterThanOrEqual(25);
  });
});

describe('getTimeAgo', () => {
  it('should return "just now" for recent times', () => {
    const now = new Date();
    expect(getTimeAgo(now)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(fiveMinutesAgo)).toContain('m ago');
  });

  it('should return hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(getTimeAgo(twoHoursAgo)).toContain('h ago');
  });
});

// ============================================================================
// LOCALSTORAGE TESTS
// ============================================================================

describe('localStorage helpers', () => {
  // Mock localStorage for testing
  const mockStorage: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    // Replace global localStorage with mock
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save data to localStorage', () => {
      saveToLocalStorage('test-key', { name: 'John' });
      const item = mockLocalStorage.getItem('test-key');
      expect(item).toBeTruthy();
    });

    it('should save data with expiration', () => {
      saveToLocalStorage('test-key', { name: 'John' }, 60);
      const item = mockLocalStorage.getItem('test-key');
      expect(item).toBeTruthy();
    });
  });

  describe('getFromLocalStorage', () => {
    it('should retrieve saved data', () => {
      const data = { name: 'John', age: 25 };
      saveToLocalStorage('test-key', data);
      const retrieved = getFromLocalStorage('test-key');
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const retrieved = getFromLocalStorage('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired data', () => {
      saveToLocalStorage('test-key', { name: 'John' }, -1); // Already expired
      const retrieved = getFromLocalStorage('test-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('removeFromLocalStorage', () => {
    it('should remove data from localStorage', () => {
      saveToLocalStorage('test-key', { name: 'John' });
      removeFromLocalStorage('test-key');
      const item = mockLocalStorage.getItem('test-key');
      expect(item).toBeNull();
    });
  });

  describe('clearVerifiedVibeLocalStorage', () => {
    it('should clear all verified vibe data', () => {
      saveToLocalStorage('verified-vibe-user', { id: '1' });
      saveToLocalStorage('verified-vibe-matches', []);
      clearVerifiedVibeLocalStorage();

      expect(getFromLocalStorage('verified-vibe-user')).toBeNull();
      expect(getFromLocalStorage('verified-vibe-matches')).toBeNull();
    });
  });
});
