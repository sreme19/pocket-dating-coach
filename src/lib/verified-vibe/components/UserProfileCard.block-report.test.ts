import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import UserProfileCard from './UserProfileCard.svelte';
import type { DiscoveryProfile } from '../types';

/**
 * Unit Tests for UserProfileCard Block and Report Functionality
 *
 * Tests cover:
 * - Block button rendering and interaction
 * - Report button rendering and interaction
 * - More options menu visibility
 * - Callback invocation
 * - Accessibility
 * - Mobile responsiveness
 *
 * **Validates: Requirement 19 - Blocked Users & Reporting**
 */

describe('UserProfileCard - Block and Report Functionality', () => {
  let mockProfile: DiscoveryProfile;
  let onBlock: ReturnType<typeof vi.fn>;
  let onReport: ReturnType<typeof vi.fn>;
  let onLike: ReturnType<typeof vi.fn>;
  let onPass: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockProfile = {
      id: 'user-123',
      gender: 'woman',
      archetype: 'spoilt_woman',
      firstName: 'Sarah',
      age: 26,
      city: 'Brooklyn, NY',
      avatar: null,
      about: 'Looking for someone genuine',
      looking: 'Long-term relationship',
      trustScore: 88,
      createdAt: new Date(),
      updatedAt: new Date(),
      distance: '2 mi',
      verified: ['id', 'liveness', 'photos']
    };

    onBlock = vi.fn();
    onReport = vi.fn();
    onLike = vi.fn();
    onPass = vi.fn();
  });

  describe('More options menu rendering', () => {
    it('should render more options button', () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      expect(moreButton).toBeInTheDocument();
    });

    it('should not show menu initially', () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const blockButton = screen.queryByLabelText('Block this user');
      expect(blockButton).not.toBeInTheDocument();
    });

    it('should show menu when more options button is clicked', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      expect(blockButton).toBeInTheDocument();
    });

    it('should show both block and report options in menu', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      const reportButton = screen.getByLabelText('Report this user');

      expect(blockButton).toBeInTheDocument();
      expect(reportButton).toBeInTheDocument();
    });
  });

  describe('Block button functionality', () => {
    it('should call onBlock callback when block button is clicked', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      await fireEvent.click(blockButton);

      expect(onBlock).toHaveBeenCalledTimes(1);
    });

    it('should close menu after blocking', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      await fireEvent.click(blockButton);

      // Menu should be closed
      const reportButton = screen.queryByLabelText('Report this user');
      expect(reportButton).not.toBeInTheDocument();
    });

    it('should disable block button when loading', async () => {
      const { component } = render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock: () => {
            // Simulate loading
          },
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user') as HTMLButtonElement;
      expect(blockButton.disabled).toBe(false);

      await fireEvent.click(blockButton);
      // Button should be disabled during loading
      expect(blockButton.disabled).toBe(true);
    });

    it('should have proper accessibility attributes', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      expect(blockButton).toHaveAttribute('aria-label', 'Block this user');
    });
  });

  describe('Report button functionality', () => {
    it('should call onReport callback when report button is clicked', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const reportButton = screen.getByLabelText('Report this user');
      await fireEvent.click(reportButton);

      expect(onReport).toHaveBeenCalledTimes(1);
    });

    it('should close menu after reporting', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const reportButton = screen.getByLabelText('Report this user');
      await fireEvent.click(reportButton);

      // Menu should be closed
      const blockButton = screen.queryByLabelText('Block this user');
      expect(blockButton).not.toBeInTheDocument();
    });

    it('should disable report button when loading', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport: () => {
            // Simulate loading
          },
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const reportButton = screen.getByLabelText('Report this user') as HTMLButtonElement;
      expect(reportButton.disabled).toBe(false);

      await fireEvent.click(reportButton);
      // Button should be disabled during loading
      expect(reportButton.disabled).toBe(true);
    });

    it('should have proper accessibility attributes', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const reportButton = screen.getByLabelText('Report this user');
      expect(reportButton).toHaveAttribute('aria-label', 'Report this user');
    });
  });

  describe('Menu toggle behavior', () => {
    it('should toggle menu visibility on button click', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');

      // Menu should be hidden initially
      let blockButton = screen.queryByLabelText('Block this user');
      expect(blockButton).not.toBeInTheDocument();

      // Click to show menu
      await fireEvent.click(moreButton);
      blockButton = screen.getByLabelText('Block this user');
      expect(blockButton).toBeInTheDocument();

      // Click to hide menu
      await fireEvent.click(moreButton);
      blockButton = screen.queryByLabelText('Block this user');
      expect(blockButton).not.toBeInTheDocument();
    });

    it('should have aria-expanded attribute', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');

      await fireEvent.click(moreButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(moreButton);
      expect(moreButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Integration with other buttons', () => {
    it('should not affect like button functionality', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const likeButton = screen.getByLabelText('Like this profile');
      await fireEvent.click(likeButton);

      expect(onLike).toHaveBeenCalledTimes(1);
      expect(onBlock).not.toHaveBeenCalled();
      expect(onReport).not.toHaveBeenCalled();
    });

    it('should not affect pass button functionality', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const passButton = screen.getByLabelText('Pass on this profile');
      await fireEvent.click(passButton);

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(onBlock).not.toHaveBeenCalled();
      expect(onReport).not.toHaveBeenCalled();
    });

    it('should render all buttons together', () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const likeButton = screen.getByLabelText('Like this profile');
      const passButton = screen.getByLabelText('Pass on this profile');
      const moreButton = screen.getByLabelText('More options');

      expect(likeButton).toBeInTheDocument();
      expect(passButton).toBeInTheDocument();
      expect(moreButton).toBeInTheDocument();
    });
  });

  describe('Optional callbacks', () => {
    it('should handle missing onBlock callback', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      // Should not throw error
      await fireEvent.click(blockButton);
      expect(blockButton).toBeInTheDocument();
    });

    it('should handle missing onReport callback', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const reportButton = screen.getByLabelText('Report this user');
      // Should not throw error
      await fireEvent.click(reportButton);
      expect(reportButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      expect(moreButton.tagName).toBe('BUTTON');

      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      const reportButton = screen.getByLabelText('Report this user');

      expect(blockButton.tagName).toBe('BUTTON');
      expect(reportButton.tagName).toBe('BUTTON');
    });

    it('should have descriptive labels', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      const reportButton = screen.getByLabelText('Report this user');

      expect(blockButton).toHaveAttribute('aria-label');
      expect(reportButton).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass
        }
      });

      const moreButton = screen.getByLabelText('More options');
      moreButton.focus();
      expect(document.activeElement).toBe(moreButton);

      await fireEvent.keyDown(moreButton, { key: 'Enter' });
      // Menu should be visible after Enter key
      const blockButton = screen.getByLabelText('Block this user');
      expect(blockButton).toBeInTheDocument();
    });
  });

  describe('Compact view', () => {
    it('should render block and report buttons in compact view', async () => {
      render(UserProfileCard, {
        props: {
          profile: mockProfile,
          onBlock,
          onReport,
          onLike,
          onPass,
          compact: true
        }
      });

      const moreButton = screen.getByLabelText('More options');
      expect(moreButton).toBeInTheDocument();

      await fireEvent.click(moreButton);

      const blockButton = screen.getByLabelText('Block this user');
      const reportButton = screen.getByLabelText('Report this user');

      expect(blockButton).toBeInTheDocument();
      expect(reportButton).toBeInTheDocument();
    });
  });
});
