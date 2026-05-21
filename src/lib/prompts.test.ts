import { describe, it, expect } from 'vitest';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanSystemPrompt,
	buildAIAssistantContextPrompt,
} from './prompts';
import type { UserProfile } from './types';

// ============================================================================
// AI BESTIE SYSTEM PROMPT TESTS
// ============================================================================

describe('buildAIBestieSystemPrompt', () => {
	const mockProfile: UserProfile = {
		id: 'user-1',
		gender: 'woman',
		ageRange: '25-30',
		datingApp: 'hinge',
		relationshipGoal: 'serious',
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockMatchedProfile: Partial<UserProfile> = {
		gender: 'man',
		ageRange: '28-32',
		datingApp: 'hinge',
		relationshipGoal: 'serious',
	};

	const mockPreferences = {
		emotionalSignals: ['Asks about my day', 'Shows vulnerability'],
		lifestyleSignals: ['Active and outdoorsy', 'Ambitious about career'],
		boundaries: ['No excessive drinking', 'Respectful of my time'],
		dealbreakers: ['Disrespectful to service workers', 'Still hung up on ex'],
	};

	const bookContext = 'Chapter 1: Understanding Dating Dynamics\nKey principles...';

	it('should include AI Bestie role definition', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('AI Bestie');
		expect(prompt).toContain('warm, supportive dating coach for women');
	});

	it('should include book context', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain(bookContext);
		expect(prompt).toContain('PRIMARY knowledge source');
	});

	it('should include user profile context', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('User context:');
		expect(prompt).toContain('woman');
		expect(prompt).toContain('25-30');
		expect(prompt).toContain('hinge');
		expect(prompt).toContain('serious');
	});

	it('should include matched user profile context when provided', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext, mockMatchedProfile);
		expect(prompt).toContain('Matched user context:');
		expect(prompt).toContain('man');
		expect(prompt).toContain('28-32');
	});

	it('should not include matched user profile context when not provided', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).not.toContain('Matched user context:');
	});

	it('should include preferences when provided', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext, undefined, mockPreferences);
		expect(prompt).toContain('Her preferences:');
		expect(prompt).toContain('Emotional signals she values:');
		expect(prompt).toContain('Asks about my day');
		expect(prompt).toContain('Lifestyle signals:');
		expect(prompt).toContain('Active and outdoorsy');
		expect(prompt).toContain('Boundaries:');
		expect(prompt).toContain('No excessive drinking');
		expect(prompt).toContain('Dealbreakers:');
		expect(prompt).toContain('Disrespectful to service workers');
	});

	it('should not include preferences section when not provided', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).not.toContain('Her preferences:');
	});

	it('should include behavior rules', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('Rules:');
		expect(prompt).toContain('Ground advice in the book');
		expect(prompt).toContain('encouraging and supportive');
		expect(prompt).toContain('citation');
		expect(prompt).toContain('safety, boundaries, and authentic self-expression');
	});

	it('should include role description', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('trusted friend who knows dating strategy');
		expect(prompt).toContain('Help her craft responses');
		expect(prompt).toContain('Assess compatibility based on her preferences');
	});

	it('should handle null profile gracefully', () => {
		const prompt = buildAIBestieSystemPrompt(null, bookContext);
		expect(prompt).toContain('AI Bestie');
		expect(prompt).toContain('warm, supportive dating coach for women');
		expect(prompt).not.toContain('User context:');
	});

	it('should handle empty preferences arrays', () => {
		const emptyPreferences = {
			emotionalSignals: [],
			lifestyleSignals: [],
			boundaries: [],
			dealbreakers: [],
		};
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext, undefined, emptyPreferences);
		expect(prompt).toContain('Her preferences:');
		// Should not include empty arrays
		expect(prompt).not.toContain('Emotional signals she values: ');
	});

	it('should format preferences correctly with multiple items', () => {
		const prompt = buildAIBestieSystemPrompt(mockProfile, bookContext, undefined, mockPreferences);
		expect(prompt).toContain('Asks about my day, Shows vulnerability');
		expect(prompt).toContain('Active and outdoorsy, Ambitious about career');
	});
});

// ============================================================================
// AI WINGMAN SYSTEM PROMPT TESTS
// ============================================================================

