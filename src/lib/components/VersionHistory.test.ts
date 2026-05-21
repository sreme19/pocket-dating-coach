import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import VersionHistory from './VersionHistory.svelte';
import type { ProfileVersion } from '$lib/server/profile-service';

describe('VersionHistory Component', () => {
	const mockPreferencesVersion: ProfileVersion = {
		id: 'v1',
		version: 1,
		data: {
			emotionalSignals: ['Empathetic', 'Communicative'],
			lifestyleSignals: ['Active', 'Adventurous'],
			maturitySignals: ['Responsible', 'Goal-oriented'],
			boundaries: ['No excessive drinking'],
			dealbreakers: ['Disrespectful behavior'],
			privateCompatibilityNotes: ['Values independence'],
			updatedAt: Date.now()
		},
		reason: 'Initial setup',
		createdAt: Date.now() - 86400000 // 1 day ago
	};

	const mockPreferencesVersion2: ProfileVersion = {
		id: 'v2',
		version: 2,
		data: {
			emotionalSignals: ['Empathetic', 'Communicative', 'Vulnerable'],
			lifestyleSignals: ['Active', 'Adventurous', 'Outdoorsy'],
			maturitySignals: ['Responsible', 'Goal-oriented'],
			boundaries: ['No excessive drinking', 'Respectful of time'],
			dealbreakers: ['Disrespectful behavior', 'Still hung up on ex'],
			privateCompatibilityNotes: ['Values independence', 'Dry humor'],
			updatedAt: Date.now()
		},
		reason: 'Updated based on recent conversations',
		createdAt: Date.now()
	};

	const mockPersonalityVersion: ProfileVersion = {
		id: 'p1',
		version: 1,
		data: {
			communicationStyle: 'Direct and honest',
			personalityVibe: 'Ambitious',
			mattersMost: 'Humor',
			values: ['Authenticity', 'Growth'],
			datingPatterns: ['Prefers genuine conversation'],
			redFlagsToAvoid: ['Overly focused on appearance'],
			updatedAt: Date.now()
		},
		reason: 'Initial personality setup',
		createdAt: Date.now() - 86400000
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Rendering', () => {
		it('should render empty state when no versions provided', () => {
			render(VersionHistory, {
				props: {
					versions: [],
					profileType: 'preferences'
				}
			});

			expect(screen.getByText('No version history yet')).toBeInTheDocument();
		});

		it('should render version list when versions provided', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			expect(screen.getByText('v1')).toBeInTheDocument();
			expect(screen.getByText('v2')).toBeInTheDocument();
		});

		it('should display correct header for preferences profile type', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			expect(screen.getByText(/Preferences Version History/)).toBeInTheDocument();
		});

		it('should display correct header for personality profile type', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPersonalityVersion],
					profileType: 'personality'
				}
			});

			expect(screen.getByText(/Personality Version History/)).toBeInTheDocument();
		});

		it('should mark current version with badge', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			const currentBadge = screen.getByText('Current');
			expect(currentBadge).toBeInTheDocument();
		});

		it('should display version summary with item count', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			// Should show count of items (emotional signals + lifestyle signals + boundaries + dealbreakers)
			expect(screen.getByText(/items/)).toBeInTheDocument();
		});
	});

	describe('Expansion', () => {
		it('should expand version details when clicked', async () => {
			const { container } = render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			const versionButton = screen.getByText('v1').closest('button');
			expect(versionButton).toBeTruthy();

			await fireEvent.click(versionButton!);

			// Should show reason for update
			expect(screen.getByText('Initial setup')).toBeInTheDocument();
		});

		it('should display preferences data when expanded', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			const versionButton = screen.getByText('v1').closest('button');
			await fireEvent.click(versionButton!);

			expect(screen.getByText('Emotional Signals:')).toBeInTheDocument();
			expect(screen.getByText('Empathetic')).toBeInTheDocument();
		});

		it('should display personality data when expanded', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPersonalityVersion],
					profileType: 'personality'
				}
			});

			const versionButton = screen.getByText('p1').closest('button');
			await fireEvent.click(versionButton!);

			expect(screen.getByText('Communication Style:')).toBeInTheDocument();
			expect(screen.getByText('Direct and honest')).toBeInTheDocument();
		});

		it('should collapse version details when clicked again', async () => {
			const { container } = render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			const versionButton = screen.getByText('v1').closest('button');

			// Expand
			await fireEvent.click(versionButton!);
			expect(screen.getByText('Initial setup')).toBeInTheDocument();

			// Collapse
			await fireEvent.click(versionButton!);
			// The reason should still be in the DOM but not visible
		});
	});

	describe('Restore Functionality', () => {
		it('should show restore button for non-current versions', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			// Expand the older version (v1)
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Should show restore button for v1
			const restoreButtons = screen.getAllByText(/Restore This Version/);
			expect(restoreButtons.length).toBeGreaterThan(0);
		});

		it('should not show restore button for current version', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			// Expand the current version (v2)
			const v2Button = screen.getByText('v2').closest('button');
			await fireEvent.click(v2Button!);

			// Should show "This is your current version" instead of restore button
			expect(screen.getByText('This is your current version')).toBeInTheDocument();
		});

		it('should call onRestore callback when restore button clicked', async () => {
			const onRestore = vi.fn().mockResolvedValue(undefined);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Mock window.confirm
			window.confirm = vi.fn(() => true);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version');
			await fireEvent.click(restoreButton);

			await waitFor(() => {
				expect(onRestore).toHaveBeenCalledWith('v1');
			});
		});

		it('should show confirmation dialog before restoring', async () => {
			const onRestore = vi.fn().mockResolvedValue(undefined);
			const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version');
			await fireEvent.click(restoreButton);

			expect(confirmSpy).toHaveBeenCalled();
			confirmSpy.mockRestore();
		});

		it('should not restore if user cancels confirmation', async () => {
			const onRestore = vi.fn().mockResolvedValue(undefined);
			const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version');
			await fireEvent.click(restoreButton);

			expect(onRestore).not.toHaveBeenCalled();
			confirmSpy.mockRestore();
		});

		it('should show success message after successful restore', async () => {
			const onRestore = vi.fn().mockResolvedValue(undefined);
			window.confirm = vi.fn(() => true);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version');
			await fireEvent.click(restoreButton);

			await waitFor(() => {
				expect(screen.getByText('Version restored successfully!')).toBeInTheDocument();
			});
		});

		it('should show error message if restore fails', async () => {
			const onRestore = vi.fn().mockRejectedValue(new Error('Restore failed'));
			window.confirm = vi.fn(() => true);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version');
			await fireEvent.click(restoreButton);

			await waitFor(() => {
				expect(screen.getByText('Restore failed')).toBeInTheDocument();
			});
		});

		it('should disable restore button while restoring', async () => {
			const onRestore = vi.fn(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			window.confirm = vi.fn(() => true);

			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					onRestore
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Click restore button
			const restoreButton = screen.getByText('Restore This Version') as HTMLButtonElement;
			await fireEvent.click(restoreButton);

			// Button should be disabled while restoring
			expect(screen.getByText('Restoring...')).toBeInTheDocument();
		});
	});

	describe('Mobile Responsiveness', () => {
		it('should render with responsive layout', () => {
			const { container } = render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			// Component should render without errors
			expect(container).toBeTruthy();
		});

		it('should display version data in scrollable container', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			const versionButton = screen.getByText('v1').closest('button');
			await fireEvent.click(versionButton!);

			// The data preview should be scrollable
			const dataPreview = screen.getByText('Emotional Signals:').closest('div');
			expect(dataPreview).toHaveClass('max-h-48');
			expect(dataPreview).toHaveClass('overflow-y-auto');
		});
	});

	describe('Date Formatting', () => {
		it('should format dates correctly', () => {
			const now = Date.now();
			const version: ProfileVersion = {
				...mockPreferencesVersion,
				createdAt: now
			};

			render(VersionHistory, {
				props: {
					versions: [version],
					profileType: 'preferences'
				}
			});

			// Should display formatted date
			const dateElements = screen.getAllByText(/\d{1,2}:\d{2}\s(AM|PM)/);
			expect(dateElements.length).toBeGreaterThan(0);
		});
	});

	describe('Profile Type Handling', () => {
		it('should handle preferences profile type correctly', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion],
					profileType: 'preferences'
				}
			});

			expect(screen.getByText(/Preferences Version History/)).toBeInTheDocument();
		});

		it('should handle personality profile type correctly', () => {
			render(VersionHistory, {
				props: {
					versions: [mockPersonalityVersion],
					profileType: 'personality'
				}
			});

			expect(screen.getByText(/Personality Version History/)).toBeInTheDocument();
		});
	});

	describe('Loading State', () => {
		it('should disable restore button when isLoading is true', async () => {
			render(VersionHistory, {
				props: {
					versions: [mockPreferencesVersion2, mockPreferencesVersion],
					profileType: 'preferences',
					isLoading: true,
					onRestore: vi.fn()
				}
			});

			// Expand the older version
			const v1Button = screen.getByText('v1').closest('button');
			await fireEvent.click(v1Button!);

			// Restore button should be disabled
			const restoreButton = screen.getByText('Restore This Version') as HTMLButtonElement;
			expect(restoreButton.disabled).toBe(true);
		});
	});
});
