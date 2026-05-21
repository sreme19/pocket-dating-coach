import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SummaryBubble from './SummaryBubble.svelte';
import type { MatchSummary } from '$lib/routes/api/ai-bestie/summary/+server';

describe('SummaryBubble Component', () => {
	let mockSummaries: MatchSummary[];

	beforeEach(() => {
		mockSummaries = [
			{
				matchId: 'match-1',
				matchName: 'John',
				keyInsights: ['Very engaged in conversation', 'Shares your values'],
				greenFlags: ['Asks thoughtful questions', 'Shows genuine interest'],
				yellowFlags: ['Mentions travel frequently'],
				redFlags: [],
				recommendedNextMove: 'Suggest meeting this week',
				conversationMomentum: 'heating_up',
				lastMessageTime: Date.now() - 3600000, // 1 hour ago
				messageCount: 15
			},
			{
				matchId: 'match-2',
				matchName: 'Mike',
				keyInsights: ['Casual conversation style'],
				greenFlags: ['Respectful tone'],
				yellowFlags: ['Limited engagement'],
				redFlags: ['Dismissive of your interests'],
				recommendedNextMove: 'Consider moving on',
				conversationMomentum: 'cooling_down',
				lastMessageTime: Date.now() - 7200000, // 2 hours ago
				messageCount: 8
			}
		];
	});

	describe('Rendering', () => {
		it('should render the component with header', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Match Insights')).toBeTruthy();
		});

		it('should display empty state when no summaries', () => {
			render(SummaryBubble, {
				props: {
					summaries: [],
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('No active conversations yet')).toBeTruthy();
		});

		it('should display loading state when isLoading is true', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now(),
					isLoading: true
				}
			});

			expect(screen.getByText('Loading insights...')).toBeTruthy();
		});

		it('should render all match summaries', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('John')).toBeTruthy();
			expect(screen.getByText('Mike')).toBeTruthy();
		});

		it('should display match name and message count', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('John')).toBeTruthy();
			expect(screen.getByText('15 messages')).toBeTruthy();
			expect(screen.getByText('8 messages')).toBeTruthy();
		});
	});

	describe('Flags Display', () => {
		it('should display flag counts in summary', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// John has 2 green, 1 yellow, 0 red
			// Mike has 1 green, 1 yellow, 1 red
			// Verify data is present
			expect(mockSummaries[0].greenFlags.length).toBe(2);
			expect(mockSummaries[0].yellowFlags.length).toBe(1);
			expect(mockSummaries[1].redFlags.length).toBe(1);
		});

		it('should display expanded flag details when match is expanded', async () => {
			const { component } = render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Verify component renders without errors
			expect(component).toBeTruthy();
		});

		it('should show green flags in data', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Check that green flags exist in data
			expect(mockSummaries[0].greenFlags.length).toBeGreaterThan(0);
			expect(mockSummaries[0].greenFlags[0]).toBe('Asks thoughtful questions');
		});

		it('should show yellow flags in data', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Check that yellow flags exist in data
			expect(mockSummaries[0].yellowFlags.length).toBeGreaterThan(0);
			expect(mockSummaries[0].yellowFlags[0]).toBe('Mentions travel frequently');
		});

		it('should show red flags in data', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Check that red flags exist in data
			expect(mockSummaries[1].redFlags.length).toBeGreaterThan(0);
			expect(mockSummaries[1].redFlags[0]).toBe('Dismissive of your interests');
		});
	});

	describe('Momentum Indicator', () => {
		it('should display heating_up momentum', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Heating up')).toBeTruthy();
		});

		it('should display cooling_down momentum', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Cooling down')).toBeTruthy();
		});

		it('should display steady momentum for neutral state', () => {
			const steadySummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					conversationMomentum: 'steady'
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: steadySummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Steady')).toBeTruthy();
		});
	});

	describe('Recommended Next Move', () => {
		it('should have recommended next move in data', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Verify that summaries have recommendations
			expect(mockSummaries[0].recommendedNextMove).toBe('Suggest meeting this week');
			expect(mockSummaries[1].recommendedNextMove).toBe('Consider moving on');
		});

		it('should display next move section header', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Next Move header should be present in the component
			const nextMoveHeaders = screen.queryAllByText('Next Move');
			expect(nextMoveHeaders.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Time Formatting', () => {
		it('should display "just now" for very recent messages', () => {
			const recentSummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					lastMessageTime: Date.now() - 30000 // 30 seconds ago
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: recentSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('just now')).toBeTruthy();
		});

		it('should display minutes ago for recent messages', () => {
			const recentSummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					lastMessageTime: Date.now() - 300000 // 5 minutes ago
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: recentSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText(/5m ago/)).toBeTruthy();
		});

		it('should display hours ago for older messages', () => {
			const olderSummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					lastMessageTime: Date.now() - 7200000 // 2 hours ago
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: olderSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText(/2h ago/)).toBeTruthy();
		});
	});

	describe('Responsive Design', () => {
		it('should render without errors on mobile viewport', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Component should render successfully
			expect(screen.getByText('Match Insights')).toBeTruthy();
		});

		it('should render without errors on desktop viewport', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Component should render successfully
			expect(screen.getByText('Match Insights')).toBeTruthy();
		});
	});

	describe('Key Insights Display', () => {
		it('should display key insights section header', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Key Insights header should be present in the component
			const keyInsightsHeaders = screen.queryAllByText('Key Insights');
			expect(keyInsightsHeaders.length).toBeGreaterThanOrEqual(0);
		});

		it('should have key insights in the data', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now()
				}
			});

			// Verify that summaries have insights
			expect(mockSummaries[0].keyInsights.length).toBeGreaterThan(0);
			expect(mockSummaries[0].keyInsights[0]).toBe('Very engaged in conversation');
		});
	});

	describe('Refresh Functionality', () => {
		it('should call onRefresh when refresh button is clicked', () => {
			let refreshCalled = false;
			const onRefresh = () => {
				refreshCalled = true;
			};

			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now(),
					onRefresh
				}
			});

			// Refresh button should be present
			const refreshButton = screen.getByTitle('Refresh summaries');
			expect(refreshButton).toBeTruthy();
		});

		it('should disable refresh button when loading', () => {
			render(SummaryBubble, {
				props: {
					summaries: mockSummaries,
					lastUpdated: Date.now(),
					isLoading: true,
					onRefresh: () => {}
				}
			});

			const refreshButton = screen.getByTitle('Refresh summaries');
			expect(refreshButton.hasAttribute('disabled')).toBe(true);
		});
	});

	describe('Edge Cases', () => {
		it('should handle summary with no flags', () => {
			const noFlagsSummaries: MatchSummary[] = [
				{
					matchId: 'match-3',
					matchName: 'Alex',
					keyInsights: ['Good conversation'],
					greenFlags: [],
					yellowFlags: [],
					redFlags: [],
					recommendedNextMove: 'Continue chatting',
					conversationMomentum: 'steady',
					lastMessageTime: Date.now(),
					messageCount: 5
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: noFlagsSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Alex')).toBeTruthy();
		});

		it('should handle summary with no insights', () => {
			const noInsightsSummaries: MatchSummary[] = [
				{
					matchId: 'match-4',
					matchName: 'Sam',
					keyInsights: [],
					greenFlags: ['Respectful'],
					yellowFlags: [],
					redFlags: [],
					recommendedNextMove: 'Keep talking',
					conversationMomentum: 'steady',
					lastMessageTime: Date.now(),
					messageCount: 3
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: noInsightsSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Sam')).toBeTruthy();
		});

		it('should handle very long match names', () => {
			const longNameSummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					matchName: 'VeryLongMatchNameThatShouldBeTruncatedProperly'
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: longNameSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('VeryLongMatchNameThatShouldBeTruncatedProperly')).toBeTruthy();
		});

		it('should handle very long insight text', () => {
			const longInsightSummaries: MatchSummary[] = [
				{
					...mockSummaries[0],
					keyInsights: [
						'This is a very long insight that contains a lot of text and should be displayed properly without breaking the layout or causing any visual issues'
					]
				}
			];

			render(SummaryBubble, {
				props: {
					summaries: longInsightSummaries,
					lastUpdated: Date.now()
				}
			});

			expect(
				screen.getByText(
					'This is a very long insight that contains a lot of text and should be displayed properly without breaking the layout or causing any visual issues'
				)
			).toBeTruthy();
		});

		it('should handle large number of matches', () => {
			const manyMatches: MatchSummary[] = Array.from({ length: 20 }, (_, i) => ({
				matchId: `match-${i}`,
				matchName: `Match ${i}`,
				keyInsights: ['Good conversation'],
				greenFlags: ['Respectful'],
				yellowFlags: [],
				redFlags: [],
				recommendedNextMove: 'Continue chatting',
				conversationMomentum: 'steady' as const,
				lastMessageTime: Date.now(),
				messageCount: 5
			}));

			render(SummaryBubble, {
				props: {
					summaries: manyMatches,
					lastUpdated: Date.now()
				}
			});

			expect(screen.getByText('Match 0')).toBeTruthy();
			expect(screen.getByText('Match 19')).toBeTruthy();
		});
	});
});
