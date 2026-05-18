import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../../../routes/api/verified-vibe/calculate-compatibility/+server';
import type { VerifiedVibeUser } from '$lib/verified-vibe/types';

// Mock request/response
class MockRequest {
  constructor(private body: any) {}

  async json() {
    return this.body;
  }
}

class MockResponse {
  status: number = 200;
  body: any = null;

  constructor(body: any, options?: { status: number }) {
    this.body = body;
    if (options?.status) {
      this.status = options.status;
    }
  }
}

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

describe('POST /api/verified-vibe/calculate-compatibility', () => {
  describe('Valid Requests', () => {
    it('should calculate compatibility between two users', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.total).toBeGreaterThanOrEqual(0);
      expect(data.data.total).toBeLessThanOrEqual(100);
    });

    it('should include all required fields in response', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data.total).toBeDefined();
      expect(data.data.archetypeScore).toBeDefined();
      expect(data.data.qaScore).toBeDefined();
      expect(data.data.trustScore).toBeDefined();
      expect(data.data.label).toBeDefined();
      expect(data.data.color).toBeDefined();
      expect(data.data.breakdown).toBeDefined();
      expect(data.data.matchingTraits).toBeDefined();
      expect(data.data.potentialIssues).toBeDefined();
    });

    it('should include breakdown details', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data.breakdown.archetype).toBeDefined();
      expect(data.data.breakdown.archetype.score).toBeDefined();
      expect(data.data.breakdown.archetype.weight).toBe(0.6);
      expect(data.data.breakdown.archetype.contribution).toBeDefined();
      expect(data.data.breakdown.archetype.details).toBeDefined();

      expect(data.data.breakdown.qa).toBeDefined();
      expect(data.data.breakdown.qa.weight).toBe(0.3);

      expect(data.data.breakdown.trust).toBeDefined();
      expect(data.data.breakdown.trust.weight).toBe(0.1);
    });

    it('should calculate with Q&A answers', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2,
        user1Answers: {
          spending: 'moderate',
          lifestyle: 'family-oriented',
          values: 'honesty'
        },
        user2Answers: {
          spending: 'moderate',
          lifestyle: 'family-oriented',
          values: 'honesty'
        }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.qaScore).toBeGreaterThan(50);
    });

    it('should return valid label', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      const validLabels = [
        'Excellent Match',
        'Great Match',
        'Good Match',
        'Possible Match',
        'Low Compatibility',
        'Very Low Compatibility'
      ];

      expect(validLabels).toContain(data.data.label);
    });

    it('should return valid color', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      const validColors = ['red', 'orange', 'yellow', 'green'];
      expect(validColors).toContain(data.data.color);
    });

    it('should include matching traits array', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(Array.isArray(data.data.matchingTraits)).toBe(true);
      expect(data.data.matchingTraits.length).toBeGreaterThan(0);
    });

    it('should include potential issues array', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(Array.isArray(data.data.potentialIssues)).toBe(true);
    });
  });

  describe('Invalid Requests', () => {
    it('should return 400 if user1 is missing', async () => {
      const request = new MockRequest({
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if user2 is missing', async () => {
      const request = new MockRequest({
        user1: mockUser1
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if user1 has no ID', async () => {
      const request = new MockRequest({
        user1: { ...mockUser1, id: undefined },
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if user2 has no ID', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: { ...mockUser2, id: undefined }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if request body is empty', async () => {
      const request = new MockRequest({}) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle users with zero trust score', async () => {
      const request = new MockRequest({
        user1: { ...mockUser1, trustScore: 0 },
        user2: { ...mockUser2, trustScore: 0 }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total).toBeGreaterThanOrEqual(0);
      expect(data.data.total).toBeLessThanOrEqual(100);
    });

    it('should handle users with maximum trust score', async () => {
      const request = new MockRequest({
        user1: { ...mockUser1, trustScore: 100 },
        user2: { ...mockUser2, trustScore: 100 }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total).toBeGreaterThanOrEqual(0);
      expect(data.data.total).toBeLessThanOrEqual(100);
    });

    it('should handle different archetype combinations', async () => {
      const casualMan = { ...mockUser1, archetype: 'casual_man' as const };
      const spoiltWoman = { ...mockUser2, archetype: 'spoilt_woman' as const };

      const request = new MockRequest({
        user1: casualMan,
        user2: spoiltWoman
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.archetypeScore).toBeGreaterThan(60);
    });

    it('should handle partial Q&A answers', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2,
        user1Answers: {
          spending: 'moderate'
        },
        user2Answers: {
          spending: 'moderate',
          lifestyle: 'family-oriented'
        }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.qaScore).toBeGreaterThanOrEqual(0);
      expect(data.data.qaScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty Q&A answers', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2,
        user1Answers: {},
        user2Answers: {}
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.qaScore).toBe(50);
    });

    it('should handle very different Q&A answers', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2,
        user1Answers: {
          spending: 'very high',
          lifestyle: 'party lifestyle',
          values: 'freedom'
        },
        user2Answers: {
          spending: 'very low',
          lifestyle: 'quiet lifestyle',
          values: 'stability'
        }
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.qaScore).toBeLessThan(50);
    });

    it('should handle identical Q&A answers', async () => {
      const answers = {
        spending: 'moderate',
        lifestyle: 'balanced',
        values: 'honesty'
      };

      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2,
        user1Answers: answers,
        user2Answers: answers
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.qaScore).toBeGreaterThan(80);
    });
  });

  describe('Response Validation', () => {
    it('should have valid score ranges', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data.total).toBeGreaterThanOrEqual(0);
      expect(data.data.total).toBeLessThanOrEqual(100);
      expect(data.data.archetypeScore).toBeGreaterThanOrEqual(0);
      expect(data.data.archetypeScore).toBeLessThanOrEqual(100);
      expect(data.data.qaScore).toBeGreaterThanOrEqual(0);
      expect(data.data.qaScore).toBeLessThanOrEqual(100);
      expect(data.data.trustScore).toBeGreaterThanOrEqual(0);
      expect(data.data.trustScore).toBeLessThanOrEqual(100);
    });

    it('should have valid weight values', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data.breakdown.archetype.weight).toBe(0.6);
      expect(data.data.breakdown.qa.weight).toBe(0.3);
      expect(data.data.breakdown.trust.weight).toBe(0.1);
    });

    it('should have contributions that sum to total', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      const total =
        data.data.breakdown.archetype.contribution +
        data.data.breakdown.qa.contribution +
        data.data.breakdown.trust.contribution;

      expect(Math.round(total)).toBe(data.data.total);
    });

    it('should have non-empty details strings', async () => {
      const request = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data.breakdown.archetype.details).toBeTruthy();
      expect(data.data.breakdown.qa.details).toBeTruthy();
      expect(data.data.breakdown.trust.details).toBeTruthy();
    });
  });

  describe('Consistency', () => {
    it('should return consistent results for same input', async () => {
      const request1 = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const request2 = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const response1 = await POST({ request: request1 } as any);
      const response2 = await POST({ request: request2 } as any);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.data.total).toBe(data2.data.total);
      expect(data1.data.archetypeScore).toBe(data2.data.archetypeScore);
      expect(data1.data.qaScore).toBe(data2.data.qaScore);
      expect(data1.data.trustScore).toBe(data2.data.trustScore);
    });

    it('should return symmetric results for reversed users', async () => {
      const request1 = new MockRequest({
        user1: mockUser1,
        user2: mockUser2
      }) as any;

      const request2 = new MockRequest({
        user1: mockUser2,
        user2: mockUser1
      }) as any;

      const response1 = await POST({ request: request1 } as any);
      const response2 = await POST({ request: request2 } as any);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Scores should be similar (within 5 points due to rounding)
      expect(Math.abs(data1.data.total - data2.data.total)).toBeLessThan(5);
    });
  });
});
