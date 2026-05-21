import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ResponseOptions from './ResponseOptions.svelte';
import type { ResponseOption } from '$lib/server/ai-assistant-service';

describe('ResponseOptions Component', () => {
	const mockOptions: ResponseOption[] = [
		{
			id: 'option-1',
			tone: 'playful',
			message: 'That sounds amazing! I love hiking too.',
			why: 'Matches his energy and shows genuine interest',
			citation: 'Based on: Compatibility Signals'
		},
		{
			id: 'option-2',
			tone: 'warm',
			message: 'I would love to hear more about your hiking adventures.',
			why: 'Shows curiosity and invites deeper conversation',
			citation: 'Based on: Building Genuine Connection'
		},
		{
			id: 'option-3',
			tone: 'direct',
			message: 'Hiking is great. Are you looking for someone to join you?',
			why: 'Clarifies intentions and moves toward compatibility',
			citation: 'Based on: Authentic Communication'
		}
	];

	describe('Rendering', () => {
		it('should render response options as cards', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			mockOptions.forEach((option) => {
				expect(screen.getAllByText(option.message).length).toBeGreaterThan(0);
				expect(screen.getAllByText(option.why).length).toBeGreaterThan(0);
			});
		});

		it('should display tone badges with correct labels', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			expect(screen.getAllByText('Playful').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Warm').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Direct').length).toBeGreaterThan(0);
		});

		it('should display citations when provided', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			mockOptions.forEach((option) => {
				if (option.citation) {
					expect(screen.getAllByText(option.citation).length).toBeGreaterThan(0);
				}
			});
		});

		it('should render copy and edit buttons for each option', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			const editButtons = screen.getAllByTitle('Edit message before sending');

			// Each option appears twice (mobile + desktop), so we expect 2x the options
			expect(copyButtons.length).toBe(mockOptions.length * 2);
			expect(editButtons.length).toBe(mockOptions.length * 2);
		});

		it('should handle empty options array', () => {
			render(ResponseOptions, {
				props: {
					options: []
				}
			});

			expect(screen.getByText('No response options available')).toBeInTheDocument();
		});

		it('should show loading state when isLoading is true', () => {
			render(ResponseOptions, {
				props: {
					options: [],
					isLoading: true
				}
			});

			expect(screen.getByText('Generating response options...')).toBeInTheDocument();
		});

		it('should handle options without citations', () => {
			const optionsWithoutCitations: ResponseOption[] = [
				{
					id: 'option-1',
					tone: 'playful',
					message: 'Test message',
					why: 'Test reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: optionsWithoutCitations
				}
			});

			expect(screen.getAllByText('Test message').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Test reason').length).toBeGreaterThan(0);
		});
	});

	describe('Copy to Clipboard', () => {
		beforeEach(() => {
			// Mock clipboard API
			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn(() => Promise.resolve())
				}
			});
		});

		it('should copy message to clipboard when copy button is clicked', async () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			await fireEvent.click(copyButtons[0]);

			await waitFor(() => {
				expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockOptions[0].message);
			});
		});

		it('should show "Copied" feedback after copying', async () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			await fireEvent.click(copyButtons[0]);

			await waitFor(() => {
				expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
			});
		});

		it('should revert to "Copy" button after 2 seconds', async () => {
			vi.useFakeTimers();

			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			await fireEvent.click(copyButtons[0]);

			await waitFor(() => {
				expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
			});

			vi.advanceTimersByTime(2000);

			await waitFor(() => {
				const copyButtonTexts = screen.getAllByText('Copy');
				expect(copyButtonTexts.length).toBeGreaterThan(0);
			});

			vi.useRealTimers();
		});

		it('should handle clipboard copy errors gracefully', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn(() => Promise.reject(new Error('Copy failed')))
				}
			});

			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			await fireEvent.click(copyButtons[0]);

			await waitFor(() => {
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					'Failed to copy to clipboard:',
					expect.any(Error)
				);
			});

			consoleErrorSpy.mockRestore();
		});
	});

	describe('Selection', () => {
		it('should call onSelect callback when option is selected', async () => {
			const onSelect = vi.fn();

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect
				}
			});

			const firstCard = screen.getAllByText(mockOptions[0].message)[0].closest('div');
			if (firstCard) {
				await fireEvent.click(firstCard);
			}

			expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
		});

		it('should highlight selected option', async () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect: () => {}
				}
			});

			const firstCard = screen.getAllByText(mockOptions[0].message)[0].closest('div');
			if (firstCard) {
				await fireEvent.click(firstCard);

				await waitFor(() => {
					expect(firstCard).toHaveClass('border-gray-400');
				});
			}
		});

		it('should allow keyboard selection with Enter key', async () => {
			const onSelect = vi.fn();

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect
				}
			});

			const firstCard = screen.getAllByText(mockOptions[0].message)[0].closest('div');
			if (firstCard) {
				await fireEvent.keyDown(firstCard, { key: 'Enter' });

				expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
			}
		});

		it('should allow keyboard selection with Space key', async () => {
			const onSelect = vi.fn();

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect
				}
			});

			const firstCard = screen.getAllByText(mockOptions[0].message)[0].closest('div');
			if (firstCard) {
				await fireEvent.keyDown(firstCard, { key: ' ' });

				expect(onSelect).toHaveBeenCalledWith(mockOptions[0]);
			}
		});
	});

	describe('Edit Functionality', () => {
		it('should call onEdit callback when edit button is clicked', async () => {
			const onEdit = vi.fn();

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onEdit
				}
			});

			const editButtons = screen.getAllByTitle('Edit message before sending');
			await fireEvent.click(editButtons[0]);

			expect(onEdit).toHaveBeenCalledWith(mockOptions[0]);
		});

		it('should not trigger selection when edit button is clicked', async () => {
			const onSelect = vi.fn();
			const onEdit = vi.fn();

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect,
					onEdit
				}
			});

			const editButtons = screen.getAllByTitle('Edit message before sending');
			await fireEvent.click(editButtons[0]);

			expect(onEdit).toHaveBeenCalled();
			expect(onSelect).not.toHaveBeenCalled();
		});

		it('should not trigger selection when copy button is clicked', async () => {
			const onSelect = vi.fn();

			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn(() => Promise.resolve())
				}
			});

			render(ResponseOptions, {
				props: {
					options: mockOptions,
					onSelect
				}
			});

			const copyButtons = screen.getAllByTitle('Copy message to clipboard');
			await fireEvent.click(copyButtons[0]);

			expect(onSelect).not.toHaveBeenCalled();
		});
	});

	describe('Tone Color Differentiation', () => {
		it('should apply correct color classes for playful tone', () => {
			const playfulOption: ResponseOption[] = [
				{
					id: 'playful',
					tone: 'playful',
					message: 'Playful message',
					why: 'Playful reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: playfulOption
				}
			});

			const badges = screen.getAllByText('Playful');
			expect(badges[0]).toHaveClass('bg-amber-500/20');
			expect(badges[0]).toHaveClass('text-amber-300');
		});

		it('should apply correct color classes for warm tone', () => {
			const warmOption: ResponseOption[] = [
				{
					id: 'warm',
					tone: 'warm',
					message: 'Warm message',
					why: 'Warm reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: warmOption
				}
			});

			const badges = screen.getAllByText('Warm');
			expect(badges[0]).toHaveClass('bg-rose-500/20');
			expect(badges[0]).toHaveClass('text-rose-300');
		});

		it('should apply correct color classes for direct tone', () => {
			const directOption: ResponseOption[] = [
				{
					id: 'direct',
					tone: 'direct',
					message: 'Direct message',
					why: 'Direct reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: directOption
				}
			});

			const badges = screen.getAllByText('Direct');
			expect(badges[0]).toHaveClass('bg-blue-500/20');
			expect(badges[0]).toHaveClass('text-blue-300');
		});
	});

	describe('Loading State', () => {
		it('should show spinner when loading', () => {
			render(ResponseOptions, {
				props: {
					options: [],
					isLoading: true
				}
			});

			expect(screen.getByText('Generating response options...')).toBeInTheDocument();
		});

		it('should hide options when loading', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions,
					isLoading: true
				}
			});

			expect(screen.queryAllByText(mockOptions[0].message).length).toBe(0);
		});
	});

	describe('Responsive Layout', () => {
		it('should render mobile layout on small screens', () => {
			// Note: This test would require mocking window.matchMedia
			// For now, we verify the component renders without errors
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			expect(screen.getAllByText(mockOptions[0].message).length).toBeGreaterThan(0);
		});

		it('should render desktop layout on large screens', () => {
			// Note: This test would require mocking window.matchMedia
			// For now, we verify the component renders without errors
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			expect(screen.getAllByText(mockOptions[0].message).length).toBeGreaterThan(0);
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long messages', () => {
			const longMessage =
				'This is a very long message that should be truncated with line-clamp to prevent the card from becoming too tall and breaking the layout. It contains multiple sentences and goes on and on.';

			const optionWithLongMessage: ResponseOption[] = [
				{
					id: 'long',
					tone: 'playful',
					message: longMessage,
					why: 'Test reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: optionWithLongMessage
				}
			});

			expect(screen.getAllByText(longMessage).length).toBeGreaterThan(0);
		});

		it('should handle options with special characters', () => {
			const specialCharOption: ResponseOption[] = [
				{
					id: 'special',
					tone: 'playful',
					message: 'That\'s awesome! "Really?" I said. <3',
					why: 'Test reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: specialCharOption
				}
			});

			expect(screen.getAllByText(/That's awesome!/).length).toBeGreaterThan(0);
		});

		it('should handle options with emoji', () => {
			const emojiOption: ResponseOption[] = [
				{
					id: 'emoji',
					tone: 'playful',
					message: 'That sounds fun! 🎉 Let\'s do it! 😊',
					why: 'Test reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: emojiOption
				}
			});

			expect(screen.getAllByText(/That sounds fun!/).length).toBeGreaterThan(0);
		});

		it('should handle single option', () => {
			const singleOption: ResponseOption[] = [mockOptions[0]];

			render(ResponseOptions, {
				props: {
					options: singleOption
				}
			});

			expect(screen.getAllByText(mockOptions[0].message).length).toBeGreaterThan(0);
		});

		it('should handle options without IDs', () => {
			const optionsWithoutIds: ResponseOption[] = [
				{
					tone: 'playful',
					message: 'Message without ID',
					why: 'Reason'
				}
			];

			render(ResponseOptions, {
				props: {
					options: optionsWithoutIds
				}
			});

			expect(screen.getAllByText('Message without ID').length).toBeGreaterThan(0);
		});
	});

	describe('Accessibility', () => {
		it('should have proper role attributes', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const buttons = screen.getAllByRole('button');
			expect(buttons.length).toBeGreaterThan(0);
		});

		it('should have proper tabindex for keyboard navigation', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			const cards = screen.getAllByRole('button');
			// Filter to only card buttons (not copy/edit buttons)
			const cardButtons = cards.filter((btn) => btn.getAttribute('tabindex') === '0');
			expect(cardButtons.length).toBeGreaterThan(0);
		});

		it('should have descriptive button titles', () => {
			render(ResponseOptions, {
				props: {
					options: mockOptions
				}
			});

			expect(screen.getAllByTitle('Copy message to clipboard').length).toBeGreaterThan(0);
			expect(screen.getAllByTitle('Edit message before sending').length).toBeGreaterThan(0);
		});
	});
});
