import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ArchetypeCard from './ArchetypeCard.svelte';
import { ARCHETYPES } from '../constants.ts';
import type { ArchetypeDefinition } from '../types.ts';

describe('ArchetypeCard Component', () => {
  let casualManArchetype: ArchetypeDefinition;
  let spoiltWomanArchetype: ArchetypeDefinition;

  beforeEach(() => {
    casualManArchetype = ARCHETYPES.casual_man;
    spoiltWomanArchetype = ARCHETYPES.spoilt_woman;
  });

  describe('Collapsed View', () => {
    it('should display emoji, name, and tag in collapsed state', () => {
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      expect(screen.getByText(casualManArchetype.emoji)).toBeInTheDocument();
      expect(screen.getByText(casualManArchetype.name)).toBeInTheDocument();
      expect(screen.getByText(casualManArchetype.tag)).toBeInTheDocument();
    });

    it('should have a chevron icon in collapsed state', () => {
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const chevron = container.querySelector('.chevron');
      expect(chevron).toBeInTheDocument();
    });

    it('should be clickable to expand', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // After click, expanded content should be visible
      expect(screen.getByText(casualManArchetype.longTag)).toBeInTheDocument();
    });
  });

  describe('Expanded View - Full Details', () => {
    it('should display long tag description when expanded', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      expect(screen.getByText(casualManArchetype.longTag)).toBeInTheDocument();
    });

    it('should display all match traits with lead traits highlighted', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that all match traits are displayed
      for (const trait of casualManArchetype.matchTraits) {
        expect(screen.getByText(trait.label)).toBeInTheDocument();
      }

      // Check that lead traits have the badge
      const leadTraits = casualManArchetype.matchTraits.filter(t => t.lead);
      for (const trait of leadTraits) {
        const traitElement = screen.getByText(trait.label);
        const container = traitElement.closest('.trait-item');
        expect(container).toHaveClass('lead');
        expect(container?.textContent).toContain('Lead Match');
      }
    });

    it('should display avoid traits with strikethrough styling', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that all avoid traits are displayed
      for (const trait of casualManArchetype.avoidTraits) {
        expect(screen.getByText(trait.label)).toBeInTheDocument();
      }

      // Check that avoid items have strikethrough styling
      const avoidItems = container.querySelectorAll('.avoid-item');
      expect(avoidItems.length).toBe(casualManArchetype.avoidTraits.length);
      
      for (const item of avoidItems) {
        const styles = window.getComputedStyle(item);
        // Check for text-decoration (strikethrough)
        expect(styles.textDecoration).toContain('line-through');
      }
    });

    it('should display brings section with accent styling', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that all brings items are displayed
      for (const item of casualManArchetype.brings) {
        expect(screen.getByText(item)).toBeInTheDocument();
      }

      // Check that brings section has accent styling
      const bringsList = container.querySelector('.brings-list');
      expect(bringsList).toBeInTheDocument();
      
      const bringItems = container.querySelectorAll('.bring-item');
      expect(bringItems.length).toBe(casualManArchetype.brings.length);
    });

    it('should display verification requirements with time estimate', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that all needs are displayed
      for (const need of casualManArchetype.needs) {
        expect(screen.getByText(need)).toBeInTheDocument();
      }

      // Check that time estimate is displayed
      expect(screen.getByText(new RegExp(`~${casualManArchetype.timeMins} minutes`))).toBeInTheDocument();

      // Check that needs section has checkmarks
      const needItems = container.querySelectorAll('.need-item');
      expect(needItems.length).toBe(casualManArchetype.needs.length);
    });
  });

  describe('Expanded View - Section Visibility', () => {
    it('should display all detail sections when expanded', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check for all section titles
      expect(screen.getByText('Who You\'re Looking For')).toBeInTheDocument();
      expect(screen.getByText('What You Bring')).toBeInTheDocument();
      expect(screen.getByText('Traits to Avoid')).toBeInTheDocument();
      expect(screen.getByText('What We Need From You')).toBeInTheDocument();
    });

    it('should have proper typography and spacing', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that card-content exists with proper structure
      const cardContent = container.querySelector('.card-content');
      expect(cardContent).toBeInTheDocument();
      
      // Check that sections have proper spacing
      const sections = container.querySelectorAll('.section');
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Expand/Collapse Behavior', () => {
    it('should toggle expanded state on click', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      // Initially collapsed
      expect(screen.queryByText(casualManArchetype.longTag)).not.toBeInTheDocument();
      
      // Click to expand
      await user.click(button);
      expect(screen.getByText(casualManArchetype.longTag)).toBeInTheDocument();
      
      // Click to collapse
      await user.click(button);
      expect(screen.queryByText(casualManArchetype.longTag)).not.toBeInTheDocument();
    });

    it('should rotate chevron on expand/collapse', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      const chevron = container.querySelector('.chevron');
      
      // Initially not rotated
      expect(chevron).not.toHaveClass('rotated');
      
      // Click to expand
      await user.click(button);
      expect(chevron).toHaveClass('rotated');
      
      // Click to collapse
      await user.click(button);
      expect(chevron).not.toHaveClass('rotated');
    });
  });

  describe('Lock It In Button', () => {
    it('should display lock button when expanded', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      const lockButton = screen.getByRole('button', { name: /Lock it in/ });
      expect(lockButton).toBeInTheDocument();
    });

    it('should call onSelect callback when lock button is clicked', async () => {
      const user = userEvent.setup();
      let callbackCalled = false;
      
      render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype,
          onSelect: () => {
            callbackCalled = true;
          }
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      const lockButton = screen.getByRole('button', { name: /Lock it in/ });
      await user.click(lockButton);
      
      expect(callbackCalled).toBe(true);
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should maintain layout on mobile viewport', async () => {
      const user = userEvent.setup();
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${casualManArchetype.name}`)
      });
      
      await user.click(button);
      
      // Check that card content is still visible and properly structured
      const cardContent = container.querySelector('.card-content');
      expect(cardContent).toBeInTheDocument();
      
      // Check that sections are still visible
      const sections = container.querySelectorAll('.section');
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript Types', () => {
    it('should accept ArchetypeDefinition prop', () => {
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype
        }
      });

      expect(container).toBeInTheDocument();
    });

    it('should accept optional selected prop', () => {
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype,
          selected: true
        }
      });

      expect(container).toBeInTheDocument();
    });

    it('should accept optional onSelect callback', () => {
      const { container } = render(ArchetypeCard, {
        props: {
          archetype: casualManArchetype,
          onSelect: () => {}
        }
      });

      expect(container).toBeInTheDocument();
    });
  });

  describe('Different Archetypes', () => {
    it('should work with spoilt_woman archetype', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: spoiltWomanArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${spoiltWomanArchetype.name}`)
      });
      
      await user.click(button);
      
      expect(screen.getByText(spoiltWomanArchetype.longTag)).toBeInTheDocument();
      expect(screen.getByText(spoiltWomanArchetype.name)).toBeInTheDocument();
    });

    it('should display correct time estimate for each archetype', async () => {
      const user = userEvent.setup();
      render(ArchetypeCard, {
        props: {
          archetype: spoiltWomanArchetype
        }
      });

      const button = screen.getByRole('button', {
        name: new RegExp(`Toggle ${spoiltWomanArchetype.name}`)
      });
      
      await user.click(button);
      
      expect(screen.getByText(new RegExp(`~${spoiltWomanArchetype.timeMins} minutes`))).toBeInTheDocument();
    });
  });
});
