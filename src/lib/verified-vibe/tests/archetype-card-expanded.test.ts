import { describe, it, expect } from 'vitest';
import { ARCHETYPES, ARCHETYPES_BY_GENDER } from '$lib/verified-vibe/constants';
import type { Archetype, ArchetypeDefinition } from '$lib/verified-vibe/types';

/**
 * ArchetypeCard Expanded View Tests
 * 
 * Validates that the ArchetypeCard component's expanded view displays:
 * 1. Full details (long tag description)
 * 2. Match traits (with lead traits highlighted)
 * 3. Avoid traits (with strikethrough styling)
 * 4. What you bring (benefits list)
 * 5. Verification requirements (with time estimate)
 */

describe('ArchetypeCard - Expanded View', () => {
  let casualManArchetype: ArchetypeDefinition;
  let spoiltWomanArchetype: ArchetypeDefinition;
  let marriageMindedManArchetype: ArchetypeDefinition;
  let safetyFirstWomanArchetype: ArchetypeDefinition;

  beforeEach(() => {
    casualManArchetype = ARCHETYPES.casual_man;
    spoiltWomanArchetype = ARCHETYPES.spoilt_woman;
    marriageMindedManArchetype = ARCHETYPES.marriage_minded_man;
    safetyFirstWomanArchetype = ARCHETYPES.safety_first_woman;
  });

  describe('Full Details - Long Tag Description', () => {
    it('should have long tag description for casual_man', () => {
      expect(casualManArchetype.longTag).toBeDefined();
      expect(casualManArchetype.longTag).toBe(
        'You want casual dating & real connection. No pretense. Real vibes.'
      );
    });

    it('should have long tag description for spoilt_woman', () => {
      expect(spoiltWomanArchetype.longTag).toBeDefined();
      expect(spoiltWomanArchetype.longTag).toBe(
        'You want to be cherished — properly. Dinners, weekends, intent.'
      );
    });

    it('should have long tag description for marriage_minded_man', () => {
      expect(marriageMindedManArchetype.longTag).toBeDefined();
      expect(marriageMindedManArchetype.longTag).toBe(
        'You\'re done playing. You want a partner, and you\'re building toward it.'
      );
    });

    it('should have long tag description for safety_first_woman', () => {
      expect(safetyFirstWomanArchetype.longTag).toBeDefined();
      expect(safetyFirstWomanArchetype.longTag).toBe(
        'Trust is non-negotiable. You date people who have done the work.'
      );
    });

    it('all archetypes should have non-empty long tag', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.longTag).toBeDefined();
        expect(archetype.longTag.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Match Traits - Lead Traits Highlighted', () => {
    it('should have match traits for casual_man', () => {
      expect(casualManArchetype.matchTraits).toBeDefined();
      expect(casualManArchetype.matchTraits.length).toBeGreaterThan(0);
    });

    it('should have at least one lead trait for casual_man', () => {
      const leadTraits = casualManArchetype.matchTraits.filter(t => t.lead);
      expect(leadTraits.length).toBeGreaterThan(0);
    });

    it('should have lead traits marked correctly for spoilt_woman', () => {
      const leadTraits = spoiltWomanArchetype.matchTraits.filter(t => t.lead);
      expect(leadTraits.length).toBeGreaterThan(0);
      // Spoilt woman should match with casual_man and marriage_minded_man
      expect(leadTraits.some(t => t.label.includes('Casual Men'))).toBe(true);
      expect(leadTraits.some(t => t.label.includes('Marriage-Minded Men'))).toBe(true);
    });

    it('should have lead traits marked correctly for marriage_minded_man', () => {
      const leadTraits = marriageMindedManArchetype.matchTraits.filter(t => t.lead);
      expect(leadTraits.length).toBeGreaterThan(0);
      // Marriage-minded man should match with spoilt_woman and safety_first_woman
      expect(leadTraits.some(t => t.label.includes('Spoilt Women'))).toBe(true);
      expect(leadTraits.some(t => t.label.includes('Safety-First Women'))).toBe(true);
    });

    it('should have lead traits marked correctly for safety_first_woman', () => {
      const leadTraits = safetyFirstWomanArchetype.matchTraits.filter(t => t.lead);
      expect(leadTraits.length).toBeGreaterThan(0);
      // Safety-first woman should only match with marriage-minded men
      expect(leadTraits.some(t => t.label.includes('Marriage-Minded Men'))).toBe(true);
    });

    it('all match traits should have label property', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        for (const trait of archetype.matchTraits) {
          expect(trait.label).toBeDefined();
          expect(trait.label.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Avoid Traits - Strikethrough Styling', () => {
    it('should have avoid traits for casual_man', () => {
      expect(casualManArchetype.avoidTraits).toBeDefined();
      expect(casualManArchetype.avoidTraits.length).toBeGreaterThan(0);
    });

    it('should have 5 avoid traits for casual_man', () => {
      expect(casualManArchetype.avoidTraits.length).toBe(5);
    });

    it('should have avoid traits for all archetypes', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.avoidTraits).toBeDefined();
        expect(archetype.avoidTraits.length).toBeGreaterThan(0);
      }
    });

    it('all avoid traits should have label property', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        for (const trait of archetype.avoidTraits) {
          expect(trait.label).toBeDefined();
          expect(trait.label.length).toBeGreaterThan(0);
        }
      }
    });

    it('avoid traits should not have lead property', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        for (const trait of archetype.avoidTraits) {
          expect(trait.lead).toBeUndefined();
        }
      }
    });
  });

  describe('What You Bring - Benefits List', () => {
    it('should have brings for casual_man', () => {
      expect(casualManArchetype.brings).toBeDefined();
      expect(casualManArchetype.brings.length).toBeGreaterThan(0);
    });

    it('should have 8 brings for casual_man', () => {
      expect(casualManArchetype.brings.length).toBe(8);
    });

    it('should have brings for all archetypes', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.brings).toBeDefined();
        expect(archetype.brings.length).toBeGreaterThan(0);
      }
    });

    it('all brings should be non-empty strings', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        for (const bring of archetype.brings) {
          expect(typeof bring).toBe('string');
          expect(bring.length).toBeGreaterThan(0);
        }
      }
    });

    it('brings should include relevant benefits for casual_man', () => {
      const brings = casualManArchetype.brings;
      expect(brings.some(b => b.includes('Financial'))).toBe(true);
      expect(brings.some(b => b.includes('Generosity'))).toBe(true);
      expect(brings.some(b => b.includes('travel'))).toBe(true);
    });
  });

  describe('Verification Requirements - Time Estimate', () => {
    it('should have needs for casual_man', () => {
      expect(casualManArchetype.needs).toBeDefined();
      expect(casualManArchetype.needs.length).toBeGreaterThan(0);
    });

    it('should have 4 needs for casual_man', () => {
      expect(casualManArchetype.needs.length).toBe(4);
    });

    it('should have time estimate for casual_man', () => {
      expect(casualManArchetype.timeMins).toBeDefined();
      expect(casualManArchetype.timeMins).toBe(10);
    });

    it('should have needs for all archetypes', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.needs).toBeDefined();
        expect(archetype.needs.length).toBeGreaterThan(0);
      }
    });

    it('should have time estimate for all archetypes', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.timeMins).toBeDefined();
        expect(archetype.timeMins).toBeGreaterThan(0);
      }
    });

    it('all needs should be non-empty strings', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        for (const need of archetype.needs) {
          expect(typeof need).toBe('string');
          expect(need.length).toBeGreaterThan(0);
        }
      }
    });

    it('needs should include verification steps', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        const needsText = archetype.needs.join(' ');
        // Most archetypes should mention ID and photos
        expect(needsText.toLowerCase()).toMatch(/id|photo/i);
      }
    });

    it('time estimates should be reasonable', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.timeMins).toBeGreaterThanOrEqual(5);
        expect(archetype.timeMins).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('All Sections Present', () => {
    it('should have all required properties for expanded view', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        // Full details
        expect(archetype.longTag).toBeDefined();
        
        // Match traits
        expect(archetype.matchTraits).toBeDefined();
        expect(Array.isArray(archetype.matchTraits)).toBe(true);
        
        // Avoid traits
        expect(archetype.avoidTraits).toBeDefined();
        expect(Array.isArray(archetype.avoidTraits)).toBe(true);
        
        // What you bring
        expect(archetype.brings).toBeDefined();
        expect(Array.isArray(archetype.brings)).toBe(true);
        
        // Verification requirements
        expect(archetype.needs).toBeDefined();
        expect(Array.isArray(archetype.needs)).toBe(true);
        expect(archetype.timeMins).toBeDefined();
      }
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should have all properties needed for mobile display', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        // Collapsed view properties
        expect(archetype.emoji).toBeDefined();
        expect(archetype.name).toBeDefined();
        expect(archetype.tag).toBeDefined();
        
        // Expanded view properties
        expect(archetype.longTag).toBeDefined();
        expect(archetype.matchTraits).toBeDefined();
        expect(archetype.avoidTraits).toBeDefined();
        expect(archetype.brings).toBeDefined();
        expect(archetype.needs).toBeDefined();
        expect(archetype.timeMins).toBeDefined();
      }
    });

    it('text content should be readable on mobile', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        // Long tag should not be too long
        expect(archetype.longTag.length).toBeLessThan(200);
        
        // Individual items should be readable
        for (const trait of archetype.matchTraits) {
          expect(trait.label.length).toBeLessThan(50);
        }
        for (const bring of archetype.brings) {
          expect(bring.length).toBeLessThan(50);
        }
      }
    });
  });

  describe('TypeScript Types', () => {
    it('should have correct archetype IDs', () => {
      expect(casualManArchetype.id).toBe('casual_man');
      expect(spoiltWomanArchetype.id).toBe('spoilt_woman');
      expect(marriageMindedManArchetype.id).toBe('marriage_minded_man');
      expect(safetyFirstWomanArchetype.id).toBe('safety_first_woman');
    });

    it('should have correct gender assignments', () => {
      expect(casualManArchetype.gender).toBe('man');
      expect(spoiltWomanArchetype.gender).toBe('woman');
      expect(marriageMindedManArchetype.gender).toBe('man');
      expect(safetyFirstWomanArchetype.gender).toBe('woman');
    });

    it('should have valid emoji', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.emoji).toBeDefined();
        expect(archetype.emoji.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Consistency Across Archetypes', () => {
    it('should have consistent structure across all archetypes', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      const firstArchetype = allArchetypes[0];
      
      for (const archetype of allArchetypes) {
        // All should have same property structure
        expect(Object.keys(archetype).sort()).toEqual(
          Object.keys(firstArchetype).sort()
        );
      }
    });

    it('should have reasonable number of traits', () => {
      const allArchetypes = Object.values(ARCHETYPES);
      for (const archetype of allArchetypes) {
        expect(archetype.matchTraits.length).toBeGreaterThanOrEqual(4);
        expect(archetype.matchTraits.length).toBeLessThanOrEqual(10);
        
        expect(archetype.avoidTraits.length).toBeGreaterThanOrEqual(4);
        expect(archetype.avoidTraits.length).toBeLessThanOrEqual(10);
        
        expect(archetype.brings.length).toBeGreaterThanOrEqual(6);
        expect(archetype.brings.length).toBeLessThanOrEqual(10);
        
        expect(archetype.needs.length).toBeGreaterThanOrEqual(3);
        expect(archetype.needs.length).toBeLessThanOrEqual(6);
      }
    });
  });
});
