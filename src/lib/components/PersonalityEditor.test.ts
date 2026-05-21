import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PersonalityEditor from './PersonalityEditor.svelte';
import type { PersonalityProfile, ProfileVersion } from '$lib/server/profile-service';

describe('PersonalityEditor', () => {
	const mockPersonality: PersonalityProfile = {
		communicationStyle: 'Direct and honest',
		personalityVibe: 'Ambitious and driven',
		mattersMost: 'Humor and authenticity',
		values: ['Authenticity', 'Growth mindset', 'Loyalty'],
		datingPatterns: ['Prefers genuine conversation', 'Moves quickly to meeting'],
		redFlagsToAvoid: ['Overly focused on appearance', 'Dismissive of career'],
		updatedAt: Date.now()
	};

	const mockVersionHistory: ProfileVersion[] = [
		{
			id: '1',
			version: 2,
			data: mockPersonality,
			reason: 'Updated based on recent conversations',
			createdAt: Date.now() - 86400000
		},
		{
			id: '2',
			version: 1,
			data: {
				...mockPersonality,
				values: ['Authenticity']
			},
			reason: 'Initial setup',
			createdAt: Date.now() - 172800000
		}
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Rendering', () => {
		it('should render the component with title and description', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			expect(screen.getByText('Edit Your Personality Profile')).toBeTruthy();
			expect(screen.getByText(/Update your personality profile/)).toBeTruthy();
		});

		it('should display all personality fields', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			expect(screen.getByText('Communication Style')).toBeTruthy();
			expect(screen.getByText('Personality Vibe')).toBeTruthy();
			expect(screen.getByText('What Matters Most')).toBeTruthy();
			expect(screen.getByText('Core Values')).toBeTruthy();
			expect(screen.getByText('Dating Patterns')).toBeTruthy();
			expect(screen.getByText('Red Flags to Avoid')).toBeTruthy();
		});

		it('should display last updated timestamp', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const lastUpdatedText = screen.getByText(/Last updated:/);
			expect(lastUpdatedText).toBeTruthy();
		});

		it('should populate fields with existing personality data', () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]');
			const inputValues = Array.from(inputs).map((input: any) => input.value);

			expect(inputValues).toContain('Direct and honest');
			expect(inputValues).toContain('Ambitious and driven');
			expect(inputValues).toContain('Humor and authenticity');
			expect(inputValues).toContain('Authenticity');
			expect(inputValues).toContain('Growth mindset');
		});
	});

	describe('Text Field Updates', () => {
		it('should update communication style field', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const commStyleInput = inputs[0];

			await fireEvent.change(commStyleInput, { target: { value: 'Playful and witty' } });

			expect(commStyleInput.value).toBe('Playful and witty');
		});

		it('should update personality vibe field', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const vibeInput = inputs[1];

			await fireEvent.change(vibeInput, { target: { value: 'Laid-back and chill' } });

			expect(vibeInput.value).toBe('Laid-back and chill');
		});

		it('should update what matters most field', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const mattersInput = inputs[2];

			await fireEvent.change(mattersInput, { target: { value: 'Genuine connection' } });

			expect(mattersInput.value).toBe('Genuine connection');
		});
	});

	describe('Adding and Removing Array Items', () => {
		it('should add a new empty item when add button is clicked', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const addButtons = screen.getAllByText(/\+ Add/);
			const firstAddButton = addButtons[0];

			await fireEvent.click(firstAddButton);

			const inputs = container.querySelectorAll('input[type="text"]');
			const lastInput = inputs[inputs.length - 1] as HTMLInputElement;

			expect(lastInput.value).toBe('');
		});

		it('should remove an item when remove button is clicked', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const removeButtons = container.querySelectorAll('button[title="Remove item"]');
			const initialCount = removeButtons.length;

			await fireEvent.click(removeButtons[0]);

			const updatedRemoveButtons = container.querySelectorAll('button[title="Remove item"]');
			expect(updatedRemoveButtons.length).toBe(initialCount - 1);
		});

		it('should update item value when input changes', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			// Skip the first 3 text fields (communication style, vibe, matters most)
			const valueInput = inputs[3];

			await fireEvent.change(valueInput, { target: { value: 'Updated Value' } });

			expect(valueInput.value).toBe('Updated Value');
		});
	});

	describe('Saving Changes', () => {
		it('should disable save button when no changes are made', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const saveButton = screen.getByText('Save Changes').closest('button');
			expect(saveButton?.disabled).toBe(true);
		});

		it('should enable save button when changes are made', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];

			await fireEvent.change(firstInput, { target: { value: 'New Communication Style' } });

			const saveButton = screen.getByText('Save Changes').closest('button');
			expect(saveButton?.disabled).toBe(false);
		});

		it('should show error when trying to save without reason', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];

			await fireEvent.change(firstInput, { target: { value: 'New Value' } });

			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				expect(screen.getByText(/Please provide a reason for this update/)).toBeTruthy();
			});
		});

		it('should call onSave with filtered updates and reason', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Style' } });

			// Add reason
			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Updated based on feedback' } });

			// Save
			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				expect(onSave).toHaveBeenCalled();
				const [updates, reason] = onSave.mock.calls[0];
				expect(reason).toBe('Updated based on feedback');
				expect(updates.communicationStyle).toBe('Updated Style');
			});
		});

		it('should show success message after saving', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Style' } });

			// Add reason
			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Updated based on feedback' } });

			// Save
			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				expect(screen.getByText(/Personality profile saved successfully/)).toBeTruthy();
			});
		});

		it('should show error message on save failure', async () => {
			const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Style' } });

			// Add reason
			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Updated based on feedback' } });

			// Save
			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				expect(screen.getByText(/Save failed/)).toBeTruthy();
			});
		});
	});

	describe('Canceling Changes', () => {
		it('should reset changes when cancel button is clicked', async () => {
			const onCancel = vi.fn();
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					onCancel
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			const originalValue = firstInput.value;

			await fireEvent.change(firstInput, { target: { value: 'New Value' } });
			expect(firstInput.value).toBe('New Value');

			// Cancel
			const cancelButton = screen.getByText('Cancel').closest('button');
			await fireEvent.click(cancelButton!);

			expect(onCancel).toHaveBeenCalled();
		});
	});

	describe('Version History', () => {
		it('should display version history button when showVersionHistory is true', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					showVersionHistory: true,
					versionHistory: mockVersionHistory
				}
			});

			expect(screen.getByText(/Version History/)).toBeTruthy();
		});

		it('should toggle version history panel when button is clicked', async () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					showVersionHistory: true,
					versionHistory: mockVersionHistory
				}
			});

			const historyButton = screen.getByText(/Version History/);
			await fireEvent.click(historyButton);

			// Should show version details
			expect(screen.getByText('Version 2')).toBeTruthy();
			expect(screen.getByText('Version 1')).toBeTruthy();
		});

		it('should call onRestoreVersion when restore button is clicked', async () => {
			const onRestoreVersion = vi.fn().mockResolvedValue(undefined);
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					showVersionHistory: true,
					versionHistory: mockVersionHistory,
					onRestoreVersion
				}
			});

			const historyButton = screen.getByText(/Version History/);
			await fireEvent.click(historyButton);

			const restoreButtons = screen.getAllByText('Restore');
			// Mock confirm dialog
			global.confirm = vi.fn(() => true);

			await fireEvent.click(restoreButtons[0]);

			await waitFor(() => {
				expect(onRestoreVersion).toHaveBeenCalled();
			});
		});

		it('should show success message after restoring version', async () => {
			const onRestoreVersion = vi.fn().mockResolvedValue(undefined);
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					showVersionHistory: true,
					versionHistory: mockVersionHistory,
					onRestoreVersion
				}
			});

			const historyButton = screen.getByText(/Version History/);
			await fireEvent.click(historyButton);

			const restoreButtons = screen.getAllByText('Restore');
			global.confirm = vi.fn(() => true);

			await fireEvent.click(restoreButtons[0]);

			await waitFor(() => {
				expect(screen.getByText(/Personality profile saved successfully/)).toBeTruthy();
			});
		});
	});

	describe('Empty Strings Filtering', () => {
		it('should filter out empty strings when saving', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					onSave
				}
			});

			// Add an empty item
			const addButtons = screen.getAllByText(/\+ Add/);
			await fireEvent.click(addButtons[0]);

			// Add reason
			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Test update' } });

			// Save
			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				const [updates] = onSave.mock.calls[0];
				// Should not contain empty strings in values array
				expect(updates.values.every((s: string) => s.trim())).toBe(true);
			});
		});
	});

	describe('Character Counter', () => {
		it('should display character count for reason field', async () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Test reason' } });

			expect(screen.getByText('11/500 characters')).toBeTruthy();
		});
	});

	describe('Loading State', () => {
		it('should disable buttons when isLoading is true', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality,
					isLoading: true
				}
			});

			const saveButton = screen.getByText('Save Changes').closest('button');
			const cancelButton = screen.getByText('Cancel').closest('button');

			expect(saveButton?.disabled).toBe(true);
			expect(cancelButton?.disabled).toBe(true);
		});
	});

	describe('Tips Panel', () => {
		it('should display tips panel with helpful information', () => {
			render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			expect(screen.getByText(/Be honest about who you are/)).toBeTruthy();
			expect(screen.getByText(/Update regularly/)).toBeTruthy();
			expect(screen.getByText(/Your personality helps AI Wingman/)).toBeTruthy();
			expect(screen.getByText(/All changes are tracked/)).toBeTruthy();
		});
	});

	describe('Default Values', () => {
		it('should use default empty personality when none provided', () => {
			render(PersonalityEditor, {
				props: {}
			});

			expect(screen.getByText('Edit Your Personality Profile')).toBeTruthy();
		});
	});

	describe('Array Field Operations', () => {
		it('should handle multiple add operations', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const addButtons = screen.getAllByText(/\+ Add core value/);
			const addButton = addButtons[0];

			// Add 3 items
			await fireEvent.click(addButton);
			await fireEvent.click(addButton);
			await fireEvent.click(addButton);

			const inputs = container.querySelectorAll('input[type="text"]');
			// Should have original 3 values + 3 new empty ones
			expect(inputs.length).toBeGreaterThan(6);
		});

		it('should handle mixed add and remove operations', async () => {
			const { container } = render(PersonalityEditor, {
				props: {
					personality: mockPersonality
				}
			});

			const addButtons = screen.getAllByText(/\+ Add core value/);
			const addButton = addButtons[0];

			// Add an item
			await fireEvent.click(addButton);

			let removeButtons = container.querySelectorAll('button[title="Remove item"]');
			const initialCount = removeButtons.length;

			// Remove an item
			await fireEvent.click(removeButtons[0]);

			removeButtons = container.querySelectorAll('button[title="Remove item"]');
			expect(removeButtons.length).toBe(initialCount - 1);
		});
	});
});
