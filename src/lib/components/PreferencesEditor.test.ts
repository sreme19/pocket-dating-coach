import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PreferencesEditor from './PreferencesEditor.svelte';
import type { PreferencesProfile, ProfileVersion } from '$lib/server/profile-service';

describe('PreferencesEditor', () => {
	const mockPreferences: PreferencesProfile = {
		emotionalSignals: ['Empathetic', 'Communicative'],
		lifestyleSignals: ['Active', 'Adventurous'],
		maturitySignals: ['Responsible', 'Self-aware'],
		boundaries: ['Respect my time', 'No excessive drinking'],
		dealbreakers: ['Dishonesty', 'Disrespect'],
		privateCompatibilityNotes: ['Values independence'],
		updatedAt: Date.now()
	};

	const mockVersionHistory: ProfileVersion[] = [
		{
			id: '1',
			version: 2,
			data: mockPreferences,
			reason: 'Updated based on recent conversations',
			createdAt: Date.now() - 86400000
		},
		{
			id: '2',
			version: 1,
			data: {
				...mockPreferences,
				emotionalSignals: ['Empathetic']
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
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			expect(screen.getByText('Edit Your Preferences')).toBeTruthy();
			expect(screen.getByText(/Update your dating preferences/)).toBeTruthy();
		});

		it('should display all preference fields', () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			expect(screen.getByText('Emotional Signals')).toBeTruthy();
			expect(screen.getByText('Lifestyle Signals')).toBeTruthy();
			expect(screen.getByText('Maturity Signals')).toBeTruthy();
			expect(screen.getByText('Boundaries')).toBeTruthy();
			expect(screen.getByText('Dealbreakers')).toBeTruthy();
			expect(screen.getByText('Private Compatibility Notes')).toBeTruthy();
		});

		it('should display last updated timestamp', () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const lastUpdatedText = screen.getByText(/Last updated:/);
			expect(lastUpdatedText).toBeTruthy();
		});

		it('should populate fields with existing preferences', () => {
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]');
			const inputValues = Array.from(inputs).map((input: any) => input.value);

			expect(inputValues).toContain('Empathetic');
			expect(inputValues).toContain('Communicative');
			expect(inputValues).toContain('Active');
		});
	});

	describe('Adding and Removing Items', () => {
		it('should add a new empty item when add button is clicked', async () => {
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
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
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const removeButtons = container.querySelectorAll('button[title="Remove item"]');
			const initialCount = removeButtons.length;

			await fireEvent.click(removeButtons[0]);

			const updatedRemoveButtons = container.querySelectorAll('button[title="Remove item"]');
			expect(updatedRemoveButtons.length).toBe(initialCount - 1);
		});

		it('should update item value when input changes', async () => {
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];

			await fireEvent.change(firstInput, { target: { value: 'Updated Value' } });

			expect(firstInput.value).toBe('Updated Value');
		});
	});

	describe('Saving Changes', () => {
		it('should disable save button when no changes are made', () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const saveButton = screen.getByText('Save Changes').closest('button');
			expect(saveButton?.disabled).toBe(true);
		});

		it('should enable save button when changes are made', async () => {
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];

			await fireEvent.change(firstInput, { target: { value: 'New Value' } });

			const saveButton = screen.getByText('Save Changes').closest('button');
			expect(saveButton?.disabled).toBe(false);
		});

		it('should show error when trying to save without reason', async () => {
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
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
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Signal' } });

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
				expect(updates.emotionalSignals).toContain('Updated Signal');
			});
		});

		it('should show success message after saving', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Signal' } });

			// Add reason
			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Updated based on feedback' } });

			// Save
			const saveButton = screen.getByText('Save Changes').closest('button');
			await fireEvent.click(saveButton!);

			await waitFor(() => {
				expect(screen.getByText(/Preferences saved successfully/)).toBeTruthy();
			});
		});

		it('should show error message on save failure', async () => {
			const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
					onSave
				}
			});

			// Make a change
			const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
			const firstInput = inputs[0];
			await fireEvent.change(firstInput, { target: { value: 'Updated Signal' } });

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
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
					showVersionHistory: true,
					versionHistory: mockVersionHistory
				}
			});

			expect(screen.getByText(/Version History/)).toBeTruthy();
		});

		it('should toggle version history panel when button is clicked', async () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
				expect(screen.getByText(/Preferences saved successfully/)).toBeTruthy();
			});
		});
	});

	describe('Empty Strings Filtering', () => {
		it('should filter out empty strings when saving', async () => {
			const onSave = vi.fn().mockResolvedValue(undefined);
			const { container } = render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
				// Should not contain empty strings
				expect(updates.emotionalSignals.every((s: string) => s.trim())).toBe(true);
			});
		});
	});

	describe('Character Counter', () => {
		it('should display character count for reason field', async () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			const reasonTextarea = screen.getByPlaceholderText(/Why are you updating/);
			await fireEvent.change(reasonTextarea, { target: { value: 'Test reason' } });

			expect(screen.getByText('11/500 characters')).toBeTruthy();
		});
	});

	describe('Loading State', () => {
		it('should disable buttons when isLoading is true', () => {
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences,
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
			render(PreferencesEditor, {
				props: {
					preferences: mockPreferences
				}
			});

			expect(screen.getByText(/Be specific and honest/)).toBeTruthy();
			expect(screen.getByText(/Update regularly/)).toBeTruthy();
			expect(screen.getByText(/Your preferences help AI Bestie/)).toBeTruthy();
			expect(screen.getByText(/All changes are tracked/)).toBeTruthy();
		});
	});
});
