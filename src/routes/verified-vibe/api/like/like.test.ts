import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST, DELETE } from './+server';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Validates: Requirements 18 - Like/Pass Logic
 *
 * Tests for like endpoint which provides:
 * - Like action with mutual match detection
 * - Match record creation on mutual likes
 * - Like storage for future matching
 * - Error handling and validation
 * - Duplicate like prevention
 * - Self-like prevention
 */

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn()
};

// Mock getSupabase function
vi.mock('$lib/server/supabase', () => ({
  getSupabase: () => mockSupabaseClient
}));

describe('Like Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/verified-vibe/like', () => {
    describe('Validation', () => {
      it('should reject request without profileId', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('profileId');
      });

      it('should reject request without userId', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('userId');
      });

      it('should reject self-likes', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'user1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('own profile');
      });
    });

    describe('Like Storage', () => {
      it('should save like to database', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
            })
          })
        });

        const mockInsert = vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({ error: null })
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              select: mockSelect,
              insert: vi.fn().mockResolvedValue({ error: null })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.matched).toBe(false);
      });

      it('should prevent duplicate likes', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'like1' }, error: null })
            })
          })
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              select: mockSelect
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain('already liked');
      });
    });

    describe('Mutual Match Detection', () => {
      it('should detect mutual match and create match record', async () => {
        // Setup mocks for the entire flow
        let likeCheckCount = 0;
        let matchCheckCount = 0;

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(() => {
                      likeCheckCount++;
                      if (likeCheckCount === 1) {
                        // First call: check if current user already liked this profile
                        return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
                      } else if (likeCheckCount === 2) {
                        // Second call: check if target user has liked current user (mutual)
                        return Promise.resolve({ data: { id: 'like2' }, error: null });
                      }
                    })
                  })
                })
              }),
              insert: vi.fn().mockResolvedValue({ error: null })
            };
          } else if (table === 'verified_vibe_matches') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(() => {
                      matchCheckCount++;
                      // Check if match already exists
                      return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
                    })
                  })
                })
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'match1' },
                    error: null
                  })
                })
              })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.matched).toBe(true);
        expect(data.matchId).toBe('match1');
      });

      it('should not create duplicate match records', async () => {
        let likeCheckCount = 0;

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockImplementation(() => {
                      likeCheckCount++;
                      if (likeCheckCount === 1) {
                        // Check if current user already liked this profile
                        return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
                      } else if (likeCheckCount === 2) {
                        // Check if target user has liked current user (mutual)
                        return Promise.resolve({ data: { id: 'like2' }, error: null });
                      }
                    })
                  })
                })
              }),
              insert: vi.fn().mockResolvedValue({ error: null })
            };
          } else if (table === 'verified_vibe_matches') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { id: 'match1' }, error: null })
                  })
                })
              })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.matched).toBe(true);
        expect(data.matchId).toBe('match1');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'PGRST999', message: 'Database error' }
                    })
                  })
                })
              })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBeDefined();
      });

      it('should handle invalid JSON', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'POST',
          body: 'invalid json'
        });

        const response = await POST({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBeDefined();
      });
    });
  });

  describe('DELETE /api/verified-vibe/like', () => {
    describe('Validation', () => {
      it('should reject request without profileId', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'DELETE',
          body: JSON.stringify({ userId: 'user1' })
        });

        const response = await DELETE({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('profileId');
      });

      it('should reject request without userId', async () => {
        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'DELETE',
          body: JSON.stringify({ profileId: 'profile1' })
        });

        const response = await DELETE({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('userId');
      });
    });

    describe('Like Removal', () => {
      it('should remove like from database', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null })
                })
              })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'DELETE',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await DELETE({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should handle deletion errors', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'verified_vibe_likes') {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    error: { message: 'Database error' }
                  })
                })
              })
            };
          }
          return {};
        });

        const request = new Request('http://localhost/api/verified-vibe/like', {
          method: 'DELETE',
          body: JSON.stringify({ profileId: 'profile1', userId: 'user1' })
        });

        const response = await DELETE({ request } as any);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBeDefined();
      });
    });
  });
});
