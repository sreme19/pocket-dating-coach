import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ProfileCardDisplay from './ProfileCardDisplay.svelte';
import type { VerifiedVibeUser } from '../types';

describe('ProfileCardDisplay Component', () => {
  const mockProfile: VerifiedVibeUser = {
    id: '123',
    gender: 'man',
    archetype: 'casual_man',
    firstName: 'Alex',
    age: 28,
    city: 'Brooklyn, NY',
    avatar: 'https://example.com/avatar.jpg',
    about: 'Looking for genuine connections',
    looking: 'Someone who knows what they want',
    trustScore: 81,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('renders profile card', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const card = container.querySelector('.profile-card');
    expect(card).toBeTruthy();
  });

  it('displays user name and age', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const name = container.querySelector('.name');
    expect(name?.textContent).toContain('Alex, 28');
  });

  it('displays archetype name', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const archetype = container.querySelector('.archetype-name');
    expect(archetype?.textContent).toContain('casual man');
  });

  it('displays city location', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const location = container.querySelector('.location');
    expect(location?.textContent).toContain('Brooklyn, NY');
  });

  it('displays about section', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const about = container.querySelector('.section-text');
    expect(about?.textContent).toContain('Looking for genuine connections');
  });

  it('displays looking for section', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const sections = container.querySelectorAll('.section-text');
    expect(sections[1]?.textContent).toContain('Someone who knows what they want');
  });

  it('displays verified badges', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile,
        verified: ['id', 'photos', 'spending']
      }
    });

    const badges = container.querySelectorAll('.badge');
    expect(badges.length).toBe(3);
  });

  it('displays correct badge labels', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile,
        verified: ['id', 'photos']
      }
    });

    const badges = container.querySelectorAll('.badge');
    expect(badges[0]?.textContent).toContain('ID Verified');
    expect(badges[1]?.textContent).toContain('Photos');
  });

  it('calls onEdit callback when edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile,
        onEdit
      }
    });

    const editButton = container.querySelector('.edit-button');
    await user.click(editButton!);

    expect(onEdit).toHaveBeenCalled();
  });

  it('displays archetype emoji', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const emoji = container.querySelector('.archetype-emoji');
    expect(emoji?.textContent).toBe('🎯');
  });

  it('displays avatar image when provided', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const img = container.querySelector('.avatar-image');
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toContain('avatar.jpg');
  });

  it('displays placeholder emoji when no avatar', () => {
    const profileNoAvatar = { ...mockProfile, avatar: null };

    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: profileNoAvatar
      }
    });

    const placeholder = container.querySelector('.avatar-placeholder');
    expect(placeholder?.textContent).toBe('🎯');
  });

  it('handles missing about section', () => {
    const profileNoAbout = { ...mockProfile, about: null };

    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: profileNoAbout
      }
    });

    const sections = container.querySelectorAll('.section');
    // Should only have "Looking For" section
    expect(sections.length).toBe(1);
  });

  it('handles missing looking section', () => {
    const profileNoLooking = { ...mockProfile, looking: null };

    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: profileNoLooking
      }
    });

    const sections = container.querySelectorAll('.section');
    // Should only have "About" section
    expect(sections.length).toBe(1);
  });

  it('handles no verified badges', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile,
        verified: []
      }
    });

    const verifiedSection = container.querySelector('.verified-section');
    expect(verifiedSection).toBeFalsy();
  });

  it('has accessibility attributes', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile
      }
    });

    const editButton = container.querySelector('.edit-button');
    expect(editButton?.getAttribute('aria-label')).toBe('Edit profile');
  });

  it('handles different archetypes', () => {
    const profileWoman = { ...mockProfile, archetype: 'spoilt_woman' as const };

    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: profileWoman
      }
    });

    const emoji = container.querySelector('.archetype-emoji');
    expect(emoji?.textContent).toBe('👑');
  });

  it('displays all verified badge types', () => {
    const { container } = render(ProfileCardDisplay, {
      props: {
        profile: mockProfile,
        verified: ['id', 'liveness', 'photos', 'spending_or_qa']
      }
    });

    const badges = container.querySelectorAll('.badge');
    expect(badges.length).toBe(4);
  });
});
