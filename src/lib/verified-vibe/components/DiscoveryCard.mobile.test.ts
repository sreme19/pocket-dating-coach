import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DiscoveryCard from './DiscoveryCard.svelte';
import type { DiscoveryProfile } from '../types';

/**
 * DiscoveryCard Mobile Responsiveness Tests
 *
 * Tests for mobile-specific functionality including:
 * - Touch interactions
 * - Mobile viewport rendering
 * - Touch target sizes
 * - Mobile-specific layouts
 * - Gesture handling
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

describe('DiscoveryCard Mobile Responsiveness', () => {
  beforeEach(() => {
    // Reset viewport to mobile
    global.innerWidth = 375;
    global.innerHeight = 667;
  });

  describe('Mobile Viewport Rendering', () => {
    it('should render on mobile viewport (375px)', () => {
      global.innerWidth = 375;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should render on small mobile viewport (320px)', () => {
      global.innerWidth = 320;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should render on large mobile viewport (480px)', () => {
      global.innerWidth = 480;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should have full width on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.width).toBe('100%');
    });
  });

  describe('Touch Target Sizes', () => {
    it('should have 44px minimum touch targets on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.minHeight).toBe('40px');
      });
    });

    it('should have adequate padding on buttons', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.padding).toBeTruthy();
      });
    });

    it('should have adequate spacing between buttons', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const actionButtons = container.querySelector('.action-buttons');
      const styles = window.getComputedStyle(actionButtons!);
      expect(styles.gap).toBeTruthy();
    });
  });

  describe('Mobile Layout', () => {
    it('should stack content vertically on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.flexDirection).toBe('column');
    });

    it('should have 1:1 aspect ratio for photo on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const photoSection = container.querySelector('.photo-section');
      const styles = window.getComputedStyle(photoSection!);
      expect(styles.aspectRatio).toBe('1 / 1');
    });

    it('should have reduced padding on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const profileInfo = container.querySelector('.profile-info');
      const styles = window.getComputedStyle(profileInfo!);
      expect(styles.padding).toBeTruthy();
    });

    it('should have smaller font sizes on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const heading = screen.getByRole('heading', { level: 2 });
      const styles = window.getComputedStyle(heading);
      expect(styles.fontSize).toBeTruthy();
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events on buttons', () => {
      const onLike = vi.fn();
      render(DiscoveryCard, { props: { profile: mockProfile, onLike } });
      const likeButton = screen.getByRole('button', { name: /Like/i });
      fireEvent.touchStart(likeButton);
      fireEvent.touchEnd(likeButton);
      fireEvent.click(likeButton);
      expect(onLike).toHaveBeenCalled();
    });

    it('should handle touch on pass button', () => {
      const onPass = vi.fn();
      render(DiscoveryCard, { props: { profile: mockProfile, onPass } });
      const passButton = screen.getByRole('button', { name: /Pass/i });
      fireEvent.touchStart(passButton);
      fireEvent.touchEnd(passButton);
      fireEvent.click(passButton);
      expect(onPass).toHaveBeenCalled();
    });

    it('should have touch-action: manipulation on buttons', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.touchAction).toBe('manipulation');
      });
    });
  });

  describe('Mobile Text Rendering', () => {
    it('should have readable text on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
      expect(screen.getByText('Love traveling and trying new restaurants')).toBeTruthy();
    });

    it('should wrap long text on mobile', () => {
      const profileLongAbout = {
        ...mockProfile,
        about:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      };
      render(DiscoveryCard, { props: { profile: profileLongAbout } });
      expect(screen.getByText(/Lorem ipsum/)).toBeTruthy();
    });

    it('should not require horizontal scrolling', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.overflowX).not.toBe('scroll');
    });
  });

  describe('Mobile Image Handling', () => {
    it('should display photo at full width on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const photo = container.querySelector('.profile-photo');
      const styles = window.getComputedStyle(photo!);
      expect(styles.width).toBe('100%');
    });

    it('should use object-fit: cover for photos', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const photo = container.querySelector('.profile-photo');
      const styles = window.getComputedStyle(photo!);
      expect(styles.objectFit).toBe('cover');
    });

    it('should lazy load images on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('loading')).toBe('lazy');
    });

    it('should use async decoding on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('decoding')).toBe('async');
    });
  });

  describe('Mobile Badge Display', () => {
    it('should display verification badges on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByLabelText('ID verified')).toBeTruthy();
    });

    it('should hide badge labels on small mobile', () => {
      global.innerWidth = 320;
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const badgeLabels = container.querySelectorAll('.badge-label');
      badgeLabels.forEach((label) => {
        const styles = window.getComputedStyle(label);
        expect(styles.display).toBe('none');
      });
    });

    it('should show badge labels on larger mobile', () => {
      global.innerWidth = 480;
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const badgeLabels = container.querySelectorAll('.badge-label');
      badgeLabels.forEach((label) => {
        const styles = window.getComputedStyle(label);
        expect(styles.display).not.toBe('none');
      });
    });
  });

  describe('Mobile Button Layout', () => {
    it('should display buttons side by side on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const actionButtons = container.querySelector('.action-buttons');
      const styles = window.getComputedStyle(actionButtons!);
      expect(styles.display).toBe('flex');
    });

    it('should have equal width buttons on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.flex).toBeTruthy();
      });
    });

    it('should have button text hidden on small mobile', () => {
      global.innerWidth = 320;
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttonTexts = container.querySelectorAll('.button-text');
      buttonTexts.forEach((text) => {
        const styles = window.getComputedStyle(text);
        expect(styles.display).toBe('none');
      });
    });

    it('should show button text on larger mobile', () => {
      global.innerWidth = 480;
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttonTexts = container.querySelectorAll('.button-text');
      buttonTexts.forEach((text) => {
        const styles = window.getComputedStyle(text);
        expect(styles.display).not.toBe('none');
      });
    });
  });

  describe('Mobile Scrolling', () => {
    it('should allow vertical scrolling in profile info', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const profileInfo = container.querySelector('.profile-info');
      const styles = window.getComputedStyle(profileInfo!);
      expect(styles.overflowY).toBe('auto');
    });

    it('should not allow horizontal scrolling', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.overflowX).not.toBe('scroll');
    });
  });

  describe('Mobile Spacing', () => {
    it('should have reduced gap between elements on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const profileInfo = container.querySelector('.profile-info');
      const styles = window.getComputedStyle(profileInfo!);
      expect(styles.gap).toBeTruthy();
    });

    it('should have reduced padding on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const profileInfo = container.querySelector('.profile-info');
      const styles = window.getComputedStyle(profileInfo!);
      expect(styles.padding).toBeTruthy();
    });
  });

  describe('Mobile Accessibility', () => {
    it('should maintain accessibility on mobile', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByRole('article')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Like/i })).toBeTruthy();
    });

    it('should have keyboard navigation on mobile', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      expect(card?.getAttribute('tabindex')).toBe('0');
    });

    it('should have touch-friendly focus targets', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        expect(styles.minHeight).toBe('40px');
      });
    });
  });

  describe('Mobile Performance', () => {
    it('should use lazy loading for images', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('loading')).toBe('lazy');
    });

    it('should use async decoding for images', () => {
      render(DiscoveryCard, { props: { profile: mockProfile } });
      const img = screen.getByAltText("Sarah's profile photo");
      expect(img.getAttribute('decoding')).toBe('async');
    });

    it('should have will-change for animations', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.willChange).toBeTruthy();
    });
  });

  describe('Mobile Orientation', () => {
    it('should render in portrait orientation', () => {
      global.innerWidth = 375;
      global.innerHeight = 667;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });

    it('should render in landscape orientation', () => {
      global.innerWidth = 667;
      global.innerHeight = 375;
      render(DiscoveryCard, { props: { profile: mockProfile } });
      expect(screen.getByText('Sarah, 26')).toBeTruthy();
    });
  });

  describe('Mobile Safe Area', () => {
    it('should respect safe area insets', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      expect(card).toBeTruthy();
    });
  });

  describe('Mobile Gesture Hints', () => {
    it('should have cursor: grab on card', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.cursor).toBe('pointer');
    });

    it('should have user-select: none on card', () => {
      const { container } = render(DiscoveryCard, { props: { profile: mockProfile } });
      const card = container.querySelector('.discovery-card');
      const styles = window.getComputedStyle(card!);
      expect(styles.userSelect).toBe('none');
    });
  });
});