describe('buildAIWingmanSystemPrompt', () => {
	const mockProfile: UserProfile = {
		id: 'user-2',
		gender: 'man',
		ageRange: '28-32',
		datingApp: 'bumble',
		relationshipGoal: 'serious',
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockMatchedProfile: Partial<UserProfile> = {
		gender: 'woman',
		ageRange: '25-28',
		datingApp: 'bumble',
		relationshipGoal: 'serious',
	};

	const mockPersonality = {
		communicationStyle: 'direct',
		personalityVibe: 'ambitious',
		mattersMost: 'humor',
		values: ['Authenticity', 'Growth mindset', 'Loyalty'],
	};

	const bookContext = 'Chapter 2: Building Genuine Connection\nKey principles...';

	it('should include AI Wingman role definition', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('AI Wingman');
		expect(prompt).toContain('confident, practical dating coach for men');
	});

	it('should include book context', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain(bookContext);
		expect(prompt).toContain('PRIMARY knowledge source');
	});

	it('should include user profile context', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('User context:');
		expect(prompt).toContain('man');
		expect(prompt).toContain('28-32');
		expect(prompt).toContain('bumble');
		expect(prompt).toContain('serious');
	});

	it('should include personality when provided', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext, undefined, mockPersonality);
		expect(prompt).toContain('His personality:');
		expect(prompt).toContain('Communication style: direct');
		expect(prompt).toContain('Personality vibe: ambitious');
		expect(prompt).toContain('What matters most: humor');
		expect(prompt).toContain('Core values: Authenticity, Growth mindset, Loyalty');
	});

	it('should not include personality section when not provided', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).not.toContain('His personality:');
	});

	it('should include matched user profile context when provided', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext, mockMatchedProfile);
		expect(prompt).toContain('Matched user context:');
		expect(prompt).toContain('woman');
		expect(prompt).toContain('25-28');
	});

	it('should not include matched user profile context when not provided', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).not.toContain('Matched user context:');
	});

	it('should include behavior rules', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('Rules:');
		expect(prompt).toContain('Ground advice in the book');
		expect(prompt).toContain('encouraging and motivating');
		expect(prompt).toContain('citation');
		expect(prompt).toContain('authenticity, genuine connection, and respectful interaction');
		expect(prompt).toContain('no pickup artist energy');
	});

	it('should include role description', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext);
		expect(prompt).toContain('trusted wingman who knows dating strategy');
		expect(prompt).toContain('Help him craft responses');
		expect(prompt).toContain('build genuine connection');
		expect(prompt).toContain('move from messaging to meeting');
	});

	it('should handle null profile gracefully', () => {
		const prompt = buildAIWingmanSystemPrompt(null, bookContext);
		expect(prompt).toContain('AI Wingman');
		expect(prompt).toContain('confident, practical dating coach for men');
		expect(prompt).not.toContain('User context:');
	});

	it('should handle empty personality values', () => {
		const emptyPersonality = {
			communicationStyle: 'direct',
			personalityVibe: 'ambitious',
			mattersMost: 'humor',
			values: [],
		};
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext, undefined, emptyPersonality);
		expect(prompt).toContain('His personality:');
		expect(prompt).toContain('Communication style: direct');
		// Should not include empty values array
		expect(prompt).not.toContain('Core values: ');
	});

	it('should format personality correctly with multiple values', () => {
		const prompt = buildAIWingmanSystemPrompt(mockProfile, bookContext, undefined, mockPersonality);
		expect(prompt).toContain('Authenticity, Growth mindset, Loyalty');
	});
});

// ============================================================================
// AI ASSISTANT CONTEXT PROMPT TESTS
// ============================================================================

