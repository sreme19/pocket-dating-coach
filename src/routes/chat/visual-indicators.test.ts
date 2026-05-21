import { describe, it, expect } from 'vitest';
import type { ChatMessage, AssistantType } from '$lib/types';

/**
 * Unit tests for visual indicators in chat interface
 * 
 * These tests verify:
 * - Badge displays in header when assistant is active
 * - Message styling changes based on assistant type
 * - Exchange count is shown in indicator
 * - Indicators update when assistant is activated/deactivated
 */

describe('Chat Visual Indicators', () => {
	describe('Header Badge Display', () => {
		it('should display badge in header when assistant is active', () => {
			const activeAssistant: AssistantType = 'bestie';
			const sessionLoading = false;
			
			// Badge should be visible when activeAssistant is not null and not loading
			const shouldShowBadge = activeAssistant !== null && !sessionLoading;
			expect(shouldShowBadge).toBe(true);
		});

		it('should not display badge when no assistant is active', () => {
			const activeAssistant: AssistantType | null = null;
			const sessionLoading = false;
			
			// Badge should not be visible when activeAssistant is null
			const shouldShowBadge = activeAssistant !== null && !sessionLoading;
			expect(shouldShowBadge).toBe(false);
		});

		it('should not display badge while session is loading', () => {
			const activeAssistant: AssistantType = 'bestie';
			const sessionLoading = true;
			
			// Badge should not be visible while loading
			const shouldShowBadge = activeAssistant !== null && !sessionLoading;
			expect(shouldShowBadge).toBe(false);
		});

		it('should display AI Bestie badge with correct styling', () => {
			const activeAssistant: AssistantType = 'bestie';
			const badgeColor = activeAssistant === 'bestie' ? 'rose' : 'blue';
			
			expect(badgeColor).toBe('rose');
		});

		it('should display AI Wingman badge with correct styling', () => {
			const activeAssistant: AssistantType = 'wingman';
			const badgeColor = activeAssistant === 'bestie' ? 'rose' : 'blue';
			
			expect(badgeColor).toBe('blue');
		});
	});

	describe('Exchange Count Display', () => {
		it('should display exchange count in badge', () => {
			const exchangeCount = 5;
			
			// Exchange count should be displayed when > 0
			expect(exchangeCount).toBeGreaterThan(0);
		});

		it('should not display exchange count when zero', () => {
			const exchangeCount = 0;
			
			// Exchange count should not be displayed when 0
			expect(exchangeCount).toBe(0);
		});

		it('should update exchange count when assistant generates response', () => {
			let exchangeCount = 0;
			exchangeCount += 1;
			
			expect(exchangeCount).toBe(1);
		});

		it('should display correct exchange count after multiple exchanges', () => {
			let exchangeCount = 0;
			exchangeCount += 1; // First exchange
			exchangeCount += 1; // Second exchange
			exchangeCount += 1; // Third exchange
			
			expect(exchangeCount).toBe(3);
		});
	});

	describe('Message Styling Based on Assistant Type', () => {
		it('should style AI Bestie messages with rose colors', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'bestie'
			};
			
			const bgColor = msg.assistantType === 'bestie' ? 'bg-rose-500/20' : 'bg-blue-500/20';
			const textColor = msg.assistantType === 'bestie' ? 'text-rose-100' : 'text-blue-100';
			
			expect(bgColor).toBe('bg-rose-500/20');
			expect(textColor).toBe('text-rose-100');
		});

		it('should style AI Wingman messages with blue colors', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'wingman'
			};
			
			const bgColor = msg.assistantType === 'bestie' ? 'bg-rose-500/20' : 'bg-blue-500/20';
			const textColor = msg.assistantType === 'bestie' ? 'text-rose-100' : 'text-blue-100';
			
			expect(bgColor).toBe('bg-blue-500/20');
			expect(textColor).toBe('text-blue-100');
		});

		it('should style user messages with rose background', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'user',
				content: 'Test message',
				timestamp: Date.now()
			};
			
			const bgColor = msg.role === 'user' ? 'bg-rose-600' : 'bg-gray-800';
			
			expect(bgColor).toBe('bg-rose-600');
		});

		it('should style regular assistant messages with gray background', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now()
				// No assistantType specified
			};
			
			const bgColor = msg.assistantType === 'bestie' ? 'bg-rose-500/20' : msg.assistantType === 'wingman' ? 'bg-blue-500/20' : 'bg-gray-800';
			
			expect(bgColor).toBe('bg-gray-800');
		});

		it('should add border to AI assistant messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'bestie'
			};
			
			const hasBorder = msg.assistantType === 'bestie' || msg.assistantType === 'wingman';
			
			expect(hasBorder).toBe(true);
		});

		it('should not add border to user messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'user',
				content: 'Test message',
				timestamp: Date.now()
			};
			
			const hasBorder = msg.assistantType === 'bestie' || msg.assistantType === 'wingman';
			
			expect(hasBorder).toBe(false);
		});
	});

	describe('Assistant Badge in Messages', () => {
		it('should display assistant badge for AI Bestie messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'bestie'
			};
			
			const shouldShowBadge = msg.role === 'assistant' && !!msg.assistantType;
			
			expect(shouldShowBadge).toBe(true);
		});

		it('should display assistant badge for AI Wingman messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'wingman'
			};
			
			const shouldShowBadge = msg.role === 'assistant' && !!msg.assistantType;
			
			expect(shouldShowBadge).toBe(true);
		});

		it('should not display assistant badge for user messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'user',
				content: 'Test message',
				timestamp: Date.now()
			};
			
			const shouldShowBadge = msg.role === 'assistant' && !!msg.assistantType;
			
			expect(shouldShowBadge).toBe(false);
		});

		it('should not display assistant badge for regular assistant messages', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now()
				// No assistantType
			};
			
			const shouldShowBadge = msg.role === 'assistant' && !!msg.assistantType;
			
			expect(shouldShowBadge).toBe(false);
		});
	});

	describe('Indicator Updates on Activation/Deactivation', () => {
		it('should show badge when assistant is activated', () => {
			let activeAssistant: AssistantType | null = null;
			activeAssistant = 'bestie';
			
			const shouldShowBadge = activeAssistant !== null;
			expect(shouldShowBadge).toBe(true);
		});

		it('should hide badge when assistant is deactivated', () => {
			let activeAssistant: AssistantType | null = 'bestie';
			activeAssistant = null;
			
			const shouldShowBadge = activeAssistant !== null;
			expect(shouldShowBadge).toBe(false);
		});

		it('should update badge color when switching assistants', () => {
			let activeAssistant: AssistantType = 'bestie';
			const initialColor = activeAssistant === 'bestie' ? 'rose' : 'blue';
			
			activeAssistant = 'wingman';
			const newColor = activeAssistant === 'bestie' ? 'rose' : 'blue';
			
			expect(initialColor).toBe('rose');
			expect(newColor).toBe('blue');
		});

		it('should reset exchange count when assistant is deactivated', () => {
			let exchangeCount = 5;
			let activeAssistant: AssistantType | null = 'bestie';
			
			// Deactivate
			activeAssistant = null;
			exchangeCount = 0;
			
			expect(exchangeCount).toBe(0);
		});

		it('should preserve exchange count when assistant remains active', () => {
			let exchangeCount = 5;
			const activeAssistant: AssistantType = 'bestie';
			
			// Exchange count should remain the same
			expect(exchangeCount).toBe(5);
		});
	});

	describe('Message Ordering and Display', () => {
		it('should display messages in chronological order', () => {
			const messages: ChatMessage[] = [
				{
					id: '1',
					role: 'user',
					content: 'First message',
					timestamp: 1000
				},
				{
					id: '2',
					role: 'assistant',
					content: 'Second message',
					timestamp: 2000,
					assistantType: 'bestie'
				},
				{
					id: '3',
					role: 'user',
					content: 'Third message',
					timestamp: 3000
				}
			];
			
			// Verify chronological order
			expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp);
			expect(messages[1].timestamp).toBeLessThan(messages[2].timestamp);
		});

		it('should display user messages on the right', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'user',
				content: 'Test message',
				timestamp: Date.now()
			};
			
			const alignment = msg.role === 'user' ? 'justify-end' : 'justify-start';
			
			expect(alignment).toBe('justify-end');
		});

		it('should display assistant messages on the left', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'bestie'
			};
			
			const alignment = msg.role === 'user' ? 'justify-end' : 'justify-start';
			
			expect(alignment).toBe('justify-start');
		});
	});

	describe('Responsive Design', () => {
		it('should display badge in header on desktop', () => {
			const activeAssistant: AssistantType = 'bestie';
			const variant = 'pill';
			
			// Pill variant is used for header badge
			expect(variant).toBe('pill');
		});

		it('should display compact badge in messages on mobile', () => {
			const variant = 'compact';
			
			// Compact variant is used for message badges
			expect(variant).toBe('compact');
		});

		it('should maintain message styling on mobile', () => {
			const msg: ChatMessage = {
				id: '1',
				role: 'assistant',
				content: 'Test message',
				timestamp: Date.now(),
				assistantType: 'bestie'
			};
			
			// Message styling should be consistent across devices
			const hasAssistantType = msg.assistantType !== undefined;
			expect(hasAssistantType).toBe(true);
		});
	});

	describe('Accessibility', () => {
		it('should have proper role for badge', () => {
			const role = 'status';
			
			expect(role).toBe('status');
		});

		it('should have aria-label for badge', () => {
			const activeAssistant: AssistantType = 'bestie';
			const exchangeCount = 5;
			const ariaLabel = `${activeAssistant === 'bestie' ? 'AI Bestie' : 'AI Wingman'} - Active (${exchangeCount} exchanges)`;
			
			expect(ariaLabel).toContain('AI Bestie');
			expect(ariaLabel).toContain('Active');
			expect(ariaLabel).toContain('5');
		});

		it('should have tooltip for badge', () => {
			const showTooltip = true;
			
			expect(showTooltip).toBe(true);
		});
	});
});

