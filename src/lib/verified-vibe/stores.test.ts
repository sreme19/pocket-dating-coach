import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  user,
  userTrust,
  userVerification,
  matches,
  currentMatch,
  currentMatchId,
  messages,
  isTyping,
  unreadCount,
  discoveryProfiles,
  discoveryIndex,
  discoveryLoading,
  currentDiscoveryProfile,
  currentPhase,
  currentTab,
  loading,
  error,
  verificationProgress,
  verificationStep,
  isAuthenticated,
  isVerified,
  isInApp,
  totalUnreadMessages,
  hydrateStores,
  clearAllStores,
  clearError,
  setError,
  updateUser,
  updateTrustScore,
  addVerificationRecord,
  addMessage,
  addMatch,
  addDiscoveryProfile,
  nextDiscoveryProfile,
  resetDiscovery,
  setCurrentMatch,
  clearCurrentMatch
} from './stores';
import type {
  VerifiedVibeUser,
  Match,
  Message,
  VerificationRecord,
  DiscoveryProfile
} from './types';
import type { TrustScoreBreakdown } from './server/trustScore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Test data
const mockUser: VerifiedVibeUser = {
  id: 'user-1',
  gender: 'man',
  archetype: 'casual_generous_man',
  firstName: 'John',
  age: 28,
  city: 'Brooklyn, NY',
  avatar: 'https://example.com/avatar.jpg',
  about: 'Love hiking and coffee',
  looking: 'Something casual',
  trustScore: 50,
  createdAt: new Date('2026-05-17'),
  updatedAt: new Date('2026-05-17')
};

const mockTrustScore: TrustScoreBreakdown = {
  total: 50,
  idScore: 50,
  livenessScore: 50,
  photoScore: 50,
  qaScore: 50,
  details: {
    id: { score: 50, weight: 0.25, contribution: 12.5, status: 'completed' },
    liveness: { score: 50, weight: 0.25, contribution: 12.5, status: 'completed' },
    photos: { score: 50, weight: 0.25, contribution: 12.5, status: 'completed' },
    qa: { score: 50, weight: 0.25, contribution: 12.5, status: 'completed' }
  }
};

const mockVerificationRecord: VerificationRecord = {
  id: 'ver-1',
  userId: 'user-1',
  step: 'id',
  status: 'completed',
  data: { idNumber: 'DL123456', idName: 'John Doe', idDOB: '1998-03-15' },
  completedAt: new Date('2026-05-17'),
  createdAt: new Date('2026-05-17')
};

const mockMatch: Match = {
  id: 'match-1',
  user1Id: 'user-1',
  user2Id: 'user-2',
  status: 'mutual',
  createdAt: new Date('2026-05-17')
};

const mockMessage: Message = {
  id: 'msg-1',
  matchId: 'match-1',
  senderId: 'user-2',
  content: 'Hey! How are you?',
  createdAt: new Date('2026-05-17')
};

const mockDiscoveryProfile: DiscoveryProfile = {
  ...mockUser,
  id: 'user-2',
  firstName: 'Sarah',
  distance: '2 mi',
  verified: ['ID', 'Photos'],
  trustScore: 75
};

