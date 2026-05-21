import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import CompatibilityFlags from './CompatibilityFlags.svelte';
import type { CompatibilityAnalysis } from '$lib/server/ai-assistant-service';

describe('CompatibilityFlags Component', () => {
	let mockAnalysis: CompatibilityAnalysis;

	beforeEach(() => {
		mockAnalysis = {
			greenFlags: [
				{ signal: 'Asks about your interests', reason: 'Shows genuine curiosity' },
				{ signal: 'Mentions shared hobbies', reason: 'Indicates lifestyle compatibility' }
			],
			yellowFlags: [
				{ signal: 'Mentions travel early', reason: 'Could indicate expensive lifestyle' }
			],
			redFlags: [
				{ signal: 'Dismissive of your career', reason: 'Conflicts with your values' }
			],
			overallAssessment: 'This person shows promise but has some concerns.',
			citations: ['Based on: Compatibility Signals', 'Based on: Your Preferences']
		};
	});

	describe('Rendering', () => {
		it('should render the component with analysis data', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('This person shows promise but has some concerns.')).toBeInTheDocument();
		});

		it('should display overall assessment', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			const assessment = screen.getByText('This person shows promise but has some concerns.');
			expect(assessment).toBeInTheDocument();
		});

		it('should display green flags section with count', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Green Flags (2)')).toBeInTheDocument();
		});

		it('should display yellow flags section with count', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Yellow Flags (1)')).toBeInTheDocument();
		});

		it('should display red flags section with count', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Red Flags (1)')).toBeInTheDocument();
		});

		it('should display all green flag signals and reasons', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Asks about your interests')).toBeInTheDocument();
			expect(screen.getByText('Shows genuine curiosity')).toBeInTheDocument();
			expect(screen.getByText('Mentions shared hobbies')).toBeInTheDocument();
			expect(screen.getByText('Indicates lifestyle compatibility')).toBeInTheDocument();
		});

		it('should display all yellow flag signals and reasons', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Mentions travel early')).toBeInTheDocument();
			expect(screen.getByText('Could indicate expensive lifestyle')).toBeInTheDocument();
		});

		it('should display all red flag signals and reasons', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Dismissive of your career')).toBeInTheDocument();
			expect(screen.getByText('Conflicts with your values')).toBeInTheDocument();
		});

		it('should display citations section', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Sources:')).toBeInTheDocument();
			expect(screen.getByText('Based on: Compatibility Signals')).toBeInTheDocument();
			expect(screen.getByText('Based on: Your Preferences')).toBeInTheDocument();
		});
	});

	describe('Expandable Sections', () => {
		it('should have green flags section expanded by default', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Asks about your interests')).toBeInTheDocument();
		});

		it('should have yellow flags section expanded by default', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Mentions travel early')).toBeInTheDocument();
		});

		it('should have red flags section expanded by default', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Dismissive of your career')).toBeInTheDocument();
		});

		it('should collapse green flags section when clicked', async () => {
			const { container } = render(CompatibilityFlags, { props: { analysis: mockAnalysis } });
			const user = userEvent.setup();

			const greenFlagsButton = screen.getByText('Green Flags (2)').closest('button');
			expect(greenFlagsButton).toBeInTheDocument();

			await user.click(greenFlagsButton!);

			// After collapse, the flag details should not be visible
			expect(screen.queryByText('Asks about your interests')).not.toBeInTheDocument();
		});

		it('should expand green flags section when clicked again', async () => {
			const { container } = render(CompatibilityFlags, { props: { analysis: mockAnalysis } });
			const user = userEvent.setup();

			const greenFlagsButton = screen.getByText('Green Flags (2)').closest('button');

			// Collapse
			await user.click(greenFlagsButton!);
			expect(screen.queryByText('Asks about your interests')).not.toBeInTheDocument();

			// Expand
			await user.click(greenFlagsButton!);
			expect(screen.getByText('Asks about your interests')).toBeInTheDocument();
		});

		it('should collapse yellow flags section when clicked', async () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });
			const user = userEvent.setup();

			const yellowFlagsButton = screen.getByText('Yellow Flags (1)').closest('button');
			await user.click(yellowFlagsButton!);

			expect(screen.queryByText('Mentions travel early')).not.toBeInTheDocument();
		});

		it('should collapse red flags section when clicked', async () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });
			const user = userEvent.setup();

			const redFlagsButton = screen.getByText('Red Flags (1)').closest('button');
			await user.click(redFlagsButton!);

			expect(screen.queryByText('Dismissive of your career')).not.toBeInTheDocument();
		});

		it('should allow independent toggling of sections', async () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });
			const user = userEvent.setup();

			const greenFlagsButton = screen.getByText('Green Flags (2)').closest('button');
			const yellowFlagsButton = screen.getByText('Yellow Flags (1)').closest('button');

			// Collapse green
			await user.click(greenFlagsButton!);
			expect(screen.queryByText('Asks about your interests')).not.toBeInTheDocument();

			// Yellow should still be visible
			expect(screen.getByText('Mentions travel early')).toBeInTheDocument();

			// Collapse yellow
			await user.click(yellowFlagsButton!);
			expect(screen.queryByText('Mentions travel early')).not.toBeInTheDocument();

			// Expand green
			await user.click(greenFlagsButton!);
			expect(screen.getByText('Asks about your interests')).toBeInTheDocument();
		});
	});

	describe('Loading State', () => {
		it('should display loading spinner when isLoading is true', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis, isLoading: true } });

			expect(screen.getByText('Analyzing compatibility...')).toBeInTheDocument();
		});

		it('should not display flags when isLoading is true', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis, isLoading: true } });

			expect(screen.queryByText('Green Flags (2)')).not.toBeInTheDocument();
			expect(screen.queryByText('Yellow Flags (1)')).not.toBeInTheDocument();
			expect(screen.queryByText('Red Flags (1)')).not.toBeInTheDocument();
		});

		it('should display flags when isLoading is false', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis, isLoading: false } });

			expect(screen.getByText('Green Flags (2)')).toBeInTheDocument();
		});
	});

	describe('Empty States', () => {
		it('should display empty state when no flags are present', () => {
			const emptyAnalysis: CompatibilityAnalysis = {
				greenFlags: [],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'No analysis available',
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: emptyAnalysis } });

			expect(screen.getByText('No compatibility analysis available yet')).toBeInTheDocument();
		});

		it('should not display green flags section when empty', () => {
			const analysisWithoutGreen: CompatibilityAnalysis = {
				greenFlags: [],
				yellowFlags: mockAnalysis.yellowFlags,
				redFlags: mockAnalysis.redFlags,
				overallAssessment: mockAnalysis.overallAssessment,
				citations: mockAnalysis.citations
			};

			render(CompatibilityFlags, { props: { analysis: analysisWithoutGreen } });

			expect(screen.queryByText(/Green Flags/)).not.toBeInTheDocument();
		});

		it('should not display yellow flags section when empty', () => {
			const analysisWithoutYellow: CompatibilityAnalysis = {
				greenFlags: mockAnalysis.greenFlags,
				yellowFlags: [],
				redFlags: mockAnalysis.redFlags,
				overallAssessment: mockAnalysis.overallAssessment,
				citations: mockAnalysis.citations
			};

			render(CompatibilityFlags, { props: { analysis: analysisWithoutYellow } });

			expect(screen.queryByText(/Yellow Flags/)).not.toBeInTheDocument();
		});

		it('should not display red flags section when empty', () => {
			const analysisWithoutRed: CompatibilityAnalysis = {
				greenFlags: mockAnalysis.greenFlags,
				yellowFlags: mockAnalysis.yellowFlags,
				redFlags: [],
				overallAssessment: mockAnalysis.overallAssessment,
				citations: mockAnalysis.citations
			};

			render(CompatibilityFlags, { props: { analysis: analysisWithoutRed } });

			expect(screen.queryByText(/Red Flags/)).not.toBeInTheDocument();
		});

		it('should not display citations section when empty', () => {
			const analysisWithoutCitations: CompatibilityAnalysis = {
				greenFlags: mockAnalysis.greenFlags,
				yellowFlags: mockAnalysis.yellowFlags,
				redFlags: mockAnalysis.redFlags,
				overallAssessment: mockAnalysis.overallAssessment,
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: analysisWithoutCitations } });

			expect(screen.queryByText('Sources:')).not.toBeInTheDocument();
		});
	});

	describe('Flag Counts', () => {
		it('should display correct count for multiple green flags', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Green Flags (2)')).toBeInTheDocument();
		});

		it('should display correct count for single yellow flag', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Yellow Flags (1)')).toBeInTheDocument();
		});

		it('should display correct count for single red flag', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			expect(screen.getByText('Red Flags (1)')).toBeInTheDocument();
		});

		it('should display correct count for multiple green flags', () => {
			const analysisWithManyGreen: CompatibilityAnalysis = {
				greenFlags: [
					{ signal: 'Green flag 1', reason: 'Reason 1' },
					{ signal: 'Green flag 2', reason: 'Reason 2' },
					{ signal: 'Green flag 3', reason: 'Reason 3' }
				],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Test',
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: analysisWithManyGreen } });

			expect(screen.getByText('Green Flags (3)')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper button elements for expandable sections', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			const buttons = screen.getAllByRole('button');
			expect(buttons.length).toBeGreaterThan(0);
		});

		it('should have descriptive text for each flag', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			// Each flag should have both signal and reason
			expect(screen.getByText('Asks about your interests')).toBeInTheDocument();
			expect(screen.getByText('Shows genuine curiosity')).toBeInTheDocument();
		});
	});

	describe('Data Integrity', () => {
		it('should preserve all flag data when rendering', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			// Verify all green flags are present
			mockAnalysis.greenFlags.forEach((flag) => {
				expect(screen.getByText(flag.signal)).toBeInTheDocument();
				expect(screen.getByText(flag.reason)).toBeInTheDocument();
			});

			// Verify all yellow flags are present
			mockAnalysis.yellowFlags.forEach((flag) => {
				expect(screen.getByText(flag.signal)).toBeInTheDocument();
				expect(screen.getByText(flag.reason)).toBeInTheDocument();
			});

			// Verify all red flags are present
			mockAnalysis.redFlags.forEach((flag) => {
				expect(screen.getByText(flag.signal)).toBeInTheDocument();
				expect(screen.getByText(flag.reason)).toBeInTheDocument();
			});
		});

		it('should preserve all citations when rendering', () => {
			render(CompatibilityFlags, { props: { analysis: mockAnalysis } });

			mockAnalysis.citations.forEach((citation) => {
				expect(screen.getByText(citation)).toBeInTheDocument();
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long flag signals', () => {
			const longSignalAnalysis: CompatibilityAnalysis = {
				greenFlags: [
					{
						signal:
							'This is a very long flag signal that describes a complex behavior pattern that the match has demonstrated',
						reason: 'This is a detailed reason'
					}
				],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Test',
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: longSignalAnalysis } });

			expect(
				screen.getByText(
					'This is a very long flag signal that describes a complex behavior pattern that the match has demonstrated'
				)
			).toBeInTheDocument();
		});

		it('should handle very long flag reasons', () => {
			const longReasonAnalysis: CompatibilityAnalysis = {
				greenFlags: [
					{
						signal: 'Test signal',
						reason:
							'This is a very long reason that provides detailed explanation about why this signal is important and what it means for compatibility'
					}
				],
				yellowFlags: [],
				redFlags: [],
				overallAssessment: 'Test',
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: longReasonAnalysis } });

			expect(
				screen.getByText(
					'This is a very long reason that provides detailed explanation about why this signal is important and what it means for compatibility'
				)
			).toBeInTheDocument();
		});

		it('should handle many flags', () => {
			const manyFlagsAnalysis: CompatibilityAnalysis = {
				greenFlags: Array.from({ length: 10 }, (_, i) => ({
					signal: `Green flag ${i + 1}`,
					reason: `Reason for green flag ${i + 1}`
				})),
				yellowFlags: Array.from({ length: 5 }, (_, i) => ({
					signal: `Yellow flag ${i + 1}`,
					reason: `Reason for yellow flag ${i + 1}`
				})),
				redFlags: Array.from({ length: 3 }, (_, i) => ({
					signal: `Red flag ${i + 1}`,
					reason: `Reason for red flag ${i + 1}`
				})),
				overallAssessment: 'Test',
				citations: []
			};

			render(CompatibilityFlags, { props: { analysis: manyFlagsAnalysis } });

			expect(screen.getByText('Green Flags (10)')).toBeInTheDocument();
			expect(screen.getByText('Yellow Flags (5)')).toBeInTheDocument();
			expect(screen.getByText('Red Flags (3)')).toBeInTheDocument();
		});
	});
});
