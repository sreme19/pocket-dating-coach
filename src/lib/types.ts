export type Gender = 'man' | 'woman' | 'prefer_not_to_say';
export type RelationshipGoal = 'casual' | 'serious' | 'not_sure';
export type DatingApp = 'tinder' | 'bumble' | 'hinge' | 'other';
export type ReplyTone = 'playful' | 'warm' | 'direct';

export interface UserProfile {
	gender: Gender;
	ageRange: string;
	datingApp: DatingApp;
	relationshipGoal: RelationshipGoal;
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