describe('Verified Vibe Stores', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllStores();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========================================================================
  // USER STORE TESTS
  // ========================================================================

  describe('User Store', () => {
    it('should initialize with null user', () => {
      expect(get(user)).toBeNull();
    });

    it('should set user and persist to localStorage', () => {
      user.set(mockUser);
      expect(get(user)).toEqual(mockUser);
      expect(localStorage.getItem('vv_user')).toBe(JSON.stringify(mockUser));
    });

    it('should update user and persist to localStorage', () => {
      user.set(mockUser);
      user.update((u) => {
        if (!u) return u;
        return { ...u, age: 29 };
      });

      const updated = get(user);
      expect(updated?.age).toBe(29);
      const stored = JSON.parse(localStorage.getItem('vv_user') || '{}');
      expect(stored.age).toBe(29);
    });

    it('should clear user and remove from localStorage', () => {
      user.set(mockUser);
      user.clear();

      expect(get(user)).toBeNull();
      expect(localStorage.getItem('vv_user')).toBeNull();
    });

    it('should hydrate user from localStorage', () => {
      localStorage.setItem('vv_user', JSON.stringify(mockUser));
      user.hydrate();

      const hydrated = get(user);
      expect(hydrated?.id).toBe(mockUser.id);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('vv_user', 'invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      user.hydrate();

      expect(get(user)).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // DERIVED STORES TESTS
  // ========================================================================

  describe('Derived Stores', () => {
    it('isAuthenticated should be false when user is null', () => {
      expect(get(isAuthenticated)).toBe(false);
    });

    it('isAuthenticated should be true when user is set', () => {
      user.set(mockUser);
      expect(get(isAuthenticated)).toBe(true);
    });

    it('isVerified should be false when no verification records', () => {
      expect(get(isVerified)).toBe(false);
    });

    it('isVerified should be true when all verification records are completed', () => {
      userVerification.set([
        { ...mockVerificationRecord, step: 'id', status: 'completed' },
        { ...mockVerificationRecord, step: 'liveness', status: 'completed' },
        { ...mockVerificationRecord, step: 'photos', status: 'completed' },
        { ...mockVerificationRecord, step: 'spending_or_qa', status: 'completed' }
      ]);

      expect(get(isVerified)).toBe(true);
    });

    it('isVerified should be false when any verification record is not completed', () => {
      userVerification.set([
        { ...mockVerificationRecord, step: 'id', status: 'completed' },
        { ...mockVerificationRecord, step: 'liveness', status: 'pending' }
      ]);

      expect(get(isVerified)).toBe(false);
    });

    it('isInApp should be false when phase is not app', () => {
      currentPhase.set('gate');
      expect(get(isInApp)).toBe(false);
    });

    it('isInApp should be true when phase is app', () => {
      currentPhase.set('app');
      expect(get(isInApp)).toBe(true);
    });

    it('totalUnreadMessages should reflect unreadCount', () => {
      unreadCount.set(5);
      expect(get(totalUnreadMessages)).toBe(5);
    });
  });

  // ========================================================================
  // PHASE STORE TESTS
  // ========================================================================

  describe('Phase Store', () => {
    it('should initialize with gate phase', () => {
      expect(get(currentPhase)).toBe('gate');
    });

    it('should set phase and persist to localStorage', () => {
      currentPhase.set('home');
      expect(get(currentPhase)).toBe('home');
      expect(localStorage.getItem('vv_phase')).toBe('home');
    });

    it('should hydrate phase from localStorage', () => {
      localStorage.setItem('vv_phase', 'verify');
      currentPhase.hydrate();
      expect(get(currentPhase)).toBe('verify');
    });
  });

  // ========================================================================
  // TAB STORE TESTS
  // ========================================================================

  describe('Tab Store', () => {
    it('should initialize with discover tab', () => {
      expect(get(currentTab)).toBe('discover');
    });

    it('should set tab and persist to localStorage', () => {
      currentTab.set('trust');
      expect(get(currentTab)).toBe('trust');
      expect(localStorage.getItem('vv_tab')).toBe('trust');
    });

    it('should hydrate tab from localStorage', () => {
      localStorage.setItem('vv_tab', 'chat');
      currentTab.hydrate();
      expect(get(currentTab)).toBe('chat');
    });
  });

  // ========================================================================
  // HELPER FUNCTIONS TESTS
  // ========================================================================

  describe('Helper Functions', () => {
    it('hydrateStores should hydrate all persistent stores', () => {
      localStorage.setItem('vv_user', JSON.stringify(mockUser));
      localStorage.setItem('vv_phase', 'home');
      localStorage.setItem('vv_tab', 'trust');

      hydrateStores();

      expect(get(user)?.id).toBe(mockUser.id);
      expect(get(currentPhase)).toBe('home');
      expect(get(currentTab)).toBe('trust');
    });

    it('clearAllStores should reset all stores and localStorage', () => {
      user.set(mockUser);
      userTrust.set(mockTrustScore);
      userVerification.set([mockVerificationRecord]);
      matches.set([mockMatch]);
      currentMatch.set(mockUser);
      currentMatchId.set('match-1');
      messages.set([mockMessage]);
      isTyping.set(true);
      unreadCount.set(5);
      discoveryProfiles.set([mockDiscoveryProfile]);
      discoveryIndex.set(1);
      discoveryLoading.set(true);
      loading.set(true);
      error.set('Test error');
      verificationProgress.set(50);
      verificationStep.set(2);
      currentPhase.set('app');
      currentTab.set('chat');

      clearAllStores();

      expect(get(user)).toBeNull();
      expect(get(userTrust)).toBeNull();
      expect(get(userVerification)).toEqual([]);
      expect(get(matches)).toEqual([]);
      expect(get(currentMatch)).toBeNull();
      expect(get(currentMatchId)).toBeNull();
      expect(get(messages)).toEqual([]);
      expect(get(isTyping)).toBe(false);
      expect(get(unreadCount)).toBe(0);
      expect(get(discoveryProfiles)).toEqual([]);
      expect(get(discoveryIndex)).toBe(0);
      expect(get(discoveryLoading)).toBe(false);
      expect(get(loading)).toBe(false);
      expect(get(error)).toBeNull();
      expect(get(verificationProgress)).toBe(0);
      expect(get(verificationStep)).toBe(1);
      expect(get(currentPhase)).toBe('gate');
      expect(get(currentTab)).toBe('discover');

      expect(localStorage.getItem('vv_user')).toBeNull();
      expect(localStorage.getItem('vv_phase')).toBeNull();
      expect(localStorage.getItem('vv_tab')).toBeNull();
    });

    it('clearError should set error to null', () => {
      error.set('Test error');
      clearError();
      expect(get(error)).toBeNull();
    });

    it('setError should set error message', () => {
      setError('New error');
      expect(get(error)).toBe('New error');
    });

    it('updateUser should update user profile and set updatedAt', () => {
      user.set(mockUser);
      updateUser({ age: 30, city: 'Manhattan, NY' });

      const updated = get(user);
      expect(updated?.age).toBe(30);
      expect(updated?.city).toBe('Manhattan, NY');
      expect(updated?.firstName).toBe('John');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('updateTrustScore should set trust score', () => {
      updateTrustScore(mockTrustScore);
      expect(get(userTrust)).toEqual(mockTrustScore);
    });

    it('addVerificationRecord should add new record', () => {
      addVerificationRecord(mockVerificationRecord);
      const records = get(userVerification);
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(mockVerificationRecord);
    });

    it('addVerificationRecord should replace existing record with same step', () => {
      const record1 = { ...mockVerificationRecord, step: 'id' as const, status: 'pending' as const };
      const record2 = { ...mockVerificationRecord, step: 'id' as const, status: 'completed' as const };

      addVerificationRecord(record1);
      addVerificationRecord(record2);

      const records = get(userVerification);
      expect(records).toHaveLength(1);
      expect(records[0].status).toBe('completed');
    });

    it('addMessage should add message to messages store', () => {
      addMessage(mockMessage);
      const msgs = get(messages);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toEqual(mockMessage);
    });

    it('addMatch should add match to matches store', () => {
      addMatch(mockMatch);
      const m = get(matches);
      expect(m).toHaveLength(1);
      expect(m[0]).toEqual(mockMatch);
    });

    it('addDiscoveryProfile should add profile to discoveryProfiles store', () => {
      addDiscoveryProfile(mockDiscoveryProfile);
      const profiles = get(discoveryProfiles);
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toEqual(mockDiscoveryProfile);
    });

    it('nextDiscoveryProfile should increment discoveryIndex', () => {
      discoveryProfiles.set([mockDiscoveryProfile, mockDiscoveryProfile]);
      discoveryIndex.set(0);
      nextDiscoveryProfile();
      expect(get(discoveryIndex)).toBe(1);
    });

    it('resetDiscovery should reset index and clear profiles', () => {
      discoveryProfiles.set([mockDiscoveryProfile]);
      discoveryIndex.set(1);
      resetDiscovery();
      expect(get(discoveryIndex)).toBe(0);
      expect(get(discoveryProfiles)).toEqual([]);
    });

    it('setCurrentMatch should set match and clear messages', () => {
      messages.set([mockMessage]);
      setCurrentMatch('match-1', mockUser);
      expect(get(currentMatchId)).toBe('match-1');
      expect(get(currentMatch)).toEqual(mockUser);
      expect(get(messages)).toEqual([]);
    });

    it('clearCurrentMatch should clear match and messages', () => {
      currentMatchId.set('match-1');
      currentMatch.set(mockUser);
      messages.set([mockMessage]);
      clearCurrentMatch();
      expect(get(currentMatchId)).toBeNull();
      expect(get(currentMatch)).toBeNull();
      expect(get(messages)).toEqual([]);
    });
  });

  // ========================================================================
  // DISCOVERY STORE TESTS
  // ========================================================================

  describe('Discovery Store', () => {
    it('currentDiscoveryProfile should return null when no profiles', () => {
      expect(get(currentDiscoveryProfile)).toBeNull();
    });

    it('currentDiscoveryProfile should return profile at current index', () => {
      const profile1 = { ...mockDiscoveryProfile, id: 'user-2' };
      const profile2 = { ...mockDiscoveryProfile, id: 'user-3' };

      discoveryProfiles.set([profile1, profile2]);
      discoveryIndex.set(0);

      expect(get(currentDiscoveryProfile)?.id).toBe('user-2');
    });

    it('currentDiscoveryProfile should update when index changes', () => {
      const profile1 = { ...mockDiscoveryProfile, id: 'user-2' };
      const profile2 = { ...mockDiscoveryProfile, id: 'user-3' };

      discoveryProfiles.set([profile1, profile2]);
      discoveryIndex.set(1);

      expect(get(currentDiscoveryProfile)?.id).toBe('user-3');
    });
  });

  // ========================================================================
  // EDGE CASES AND ERROR HANDLING
  // ========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle updateUser when user is null', () => {
      user.set(null);
      updateUser({ age: 30 });
      expect(get(user)).toBeNull();
    });

    it('should handle multiple rapid store updates', () => {
      for (let i = 0; i < 10; i++) {
        addMessage({ ...mockMessage, id: `msg-${i}` });
      }
      expect(get(messages)).toHaveLength(10);
    });

    it('should persist and restore complex nested data', () => {
      user.set(mockUser);
      userTrust.set(mockTrustScore);
      userVerification.set([mockVerificationRecord]);

      localStorage.clear();
      localStorage.setItem('vv_user', JSON.stringify(mockUser));

      user.hydrate();

      const hydrated = get(user);
      expect(hydrated?.id).toBe(mockUser.id);
      expect(hydrated?.trustScore).toBe(mockUser.trustScore);
    });

    it('should handle empty discovery profiles gracefully', () => {
      discoveryProfiles.set([]);
      discoveryIndex.set(0);
      expect(get(currentDiscoveryProfile)).toBeNull();
    });

    it('should handle out-of-bounds discovery index', () => {
      discoveryProfiles.set([mockDiscoveryProfile]);
      discoveryIndex.set(10);
      expect(get(currentDiscoveryProfile)).toBeNull();
    });
  });

  // ========================================================================
  // STORE OPERATIONS TESTS
  // ========================================================================

  describe('Store Operations', () => {
    it('should handle multiple verification records for different steps', () => {
      addVerificationRecord({ ...mockVerificationRecord, step: 'id' });
      addVerificationRecord({ ...mockVerificationRecord, step: 'liveness', id: 'ver-2' });
      addVerificationRecord({ ...mockVerificationRecord, step: 'photos', id: 'ver-3' });

      const records = get(userVerification);
      expect(records).toHaveLength(3);
      expect(records.map((r) => r.step)).toEqual(['id', 'liveness', 'photos']);
    });

    it('should handle multiple matches', () => {
      addMatch(mockMatch);
      addMatch({ ...mockMatch, id: 'match-2', user2Id: 'user-3' });
      addMatch({ ...mockMatch, id: 'match-3', user2Id: 'user-4' });

      const m = get(matches);
      expect(m).toHaveLength(3);
    });

    it('should handle multiple messages', () => {
      addMessage(mockMessage);
      addMessage({ ...mockMessage, id: 'msg-2', content: 'Hi there!' });
      addMessage({ ...mockMessage, id: 'msg-3', content: 'How are you?' });

      const msgs = get(messages);
      expect(msgs).toHaveLength(3);
    });

    it('should handle discovery profile navigation', () => {
      const profiles = [
        { ...mockDiscoveryProfile, id: 'user-2' },
        { ...mockDiscoveryProfile, id: 'user-3' },
        { ...mockDiscoveryProfile, id: 'user-4' }
      ];

      discoveryProfiles.set(profiles);
      discoveryIndex.set(0);

      expect(get(currentDiscoveryProfile)?.id).toBe('user-2');

      nextDiscoveryProfile();
      expect(get(currentDiscoveryProfile)?.id).toBe('user-3');

      nextDiscoveryProfile();
      expect(get(currentDiscoveryProfile)?.id).toBe('user-4');
    });
  });

  // ========================================================================
  // LOCALSTORAGE PERSISTENCE TESTS
  // ========================================================================

  describe('localStorage Persistence', () => {
    it('should save user to localStorage when set', () => {
      user.set(mockUser);
      const stored = localStorage.getItem('vv_user');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.id).toBe(mockUser.id);
      expect(parsed.firstName).toBe(mockUser.firstName);
      expect(parsed.age).toBe(mockUser.age);
    });

    it('should save phase to localStorage when set', () => {
      currentPhase.set('verification');
      expect(localStorage.getItem('vv_phase')).toBe('verification');
    });

    it('should save tab to localStorage when set', () => {
      currentTab.set('chat');
      expect(localStorage.getItem('vv_tab')).toBe('chat');
    });

    it('should remove user from localStorage when cleared', () => {
      user.set(mockUser);
      expect(localStorage.getItem('vv_user')).toBeTruthy();
      user.clear();
      expect(localStorage.getItem('vv_user')).toBeNull();
    });
  });
});
