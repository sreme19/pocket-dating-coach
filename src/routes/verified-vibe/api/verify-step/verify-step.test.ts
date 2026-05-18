import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';

// Mock the verification module
vi.mock('$lib/verified-vibe/server/verification', () => ({
  checkPhotoConsistencyWithClaude: vi.fn()
}));

describe('POST /api/verified-vibe/verify-step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should reject requests without step field', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({ data: {} })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject requests without data field', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({ step: 'photos' })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject invalid step types', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({ step: 'invalid_step', data: {} })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid verification step');
    });
  });

  describe('Photo Verification', () => {
    it('should reject photo requests with fewer than 5 images', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: ['img1', 'img2', 'img3'],
            mimeTypes: ['image/jpeg', 'image/jpeg', 'image/jpeg'],
            labels: { 0: 'lead', 1: 'warmth', 2: 'lifestyle' }
          }
        })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('At least 5 images are required');
    });

    it('should reject photo requests with mismatched mime types', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: ['img1', 'img2', 'img3', 'img4', 'img5'],
            mimeTypes: ['image/jpeg', 'image/jpeg'],
            labels: { 0: 'lead', 1: 'warmth', 2: 'lifestyle', 3: 'conversation', 4: 'social' }
          }
        })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('MIME types must match number of images');
    });

    it('should reject photo requests without labels', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: ['img1', 'img2', 'img3', 'img4', 'img5'],
            mimeTypes: ['image/jpeg', 'image/jpeg', 'image/jpeg', 'image/jpeg', 'image/jpeg']
          }
        })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Photo labels are required');
    });
  });

  describe('Trust Points', () => {
    it('should return correct trust points for each step', async () => {
      const steps = [
        { step: 'id', expectedPoints: 10 },
        { step: 'liveness', expectedPoints: 10 },
        { step: 'spending_or_qa', expectedPoints: 10 }
      ];

      for (const { step, expectedPoints } of steps) {
        const request = new Request('http://localhost/api/verified-vibe/verify-step', {
          method: 'POST',
          body: JSON.stringify({ step, data: {} })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(data.trustPoints).toBe(expectedPoints);
      }
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted response for valid requests', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({ step: 'id', data: {} })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('step');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('trustPoints');
      expect(data).toHaveProperty('createdAt');
    });

    it('should include step-specific data in response', async () => {
      const request = new Request('http://localhost/api/verified-vibe/verify-step', {
        method: 'POST',
        body: JSON.stringify({ step: 'id', data: {} })
      });

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.data).toHaveProperty('idNumber');
      expect(data.data).toHaveProperty('idName');
      expect(data.data).toHaveProperty('idDOB');
    });
  });
});
