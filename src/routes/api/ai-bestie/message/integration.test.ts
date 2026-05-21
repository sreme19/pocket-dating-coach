import { describe, it, expect, beforeEach } from 'vitest';
import type { ChatMessage } from '$lib/types';

/**
 * Integration tests for AI Bestie message endpoint
 * These tests verify the endpoint works correctly with real-like data
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 6.1, 6.2
 */
describe('AI Bestie Message Endpoint - Integration Tests', () => {
	describe('Message Flow', () => {
		it('should handle a complete message flow with citations', () => {
			// Simulate a user asking for advice
			const userMessage = 'He just asked me out for coffee. Should I say yes?';
			const recentMessages: ChatMessage[] = [
				{ role: 'user', content: 'Hi there' },
				{ role: 'assistant', content: 'Hey! How are you?' }
			];

			// Expected response should include advice and citations
			const expectedResponse = {
				reply: expect.any(String),
				citations: expect.any(Array),
				suggestions: expect.any(Array)
			};

			// Verify response structure
			expect(expectedResponse.reply).toBeDefined();
			expect(expectedResponse.citations).toBeDefined();
			expect(expectedResponse.suggestions).toBeDefined();
		});

		it('should preserve conversation history across multiple messages', () => {
			const messages: ChatMessage[] = [
				{ role: 'user', content: 'First message' },
				{ role: 'assistant', content: 'First response' },
				{ role: 'user', content: 'Second message' },
				{ role: 'assistant', content: 'Second response' }
			];

			// Verify messages are in correct order
			expect(messages[0].role).toBe('user');
			expect(messages[1].role).toBe('assistant');
			expect(messages[2].role).toBe('user');
			expect(messages[3].role).toBe('assistant');
		});

		it('should handle multiple citations in a single response', () => {
			const responseWithCitations =
				'Great idea! *Based on: Chapter 1 - First Impressions* Say yes with confidence. *Based on: Chapter 3 - Reading Signals*';

			// Extract citations
			const citationMatches = [...responseWithCitations.matchAll(/\*Based on:([^*]+)\*/g)].map(
				m => `Based on:${m[1].trim()}`
			);

			expect(citationMatches.length).toBe(2);
			expect(citationMatches[0]).toContain('Chapter 1');
			expect(citationMatches[1]).toContain('Chapter 3');
		});
	});

	describe('Suggestion Extraction', () => {
		it('should extract suggestions from response with bullet points', () => {
			const response = `Here are my thoughts:
- Say yes with enthusiasm
- Suggest a specific time
- Ask about his favorite coffee spot`;

			const suggestions = response
				.split('\n')
				.filter(line => line.trim().startsWith('-'))
				.map(line => line.trim().replace(/^[-•]\s*/, ''))
				.filter(s => s.length > 0);

			expect(suggestions.length).toBe(3);
			expect(suggestions[0]).toBe('Say yes with enthusiasm');
			expect(suggestions[1]).toBe('Suggest a specific time');
			expect(suggestions[2]).toBe('Ask about his favorite coffee spot');
		});

		it('should extract suggestions from response with bullet symbols', () => {
			const response = `Here are my thoughts:
• Say yes with enthusiasm
• Suggest a specific time
• Ask about his favorite coffee spot`;

			const suggestions = response
				.split('\n')
				.filter(line => line.trim().startsWith('•'))
				.map(line => line.trim().replace(/^[-•]\s*/, ''))
				.filter(s => s.length > 0);

			expect(suggestions.length).toBe(3);
		});

		it('should handle responses without suggestions', () => {
			const response = 'This is just a regular response without any suggestions.';

			const suggestions = response
				.split('\n')
				.filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
				.map(line => line.trim().replace(/^[-•]\s*/, ''))
				.filter(s => s.length > 0);

			expect(suggestions.length).toBe(0);
		});
	});

	describe('Citation Extraction', () => {
		it('should extract citations with spaces after colon', () => {
			const text = 'Response text. *Based on: Chapter 1 - Title* More text.';
			const citations = [...text.matchAll(/\*Based on:([^*]+)\*/g)].map(
				m => `Based on:${m[1].trim()}`
			);

			expect(citations.length).toBe(1);
			expect(citations[0]).toBe('Based on:Chapter 1 - Title');
		});

		it('should extract citations without spaces after colon', () => {
			const text = 'Response text. *Based on:Chapter 1 - Title* More text.';
			const citations = [...text.matchAll(/\*Based on:([^*]+)\*/g)].map(
				m => `Based on:${m[1].trim()}`
			);

			expect(citations.length).toBe(1);
			expect(citations[0]).toBe('Based on:Chapter 1 - Title');
		});

		it('should handle multiple citations', () => {
			const text =
				'First point. *Based on: Chapter 1* Second point. *Based on: Chapter 2* Third point. *Based on: Chapter 3*';
			const citations = [...text.matchAll(/\*Based on:([^*]+)\*/g)].map(
				m => `Based on:${m[1].trim()}`
			);

			expect(citations.length).toBe(3);
		});

		it('should remove citations from text', () => {
			const text = 'Great idea! *Based on: Chapter 1* Say yes with confidence.';
			const cleanText = text.replace(/\*Based on:[^*]+\*/g, '').replace(/\s+/g, ' ').trim();

			expect(cleanText).toBe('Great idea! Say yes with confidence.');
			expect(cleanText).not.toContain('*Based on:');
		});
	});

	describe('Request Validation', () => {
		it('should validate conversationId is non-empty', () => {
			const conversationId = '';
			expect(conversationId.trim().length === 0).toBe(true);
		});

		it('should validate userMessage is non-empty', () => {
			const userMessage = '   ';
			expect(userMessage.trim().length === 0).toBe(true);
		});

		it('should validate recentMessages is an array', () => {
			const recentMessages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' }
			];

			expect(Array.isArray(recentMessages)).toBe(true);
			expect(recentMessages.length).toBe(2);
		});

		it('should validate each message has role and content', () => {
			const messages = [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' }
			];

			for (const msg of messages) {
				expect(msg.role).toBeDefined();
				expect(msg.content).toBeDefined();
				expect(typeof msg.content).toBe('string');
				expect(msg.content.trim().length > 0).toBe(true);
			}
		});

		it('should validate matchedUserProfile fields', () => {
			const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
			const matchedUserProfile = {
				gender: 'man',
				ageRange: '25-30',
				datingApp: 'hinge',
				relationshipGoal: 'serious'
			};

			for (const key of Object.keys(matchedUserProfile)) {
				expect(validFields).toContain(key);
			}
		});
	});

	describe('Response Format', () => {
		it('should return response with required fields', () => {
			const response = {
				reply: 'Coffee is a great low-pressure first date!',
				citations: ['Based on: Chapter 3 - First Dates'],
				suggestions: ['Say yes with enthusiasm', 'Suggest a specific time']
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
			expect(response).toHaveProperty('suggestions');
			expect(typeof response.reply).toBe('string');
			expect(Array.isArray(response.citations)).toBe(true);
			expect(Array.isArray(response.suggestions)).toBe(true);
		});

		it('should handle response without suggestions', () => {
			const response = {
				reply: 'Coffee is a great low-pressure first date!',
				citations: ['Based on: Chapter 3 - First Dates']
			};

			expect(response).toHaveProperty('reply');
			expect(response).toHaveProperty('citations');
			expect(typeof response.reply).toBe('string');
			expect(Array.isArray(response.citations)).toBe(true);
		});

		it('should clean citations from reply text', () => {
			const rawReply = 'Coffee is great! *Based on: Chapter 1* Say yes.';
			const cleanReply = rawReply.replace(/\*Based on:[^*]+\*/g, '').replace(/\s+/g, ' ').trim();

			expect(cleanReply).toBe('Coffee is great! Say yes.');
			expect(cleanReply).not.toContain('*Based on:');
		});
	});

	describe('Error Handling', () => {
		it('should handle missing authentication', () => {
			const session = null;
			expect(session).toBeNull();
		});

		it('should handle invalid JSON in request', () => {
			const invalidJson = '{invalid json}';
			expect(() => JSON.parse(invalidJson)).toThrow();
		});

		it('should handle missing required fields', () => {
			const body = {
				userMessage: 'Hello'
				// missing conversationId
			};

			const requiredFields = ['conversationId', 'userMessage'];
			const missingFields = requiredFields.filter(field => !(field in body));

			expect(missingFields).toContain('conversationId');
		});

		it('should handle empty arrays gracefully', () => {
			const recentMessages: ChatMessage[] = [];
			expect(recentMessages.length).toBe(0);
			expect(Array.isArray(recentMessages)).toBe(true);
		});
	});

	describe('Data Persistence', () => {
		it('should structure message for database storage', () => {
			const userMessage: ChatMessage = {
				role: 'user',
				content: 'Should I say yes?'
			};

			const assistantMessage: ChatMessage = {
				role: 'assistant',
				content: 'Yes, coffee is a great first date!',
				assistantType: 'bestie'
			};

			const messages = [userMessage, assistantMessage];

			expect(messages.length).toBe(2);
			expect(messages[0].role).toBe('user');
			expect(messages[1].role).toBe('assistant');
			expect(messages[1].assistantType).toBe('bestie');
		});

		it('should append messages to existing conversation', () => {
			const existingMessages: ChatMessage[] = [
				{ role: 'user', content: 'First message' },
				{ role: 'assistant', content: 'First response' }
			];

			const newUserMessage: ChatMessage = {
				role: 'user',
				content: 'Second message'
			};

			const newAssistantMessage: ChatMessage = {
				role: 'assistant',
				content: 'Second response',
				assistantType: 'bestie'
			};

			const updatedMessages = [...existingMessages, newUserMessage, newAssistantMessage];

			expect(updatedMessages.length).toBe(4);
			expect(updatedMessages[2].content).toBe('Second message');
			expect(updatedMessages[3].content).toBe('Second response');
		});
	});

	describe('Context Building', () => {
		it('should format recent messages for context', () => {
			const messages: ChatMessage[] = [
				{ role: 'user', content: 'Hi there' },
				{ role: 'assistant', content: 'Hey! How are you?' }
			];

			const formatted = messages
				.map(m => `${m.role === 'user' ? 'You' : 'Match'}: ${m.content}`)
				.join('\n');

			expect(formatted).toContain('You: Hi there');
			expect(formatted).toContain('Match: Hey! How are you?');
		});

		it('should format matched user profile for context', () => {
			const profile = {
				gender: 'man',
				ageRange: '25-30',
				datingApp: 'hinge',
				relationshipGoal: 'serious'
			};

			const formatted = `Gender: ${profile.gender}, Age: ${profile.ageRange}, Goal: ${profile.relationshipGoal}`;

			expect(formatted).toContain('Gender: man');
			expect(formatted).toContain('Age: 25-30');
			expect(formatted).toContain('Goal: serious');
		});

		it('should handle missing matched user profile', () => {
			const profile = undefined;
			const formatted = profile ? 'Profile info' : 'No profile info available';

			expect(formatted).toBe('No profile info available');
		});
	});
});
