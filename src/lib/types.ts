export type Gender = 'man' | 'woman' | 'prefer_not_to_say';
export type RelationshipGoal = 'casual' | 'serious' | 'not_sure';
export type DatingApp = 'tinder' | 'bumble' | 'hinge' | 'other';
export type ReplyTone = 'playful' | 'warm' | 'direct';
export type FemaleProfileStage = 'profile' | 'fantasy' | 'review';

export interface UserProfile {
	gender: Gender;
	ageRange: string;
	datingApp: DatingApp;
	relationshipGoal: RelationshipGoal;
}

export interface FemalePhotoAsset {
	id: string;
	name: string;
	url: string;
	storyRole: 'lead' | 'warmth' | 'lifestyle' | 'conversation' | 'social';
	note: string;
}

export interface FemaleJourneyAnswer {
	id: string;
	prompt: string;
	answer: string;
	category: 'self' | 'photos' | 'fantasy' | 'boundaries' | 'lifestyle';
}

export interface FemalePreferenceModel {
	emotionalSignals: string[];
	lifestyleSignals: string[];
	maturitySignals: string[];
	boundaries: string[];
	dealbreakers: string[];
	privateCompatibilityNotes: string[];
	sensitiveTranslations: Array<{
		raw: string;
		translated: string;
	}>;
}

export interface FemaleGeneratedProfile {
	headline: string;
	publicIntro: string;
	photoStory: string[];
	whatSheValues: string[];
	conversationHooks: string[];
	privateMatchBrief: string;
	compatibilitySignals: string[];
	approvedForMatching: boolean;
	updatedAt: number;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	citations?: string[];
	timestamp: number;
	feedback?: 'up' | 'down' | null;
}

export interface ProfileFeedback {
	bio: FeedbackSection;
	photos: FeedbackSection;
	prompts: FeedbackSection;
	openingStrategy: FeedbackSection;
	overallTakeaway: string;
}

export interface FeedbackSection {
	title: string;
	points: FeedbackPoint[];
}

export interface FeedbackPoint {
	observation: string;
	suggestion: string;
	citation?: string;
}

export interface ConversationAnalysis {
	whatIsWorking: string[];
	whatNeedsWork: string[];
	patterns: string[];
	nextMove: string;
	citations: string[];
}

export interface ReplyOption {
	tone: ReplyTone;
	message: string;
	why: string;
	citation?: string;
	feedback?: 'up' | 'down' | null;
}

export interface ApiError {
	error: string;
}
