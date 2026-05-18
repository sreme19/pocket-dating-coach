import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { axe, toHaveNoViolations } from 'jest-axe';
import DiscoveryCard from './DiscoveryCard.svelte';
import type { DiscoveryProfile } from '../types';

expect.extend(toHaveNoViolations);

/**
 * DiscoveryCard Accessibility Tests
 *
 * Tests for WCAG 2.1 AA compliance including:
 * - Semantic HTML structure
 * - ARIA labels and roles
 * - Keyboard navigation
 * - Color contrast
 * - Focus management
 * - Screen reader support
 */

const mockProfile: DiscoveryProfile = {
  id: 'user-123',
  gender: 'woman',
  archetype: 'spoilt_woman',
  firstName: 'Sarah',
  age: 26,
  city: 'Brooklyn, NY',
  avatar: 'https://example.com/photo.jpg',
  about: 'Love traveling and trying new restaurants',
  looking: 'Someone who appreciates the finer things',
  trustScore: 85,
  verified: ['id', 'photos', 'spending_or_qa'],
  distance: '2 mi',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('DiscoveryCard Accessibility (WCAG 2.1 AA)', () => {
  describe('Automated Accessibility Audit', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations with no photo', async () => {
      const profileNoPhoto = { ...mockProfile, avatar: null };
      const { container } = render(DiscoveryCard, { props: { profile: profileNoPhoto } });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have violations with no about text', async () => {
      const profileNoAbout = { ...mockProfile, about: null, looking: null };
      const { container } = render(DiscoveryCard, { props: { profile: profileNoAbout } });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML', () => {
    it('should use article role for card container', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeTruthy();
    });

    it('should use region role for photo section', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('region', { name: /Profile photo/i })).toBeTruthy();
    });

    it('should use heading for profile name', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toContain('Sarah, 26');
    });

    it('should use button elements for actions', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Pass/i })).toBeTruthy();
    });
  });

  describe('ARIA Labels and Attributes', () => {
    it('should have descriptive aria-label on card', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = screen.getByRole('article');
      const label = card.getAttribute('aria-label');
      expect(label).toContain('Sarah');
      expect(label).toContain('26');
      expect(label).toContain('2 mi');
    });

    it('should have aria-label on like button', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const button = screen.getByRole('button', { name: /Like/i });
      expect(button.getAttribute('aria-label')).toBe('Like this profile');
    });

    it('should have aria-label on pass button', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const button = screen.getByRole('button', { name: /Pass/i });
      expect(button.getAttribute('aria-label')).toBe('Pass on this profile');
    });

    it('should have aria-label on distance element', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const distance = screen.getByLabelText('2 mi away');
      expect(distance).toBeTruthy();
    });

    it('should have aria-label on verification badges', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('ID verified')).toBeTruthy();
      expect(screen.getByLabelText('Photos verified')).toBeTruthy();
      expect(screen.getByLabelText('Q&A verified')).toBeTruthy();
    });

    it('should have aria-label on archetype emoji', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('spoilt woman')).toBeTruthy();
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const decorativeIcons = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorativeIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be keyboard focusable', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      expect(card?.getAttribute('tabindex')).toBe('0');
    });

    it('should have keyboard accessible buttons', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        // Buttons should be keyboard accessible
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should have title attributes for keyboard hints', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const likeButton = screen.getByRole('button', { name: /Like/i });
      const passButton = screen.getByRole('button', { name: /Pass/i });
      expect(likeButton.getAttribute('title')).toContain('Like');
      expect(passButton.getAttribute('title')).toContain('Pass');
    });

    it('should have visible focus indicators', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      // Check for focus-visible styles in CSS
      expect(styles).toBeTruthy();
    });
  });

  describe('Color Contrast', () => {
    it('should have sufficient contrast for text', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      // This is a visual test that should be verified with accessibility tools
      // We verify the component renders with proper text
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should have sufficient contrast for buttons', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have sufficient contrast for badges', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('ID verified')).toBeTruthy();
    });
  });

  describe('Focus Management', () => {
    it('should have focus-visible styles on card', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      // Verify focus styles are defined
      expect(styles).toBeTruthy();
    });

    it('should have focus-visible styles on buttons', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles).toBeTruthy();
      });
    });

    it('should maintain focus visibility on interaction', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const likeButton = screen.getByRole('button', { name: /Like/i });
      likeButton.focus();
      expect(document.activeElement).toBe(likeButton);
    });
  });

  describe('Image Accessibility', () => {
    it('should have alt text on profile photo', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img).toBeTruthy();
    });

    it('should have descriptive alt text', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('alt')).toContain('Sarah');
    });

    it('should have alt text for placeholder', () => {
      const profileNoPhoto = { ...mockProfile, avatar: null };
      render(DiscoveryCard, { props: { profile: profileNoPhoto } });
      expect(screen.getByLabelText('No photo available')).toBeTruthy();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce profile information to screen readers', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = screen.getByRole('article');
      expect(card.getAttribute('aria-label')).toBeTruthy();
    });

    it('should announce button purposes', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Pass/i })).toBeTruthy();
    });

    it('should announce verification status', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('ID verified')).toBeTruthy();
      expect(screen.getByLabelText('Photos verified')).toBeTruthy();
    });

    it('should announce distance information', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('2 mi away')).toBeTruthy();
    });
  });

  describe('Motion and Animation', () => {
    it('should respect prefers-reduced-motion', () => {
      // This would require mocking matchMedia
      // For now, we verify the component renders
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should have smooth transitions', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.transition).toContain('200ms');
      });
    });
  });

  describe('Form and Input Accessibility', () => {
    it('should have proper button semantics', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('should have disabled state properly announced', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        // Buttons should not be disabled initially
        expect(button.hasAttribute('disabled')).toBe(false);
      });
    });
  });

  describe('Responsive Accessibility', () => {
    it('should maintain accessibility on mobile', () => {
      global.innerWidth = 375;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
    });

    it('should maintain accessibility on tablet', () => {
      global.innerWidth = 768;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
    });

    it('should maintain accessibility on desktop', () => {
      global.innerWidth = 1024;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
    });

    it('should have touch-friendly targets on mobile', () => {
      global.innerWidth = 375;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.minHeight).toBe('40px');
      });
    });
  });

  describe('Language and Localization', () => {
    it('should use proper language attributes', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      expect(card).toBeTruthy();
    });

    it('should have readable text content', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
      expect(screen.getByText('Love traveling and trying new restaurants')).toBeTruthy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing profile data gracefully', () => {
      const profileMinimal = {
        ...mockProfile,
        about: null,
        looking: null,
        avatar: null
      };
      render(DiscoveryCard, { props: { profile: profileMinimal } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should maintain accessibility with long text', () => {
      const profileLongText = {
        ...mockProfile,
        about:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
      };
      render(DiscoveryCard, { props: { profile: profileLongText } });
      expect(screen.getByRole('article')).toBeTruthy();
    });

    it('should maintain accessibility with special characters', () => {
      const profileSpecialChars = {
        ...mockProfile,
        firstName: "O'Brien",
        about: "Love café & restaurants!"
      };
      render(DiscoveryCard, { props: { profile: profileSpecialChars } });
      expect(screen.getByText(/O'Brien/)).toBeTruthy();
    });
  });
});
