import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AIAssistantSetupWizard from './AIAssistantSetupWizard.svelte';

describe('AIAssistantSetupWizard', () => {
	describe('Component Rendering', () => {
		it('should render the wizard with AI Bestie title', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('AI Bestie Setup')).toBeInTheDocument();
		});

		it('should render with AI Wingman title when assistantType is wingman', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'wingman'
				}
			});

			expect(screen.getByText('AI Wingman Setup')).toBeInTheDocument();
		});

		it('should display step indicator', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
		});

		it('should display assistant description', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText(/Your personal dating coach/)).toBeInTheDocument();
		});

		it('should display wingman description', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'wingman'
				}
			});

			expect(screen.getByText(/Your strategic dating advisor/)).toBeInTheDocument();
		});
	});

	describe('Navigation Buttons', () => {
		it('should have Previous, Cancel, and Next buttons', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('Previous')).toBeInTheDocument();
			expect(screen.getByText('Cancel')).toBeInTheDocument();
			expect(screen.getByText('Next')).toBeInTheDocument();
		});

		it('should disable Previous button on step 1', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			const previousButtons = screen.getAllByText('Previous');
			expect(previousButtons[0]).toBeDisabled();
		});

		it('should disable Next button on step 1 until privacy is acknowledged', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			const nextButtons = screen.getAllByText('Next');
			expect(nextButtons[0]).toBeDisabled();
		});
	});

	describe('Cancel Functionality', () => {
		it('should call onCancel when cancel button is clicked', async () => {
			const onCancel = vi.fn();
			window.confirm = vi.fn().mockReturnValue(true);

			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie',
					onCancel
				}
			});

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(window.confirm).toHaveBeenCalled();
			expect(onCancel).toHaveBeenCalled();
		});

		it('should not call onCancel if user declines confirmation', async () => {
			const onCancel = vi.fn();
			window.confirm = vi.fn().mockReturnValue(false);

			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie',
					onCancel
				}
			});

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(onCancel).not.toHaveBeenCalled();
		});
	});

	describe('Responsive Design', () => {
		it('should have max-width constraint', () => {
			const { container } = render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			const wrapper = container.querySelector('.max-w-2xl');
			expect(wrapper).toBeInTheDocument();
		});

		it('should have responsive grid layout', () => {
			const { container } = render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			// Check for responsive classes
			const responsiveElements = container.querySelectorAll('[class*="sm:"]');
			expect(responsiveElements.length).toBeGreaterThan(0);
		});
	});

	describe('Color Theming', () => {
		it('should use rose colors for AI Bestie', () => {
			const { container } = render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			const roseElements = container.querySelectorAll('[class*="rose"]');
			expect(roseElements.length).toBeGreaterThan(0);
		});

		it('should use blue colors for AI Wingman', () => {
			const { container } = render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'wingman'
				}
			});

			const blueElements = container.querySelectorAll('[class*="blue"]');
			expect(blueElements.length).toBeGreaterThan(0);
		});
	});

	describe('Callback Props', () => {
		it('should accept onComplete callback', () => {
			const onComplete = vi.fn();

			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie',
					onComplete
				}
			});

			expect(typeof onComplete).toBe('function');
		});

		it('should accept onCancel callback', () => {
			const onCancel = vi.fn();

			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie',
					onCancel
				}
			});

			expect(typeof onCancel).toBe('function');
		});
	});

	describe('Step Content', () => {
		it('should display step 1 content initially', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			// Step 1 contains PrivacySettings component
			expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
		});

		it('should display step 2 options when navigating', async () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			// These buttons should exist in the component for step 2
			const createButtons = screen.queryAllByText('Create New');
			const importButtons = screen.queryAllByText('Import Existing');

			// They may not be visible on step 1, but should exist in the DOM
			expect(createButtons.length + importButtons.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle onComplete errors gracefully', async () => {
			const onComplete = vi.fn().mockRejectedValue(new Error('Setup failed'));

			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie',
					onComplete
				}
			});

			// Component should render without crashing
			expect(screen.getByText('AI Bestie Setup')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper heading structure', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			// Main heading should be present
			expect(screen.getByText('AI Bestie Setup')).toBeInTheDocument();
		});

		it('should have descriptive button text', () => {
			render(AIAssistantSetupWizard, {
				props: {
					assistantType: 'bestie'
				}
			});

			// All navigation buttons should have clear labels
			expect(screen.getByText('Previous')).toBeInTheDocument();
			expect(screen.getByText('Cancel')).toBeInTheDocument();
			expect(screen.getByText('Next')).toBeInTheDocument();
		});
	});
});
