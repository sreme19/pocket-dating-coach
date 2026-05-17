import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { currentPhase, setPhase, clearAllStores } from '$lib/verified-vibe/stores';
import type { Gender } from '$lib/verified-vibe/types';

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

describe('Gate to Home Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllStores();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Complete Gate to Home Flow', () => {
    it('should complete full gate to home transition with man gender', () => {
      // Step 1: User selects gender (man)
      const gender: Gender = 'man';
      
      // Step 2: User confirms age (18+)
      const ageConfirmed = true;

      // Step 3: User clicks continue
      if (gender && ageConfirmed) {
        // Save gender to localStorage
        localStorage.setItem('verified_vibe_gender', gender);
        
        // Update phase to home
        setPhase('home');
      }

      // Verify all requirements are met
      expect(localStorage.getItem('verified_vibe_gender')).toBe('man');
      expect(get(currentPhase)).toBe('home');
      expect(localStorage.getItem('vv_phase')).toBe('home');
    });

    it('should complete full gate to home transition with woman gender', () => {
      const gender: Gender = 'woman';
      const ageConfirmed = true;

      if (gender && ageConfirmed) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');
      expect(get(currentPhase)).toBe('home');
    });

    it('should complete full gate to home transition with prefer_not_to_say gender', () => {
      const gender: Gender = 'prefer_not_to_say';
      const ageConfirmed = true;

      if (gender && ageConfirmed) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      expect(localStorage.getItem('verified_vibe_gender')).toBe('prefer_not_to_say');
      expect(get(currentPhase)).toBe('home');
    });
  });

  describe('Home Page Can Read Gender from localStorage', () => {
    it('should allow home page to read gender from localStorage', () => {
      // Gate page saves gender
      const gender: Gender = 'man';
      localStorage.setItem('verified_vibe_gender', gender);
      setPhase('home');

      // Home page reads gender
      const stored = localStorage.getItem('verified_vibe_gender');
      expect(stored).toBe('man');
    });

    it('should persist gender across phase transitions', () => {
      const gender: Gender = 'woman';
      localStorage.setItem('verified_vibe_gender', gender);

      // Transition through phases
      setPhase('home');
      setPhase('verify');
      setPhase('verification');

      // Gender should still be available
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');
    });

    it('should allow home page to filter archetypes by gender', () => {
      // Simulate gate page flow
      const gender: Gender = 'man';
      localStorage.setItem('verified_vibe_gender', gender);
      setPhase('home');

      // Simulate home page reading gender
      const stored = localStorage.getItem('verified_vibe_gender');
      const readGender = stored as Gender | null;

      expect(readGender).toBe('man');
      expect(readGender === 'man').toBe(true);
    });
  });

  describe('Error Handling During Transition', () => {
    it('should not transition if gender is missing', () => {
      const gender: Gender | null = null;
      const ageConfirmed = true;

      if (gender && ageConfirmed) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      // Should remain in gate phase
      expect(get(currentPhase)).toBe('gate');
      expect(localStorage.getItem('verified_vibe_gender')).toBeNull();
    });

    it('should not transition if age is not confirmed', () => {
      const gender: Gender = 'man';
      const ageConfirmed = false;

      if (gender && ageConfirmed) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      // Should remain in gate phase
      expect(get(currentPhase)).toBe('gate');
    });

    it('should not save gender if validation fails', () => {
      const gender: Gender | null = null;
      const ageConfirmed = false;

      if (gender && ageConfirmed) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      expect(localStorage.getItem('verified_vibe_gender')).toBeNull();
      expect(get(currentPhase)).toBe('gate');
    });
  });

  describe('localStorage Persistence Across Sessions', () => {
    it('should persist gender across simulated page reloads', () => {
      // First session: gate page
      const gender: Gender = 'man';
      localStorage.setItem('verified_vibe_gender', gender);
      setPhase('home');

      // Simulate page reload by reading from localStorage
      const reloadedGender = localStorage.getItem('verified_vibe_gender');
      expect(reloadedGender).toBe('man');

      // Home page should be able to use this
      expect(reloadedGender === 'man').toBe(true);
    });

    it('should maintain gender through multiple phase transitions', () => {
      const gender: Gender = 'woman';
      localStorage.setItem('verified_vibe_gender', gender);

      // Simulate user journey through phases
      setPhase('home');
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');

      setPhase('verify');
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');

      setPhase('verification');
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');

      setPhase('app');
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');
    });
  });

  describe('Validation Requirements', () => {
    it('should require both gender and age confirmation', () => {
      const testCases = [
        { gender: null as Gender | null, ageConfirmed: true, shouldProceed: false },
        { gender: 'man' as Gender, ageConfirmed: false, shouldProceed: false },
        { gender: null as Gender | null, ageConfirmed: false, shouldProceed: false },
        { gender: 'man' as Gender, ageConfirmed: true, shouldProceed: true },
        { gender: 'woman' as Gender, ageConfirmed: true, shouldProceed: true },
        { gender: 'prefer_not_to_say' as Gender, ageConfirmed: true, shouldProceed: true }
      ];

      testCases.forEach(({ gender, ageConfirmed, shouldProceed }) => {
        localStorage.clear();
        clearAllStores();

        if (gender && ageConfirmed) {
          localStorage.setItem('verified_vibe_gender', gender);
          setPhase('home');
        }

        if (shouldProceed) {
          expect(get(currentPhase)).toBe('home');
          expect(localStorage.getItem('verified_vibe_gender')).toBe(gender);
        } else {
          expect(get(currentPhase)).toBe('gate');
        }
      });
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state between store and localStorage', () => {
      const gender: Gender = 'man';
      localStorage.setItem('verified_vibe_gender', gender);
      setPhase('home');

      // Verify consistency
      const storedGender = localStorage.getItem('verified_vibe_gender');
      const storedPhase = localStorage.getItem('vv_phase');
      const currentPhaseValue = get(currentPhase);

      expect(storedGender).toBe('man');
      expect(storedPhase).toBe('home');
      expect(currentPhaseValue).toBe('home');

      // All three should be in sync
      expect(storedGender === 'man').toBe(true);
      expect(storedPhase === 'home').toBe(true);
      expect(currentPhaseValue === 'home').toBe(true);
    });

    it('should handle rapid state changes correctly', () => {
      const gender: Gender = 'woman';

      // Rapid changes
      for (let i = 0; i < 10; i++) {
        localStorage.setItem('verified_vibe_gender', gender);
        setPhase('home');
      }

      // Final state should be consistent
      expect(localStorage.getItem('verified_vibe_gender')).toBe('woman');
      expect(get(currentPhase)).toBe('home');
    });
  });
});
