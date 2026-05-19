export type Gender = 'man' | 'woman' | 'prefer_not_to_say';
export type RelationshipGoal = 'casual' | 'serious' | 'not_sure';
export type DatingApp = 'tinder' | 'bumble' | 'hinge' | 'other';
export type ReplyTone = 'playful' | 'warm' | 'direct';
export type FemaleProfileStage = 'profile' | 'fantasy' | 'review';
export type CommunicationStyle = 'playful' | 'genuine' | 'direct';
export type PersonalityVibe = 'ambitious' | 'chill' | 'adventurous';
export type MattersMost = 'looks' | 'humor' | 'compatibility';
export type PhotoRole = 'main' | 'lifestyle' | 'hobby' | 'group' | 'close-up';
export type LocationVibe = 'city' | 'suburb' | 'small-town';
export type EducationLevel = 'high-school' | 'some-college' | 'bachelors' | 'advanced';

export interface UserProfile {
	gender: Gender;
	ageRange: string;
	datingApp: DatingApp;
	relationshipGoal: RelationshipGoal;
	// Male profile vibe quiz answers
	communicationStyle?: CommunicationStyle;
	personalityVibe?: PersonalityVibe;
	mattersMost?: MattersMost;
}

export interface FemalePhotoAsset {
	id: string;
	name: string;
	url: string;
	storagePath?: string | null;
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

export interface MaleProfilePhoto {
	id: string;
	name: string;
	url: string;
	storagePath?: string | null;
	role: PhotoRole;
	caption: string;
	uploadedAt: number;
}

export interface MaleProfileIntake {
	sessionId: string;
	photos: MaleProfilePhoto[];
	aboutYou: string;
	lookingFor: string;
	dealbreakers: string;
	height?: string;
	ageRange?: string;
	locationVibe?: LocationVibe;
	educationLevel?: EducationLevel;
	collectedAt: number;
	updatedAt: number;
}

export interface MaleProfile {
	headline: string;
	elevatorPitch: string;
	firstDateVibe: string;
	redFlagsAvoided: string[];
	compatibilitySignals: string[];
	conversationStarters: string[];
	whyThisProfile: string;
	citations: string[];
	generatedAt: number;
	feedback?: 'up' | 'down' | null;
}

export interface ProfileChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	internalProfileState?: Partial<MaleProfile>;
}

export interface ApiError {
	error: string;
}

export type AssistantType = 'bestie' | 'wingman';

export interface AIAssistantMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	citations?: string[];
}

export interface AIAssistantConversation {
	id: string;
	userId: string;
	matchConversationId: string;
	assistantType: AssistantType;
	messages: AIAssistantMessage[];
	createdAt: number;
	updatedAt: number;
}

export interface AIAssistantRequest {
	conversationId: string;
	assistantType: AssistantType;
	messages: Array<{ role: 'user' | 'assistant'; content: string }>;
	matchContext?: {
		matchedUserProfile?: Partial<UserProfile>;
		recentMessages?: ChatMessage[];
	};
}

export interface AIAssistantResponse {
	reply: string;
	citations: string[];
	suggestions?: string[];
}
