import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DiscoveryCard from './DiscoveryCard.svelte';
import type { DiscoveryProfile } from '../types';

/**
 * DiscoveryCard Component Tests
 *
 * Tests for the DiscoveryCard component including:
 * - Profile data display (name, age, archetype, distance)
 * - Photo display and placeholder handling
 * - Trust score badge display
 * - Verification badges display
 * - Like and Pass button functionality
 * - Keyboard navigation
 * - Accessibility features
 */

// Mock profile data
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

const mockProfileNoPhoto: DiscoveryProfile = {
  ...mockProfile,
  avatar: null
};

const mockProfileNoAbout: DiscoveryProfile = {
  ...mockProfile,
  about: null,
  looking: null
};

describe('DiscoveryCard Component', () => {
  describe('Profile Display', () => {
    it('should display profile name and age', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeInTheDocument();
    });

    it('should display archetype emoji', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const archetypeEmoji = screen.getByLabelText('spoilt woman');
      expect(archetypeEmoji.textContent).toBe('💎');
    });

    it('should display distance', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('2 mi')).toBeInTheDocument();
    });

    it('should display about text', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Love traveling and trying new restaurants')).toBeInTheDocument();
    });

    it('should display looking for text', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Someone who appreciates the finer things')).toBeInTheDocument();
    });

    it('should not display about section when about is null', () => {
      render(DiscoveryCard, { props: { profile: mockProfileNoAbout } });
      expect(screen.queryByText('Love traveling')).not.toBeInTheDocument();
    });

    it('should not display looking section when looking is null', () => {
      render(DiscoveryCard, { props: { profile: mockProfileNoAbout } });
      expect(screen.queryByText('Someone who appreciates')).not.toBeInTheDocument();
    });
  });

  describe('Photo Display', () => {
    it('should display profile photo when avatar is provided', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg');
    });

    it('should display photo placeholder when avatar is null', () => {
      render(DiscoveryCard, { props: { profile: mockProfileNoPhoto } });
      expect(screen.getByLabelText('No photo available')).toBeInTheDocument();
    });

    it('should have lazy loading on profile photo', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('loading')).toBe('lazy');
    });

    it('should have async decoding on profile photo', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('decoding')).toBe('async');
    });
  });

  describe('Trust Score Badge', () => {
    it('should display trust score badge', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should display correct trust score for different values', () => {
      const profileLowTrust = { ...mockProfile, trustScore: 25 };
      render(DiscoveryCard, { props: { profile: profileLowTrust } });
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should display trust score details', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('85/100')).toBeInTheDocument();
    });
  });

  describe('Verification Badges', () => {
    it('should display verification badges for completed steps', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('ID verified')).toBeInTheDocument();
      expect(screen.getByLabelText('Photos verified')).toBeInTheDocument();
      expect(screen.getByLabelText('Q&A verified')).toBeInTheDocument();
    });

    it('should display correct verification count', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('3/4 steps')).toBeInTheDocument();
    });

    it('should not display verification badges when none are verified', () => {
      const profileNoVerified = { ...mockProfile, verified: [] };
      render(DiscoveryCard, { props: { profile: profileNoVerified } });
      expect(screen.queryByLabelText('ID verified')).not.toBeInTheDocument();
    });

    it('should display only verified badges', () => {
      const profilePartialVerified = { ...mockProfile, verified: ['id', 'photos'] };
      render(DiscoveryCard, { props: { profile: profilePartialVerified } });
      expect(screen.getByLabelText('ID verified')).toBeInTheDocument();
      expect(screen.getByLabelText('Photos verified')).toBeInTheDocument();
      expect(screen.queryByLabelText('Q&A verified')).not.toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should call onLike when like button is clicked', async () => {
      const onLike = vi.fn();
      const user = userEvent.setup();
      render(DiscoveryCard, { props: { profile: mockProfile, onLike } });
      const likeButton = screen.getByLabelText('Like this profile');
      await user.click(likeButton);
      expect(onLike).toHaveBeenCalled();
    });

    it('should call onPass when pass button is clicked', async () => {
      const onPass = vi.fn();
      const user = userEvent.setup();
      render(DiscoveryCard, { props: { profile: mockProfile, onPass } });
      const passButton = screen.getByLabelText('Pass on this profile');
      await user.click(passButton);
      expect(onPass).toHaveBeenCalled();
    });

    it('should have accessible button labels', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('Like this profile')).toBeInTheDocument();
      expect(screen.getByLabelText('Pass on this profile')).toBeInTheDocument();
    });

    it('should have button titles for keyboard hints', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const likeButton = screen.getByLabelText('Like this profile');
      const passButton = screen.getByLabelText('Pass on this profile');
      expect(likeButton.getAttribute('title')).toContain('Like');
      expect(passButton.getAttribute('title')).toContain('Pass');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should like profile on ArrowRight key', () => {
      const onLike = vi.fn();
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile, onLike } });
      const card = container.querySelector('article');
      fireEvent.keydown(card, { key: 'ArrowRight' });
      expect(onLike).toHaveBeenCalled();
    });

    it('should like profile on Enter key', () => {
      const onLike = vi.fn();
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile, onLike } });
      const card = container.querySelector('article');
      fireEvent.keydown(card, { key: 'Enter' });
      expect(onLike).toHaveBeenCalled();
    });

    it('should pass profile on ArrowLeft key', () => {
      const onPass = vi.fn();
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile, onPass } });
      const card = container.querySelector('article');
      fireEvent.keydown(card, { key: 'ArrowLeft' });
      expect(onPass).toHaveBeenCalled();
    });

    it('should pass profile on Backspace key', () => {
      const onPass = vi.fn();
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile, onPass } });
      const card = container.querySelector('article');
      fireEvent.keydown(card, { key: 'Backspace' });
      expect(onPass).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = screen.getByRole('article');
      expect(card.getAttribute('aria-label')).toContain('Sarah');
      expect(card.getAttribute('aria-label')).toContain('26');
      expect(card.getAttribute('aria-label')).toContain('2 mi');
    });

    it('should be keyboard focusable', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('article');
      expect(card?.getAttribute('tabindex')).toBe('0');
    });

    it('should have semantic HTML structure', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Profile photo/i })).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.textContent).toContain('Sarah, 26');
    });

    it('should have aria-hidden on decorative icons', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const icons = container.querySelectorAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long names', () => {
      const profileLongName = {
        ...mockProfile,
        firstName: 'VeryLongNameThatShouldWrapProperly'
      };
      render(DiscoveryCard, { props: { profile: profileLongName } });
      expect(screen.getByText(/VeryLongNameThatShouldWrapProperly/)).toBeInTheDocument();
    });

    it('should handle very long about text', () => {
      const profileLongAbout = {
        ...mockProfile,
        about:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      };
      render(DiscoveryCard, { props: { profile: profileLongAbout } });
      expect(screen.getByText(/Lorem ipsum/)).toBeInTheDocument();
    });

    it('should handle zero trust score', () => {
      const profileZeroTrust = { ...mockProfile, trustScore: 0 };
      render(DiscoveryCard, { props: { profile: profileZeroTrust } });
      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('should handle maximum trust score', () => {
      const profileMaxTrust = { ...mockProfile, trustScore: 100 };
      render(DiscoveryCard, { props: { profile: profileMaxTrust } });
      expect(screen.getByText('100/100')).toBeInTheDocument();
    });

    it('should handle all verification steps', () => {
      const profileAllVerified = {
        ...mockProfile,
        verified: ['id', 'liveness', 'photos', 'spending_or_qa']
      };
      render(DiscoveryCard, { props: { profile: profileAllVerified } });
      expect(screen.getByText('4/4 steps')).toBeInTheDocument();
    });

    it('should handle different archetype emojis', () => {
      const archetypes = [
        { archetype: 'casual_man', emoji: '🎯' },
        { archetype: 'marriage_minded_man', emoji: '💍' },
        { archetype: 'spoilt_woman', emoji: '💎' },
        { archetype: 'safety_first_woman', emoji: '🛡️' }
      ];

      archetypes.forEach(({ archetype, emoji }) => {
        const profile = { ...mockProfile, archetype: archetype as any };
        const { unmount } = render(DiscoveryCard, { props: { profile } });
        const archetypeElement = screen.getByLabelText(archetype.replace(/_/g, ' '));
        expect(archetypeElement.textContent).toBe(emoji);
        unmount();
      });
    });
  });

  describe('Props Handling', () => {
    it('should accept profile prop', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeInTheDocument();
    });

    it('should accept onLike callback', async () => {
      const onLike = vi.fn();
      const user = userEvent.setup();
      render(DiscoveryCard, { props: { profile: mockProfile, onLike } });
      const likeButton = screen.getByLabelText('Like this profile');
      await user.click(likeButton);
      expect(onLike).toHaveBeenCalled();
    });

    it('should accept onPass callback', async () => {
      const onPass = vi.fn();
      const user = userEvent.setup();
      render(DiscoveryCard, { props: { profile: mockProfile, onPass } });
      const passButton = screen.getByLabelText('Pass on this profile');
      await user.click(passButton);
      expect(onPass).toHaveBeenCalled();
    });

    it('should handle optional callbacks', () => {
      expect(() => {
        render(DiscoveryCard, { props: { profile: mockProfile } });
      }).not.toThrow();
    });
  });
});
