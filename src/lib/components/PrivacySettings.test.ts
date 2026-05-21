import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PrivacySettings from './PrivacySettings.svelte';

describe('PrivacySettings Component', () => {
	describe('First Activation Privacy Notice', () => {
		it('should display privacy notice when isFirstActivation is true', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('Privacy Notice')).toBeInTheDocument();
			expect(screen.getByText(/Before activating AI Bestie/)).toBeInTheDocument();
		});

		it('should not display privacy notice when isFirstActivation is false', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: false,
					assistantType: 'bestie'
				}
			});

			expect(screen.queryByText('Privacy Notice')).not.toBeInTheDocument();
		});

		it('should display correct assistant label for AI Bestie', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('I understand how my data is used and agree to activate AI Bestie')).toBeInTheDocument();
		});

		it('should display correct assistant label for AI Wingman', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'wingman'
				}
			});

			expect(screen.getByText('I understand how my data is used and agree to activate AI Wingman')).toBeInTheDocument();
		});
	});

	describe('Data Usage Explanation', () => {
		it('should display data usage sections', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('Data Sent to Claude AI')).toBeInTheDocument();
			expect(screen.getByText('Data Storage')).toBeInTheDocument();
			expect(screen.getByText('Privacy Protection')).toBeInTheDocument();
		});

		it('should explain data sent to Claude', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			const dataText = screen.getByText(/preferences.*profile.*match context/i);
			expect(dataText).toBeInTheDocument();
		});

		it('should explain data storage in Supabase', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText(/Supabase database/)).toBeInTheDocument();
		});

		it('should explain privacy protection measures', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText(/personally identifiable information/i)).toBeInTheDocument();
		});
	});

	describe('Privacy Acknowledgment', () => {
		it('should require acknowledgment before activation', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			const agreeButtons = screen.getAllByText('I Agree & Activate');
			const button = agreeButtons[0].closest('button');
			expect(button).toBeDisabled();
		});

		it('should enable activation button when acknowledged', async () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie'
				}
			});

			const checkbox = screen.getByRole('checkbox');
			await fireEvent.click(checkbox);

			const agreeButtons = screen.getAllByText('I Agree & Activate');
			const button = agreeButtons[0].closest('button');
			expect(button).not.toBeDisabled();
		});

		it('should call onAcknowledge when user agrees', async () => {
			const onAcknowledge = vi.fn().mockResolvedValue(undefined);

			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie',
					onAcknowledge
				}
			});

			const checkbox = screen.getByRole('checkbox');
			await fireEvent.click(checkbox);

			const agreeButtons = screen.getAllByText('I Agree & Activate');
			const button = agreeButtons[0].closest('button');
			if (button) {
				await fireEvent.click(button);
			}

			await waitFor(() => {
				expect(onAcknowledge).toHaveBeenCalled();
			});
		});
	});

	describe('Delete Conversation History', () => {
		it('should display delete conversation history button', () => {
			render(PrivacySettings, {
				props: {
					assistantType: 'bestie'
				}
			});

			const buttons = screen.getAllByText('Delete Conversation History');
			expect(buttons.length).toBeGreaterThan(0);
		});
	});

	describe('Delete All Data', () => {
		it('should display delete all data button', () => {
			render(PrivacySettings, {
				props: {
					assistantType: 'bestie'
				}
			});

			const buttons = screen.getAllByText(/Delete All AI Bestie Data/);
			expect(buttons.length).toBeGreaterThan(0);
		});
	});

	describe('Data Retention Information', () => {
		it('should display data retention information', () => {
			render(PrivacySettings, {
				props: {
					assistantType: 'bestie'
				}
			});

			expect(screen.getByText('Data Retention')).toBeInTheDocument();
			expect(screen.getByText(/retained for as long as your account is active/)).toBeInTheDocument();
		});
	});

	describe('Close Functionality', () => {
		it('should call onClose when cancel button clicked during first activation', async () => {
			const onClose = vi.fn();

			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'bestie',
					onClose
				}
			});

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(onClose).toHaveBeenCalled();
		});
	});

	describe('Wingman Assistant', () => {
		it('should display correct text for AI Wingman', () => {
			render(PrivacySettings, {
				props: {
					isFirstActivation: true,
					assistantType: 'wingman'
				}
			});

			expect(screen.getByText('I understand how my data is used and agree to activate AI Wingman')).toBeInTheDocument();
			expect(screen.getByText(/personality.*profile/i)).toBeInTheDocument();
		});

		it('should show wingman-specific delete button text', () => {
			render(PrivacySettings, {
				props: {
					assistantType: 'wingman'
				}
			});

			const buttons = screen.getAllByText(/Delete All AI Wingman Data/);
			expect(buttons.length).toBeGreaterThan(0);
		});
	});
});