describe('buildAIAssistantContextPrompt', () => {
	const recentMessages = `User: Hey, how are you?
Match: I'm doing great! How about you?
User: Pretty good, just finished work`;

	const matchedUserInfo = `Name: Sarah
Age: 26
Bio: Love hiking and coffee
Relationship goal: Serious`;

	it('should include context for bestie assistant', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', recentMessages, matchedUserInfo);
		expect(prompt).toContain('Context for her current conversation:');
		expect(prompt).toContain('Recent messages:');
		expect(prompt).toContain('Matched user info:');
	});

	it('should include context for wingman assistant', () => {
		const prompt = buildAIAssistantContextPrompt('wingman', recentMessages, matchedUserInfo);
		expect(prompt).toContain('Context for his current conversation:');
		expect(prompt).toContain('Recent messages:');
		expect(prompt).toContain('Matched user info:');
	});

	it('should include recent messages', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', recentMessages, matchedUserInfo);
		expect(prompt).toContain(recentMessages);
	});

	it('should include matched user info', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', recentMessages, matchedUserInfo);
		expect(prompt).toContain(matchedUserInfo);
	});

	it('should include instruction to use context', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', recentMessages, matchedUserInfo);
		expect(prompt).toContain('Use this context to provide relevant, timely advice');
	});

	it('should handle empty messages', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', '', matchedUserInfo);
		expect(prompt).toContain('Context for her current conversation:');
		expect(prompt).toContain('Recent messages:');
	});

	it('should handle empty matched user info', () => {
		const prompt = buildAIAssistantContextPrompt('bestie', recentMessages, '');
		expect(prompt).toContain('Context for her current conversation:');
		expect(prompt).toContain('Matched user info:');
	});
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('System Prompt Integration', () => {
	const bookContext = 'Chapter 1: Understanding Dating Dynamics\nKey principles...';

	it('should generate complete bestie prompt with all parameters', () => {
		const profile: UserProfile = {
			id: 'user-1',
			gender: 'woman',
			ageRange: '25-30',
			datingApp: 'hinge',
			relationshipGoal: 'serious',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const matchedProfile: Partial<UserProfile> = {
			gender: 'man',
			ageRange: '28-32',
			datingApp: 'hinge',
			relationshipGoal: 'serious',
		};

		const preferences = {
			emotionalSignals: ['Asks about my day'],
			lifestyleSignals: ['Active and outdoorsy'],
			boundaries: ['No excessive drinking'],
			dealbreakers: ['Disrespectful to service workers'],
		};

		const prompt = buildAIBestieSystemPrompt(profile, bookContext, matchedProfile, preferences);

		// Verify all components are present
		expect(prompt).toContain('AI Bestie');
		expect(prompt).toContain(bookContext);
		expect(prompt).toContain('woman');
		expect(prompt).toContain('man');
		expect(prompt).toContain('Her preferences:');
		expect(prompt).toContain('Rules:');
	});

	it('should generate complete wingman prompt with all parameters', () => {
		const profile: UserProfile = {
			id: 'user-2',
			gender: 'man',
			ageRange: '28-32',
			datingApp: 'bumble',
			relationshipGoal: 'serious',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const matchedProfile: Partial<UserProfile> = {
			gender: 'woman',
			ageRange: '25-28',
			datingApp: 'bumble',
			relationshipGoal: 'serious',
		};

		const personality = {
			communicationStyle: 'direct',
			personalityVibe: 'ambitious',
			mattersMost: 'humor',
			values: ['Authenticity', 'Growth mindset'],
		};

		const prompt = buildAIWingmanSystemPrompt(profile, bookContext, matchedProfile, personality);

		// Verify all components are present
		expect(prompt).toContain('AI Wingman');
		expect(prompt).toContain(bookContext);
		expect(prompt).toContain('man');
		expect(prompt).toContain('woman');
		expect(prompt).toContain('His personality:');
		expect(prompt).toContain('Rules:');
	});

	it('should produce different prompts for bestie and wingman', () => {
		const profile: UserProfile = {
			id: 'user-1',
			gender: 'woman',
			ageRange: '25-30',
			datingApp: 'hinge',
			relationshipGoal: 'serious',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const bestieMaleProfile: UserProfile = {
			id: 'user-2',
			gender: 'man',
			ageRange: '28-32',
			datingApp: 'hinge',
			relationshipGoal: 'serious',
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const bestiePrompt = buildAIBestieSystemPrompt(profile, bookContext);
		const wingmanPrompt = buildAIWingmanSystemPrompt(bestieMaleProfile, bookContext);

		expect(bestiePrompt).not.toEqual(wingmanPrompt);
		expect(bestiePrompt).toContain('AI Bestie');
		expect(wingmanPrompt).toContain('AI Wingman');
	});
});
