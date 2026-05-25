// Verified Vibe — TypeScript Types

export type Gender = 'man' | 'woman' | 'prefer_not_to_say';
export type Archetype =
  // Male archetypes
  | 'casual_generous_man'
  | 'hopeless_romantic_man'
  | 'rebound_healing_man'
  | 'untouched_heart_man'
  | 'forever_focused_man'
  | 'traditional_matrimony_man'
  // Female archetypes
  | 'spoiled_casual_woman'
  | 'hopeless_romantic_woman'
  | 'rebound_healing_woman'
  | 'untouched_heart_woman'
  | 'forever_focused_woman'
  | 'traditional_matrimony_woman';
export type VerificationStep = 'id' | 'liveness' | 'photos' | 'spending_or_qa';
export type VerificationStatus = 'pending' | 'completed' | 'failed';
export type MatchStatus = 'pending' | 'mutual' | 'rejected';
export type Phase = 'gate' | 'home' | 'verify' | 'verification' | 'app';
export type Tab = 'discover' | 'trust' | 'chat' | 'profile';

export interface VerifiedVibeUser {
  id: string;
  gender: Gender;
  archetype: Archetype;
  firstName: string;
  age: number;
  city: string;
  avatar: string | null;
  about: string | null;
  looking: string | null;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArchetypeDefinition {
  id: Archetype;
  gender: Gender;
  emoji: string;
  name: string;
  tag: string;
  longTag: string;
  matchTraits: TraitItem[];
  avoidTraits: TraitItem[];
  brings: string[];
  needs: string[];
  timeMins: number;
}

export interface TraitItem {
  lead?: boolean;
  tier?: 'best' | 'good';
  label: string;
}

export interface VerificationRecord {
  id: string;
  userId: string;
  step: VerificationStep;
  status: VerificationStatus;
  data: Record<string, any>;
  completedAt: Date | null;
  createdAt: Date;
}

export interface TrustScore {
  total: number;
  identity: {
    score: number;
    max: number;
    items: TrustItem[];
  };
  lifestyle: {
    score: number;
    max: number;
    items: TrustItem[];
  };
  intent: {
    score: number;
    max: number;
    items: TrustItem[];
  };
}

export interface TrustItem {
  label: string;
  ok: boolean;
  note?: string;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  status: MatchStatus;
  createdAt: Date;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  imageUrl?: string;
  isDeleted?: boolean;
  editedAt?: Date;
  readAt?: Date;
  reactions?: MessageReaction[];
  assistantType?: 'bestie' | 'wingman' | 'coach';
  citations?: string[];
}

export interface MessageReaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface DiscoveryProfile extends VerifiedVibeUser {
  distance: string;
  verified: string[];
  trustScore: number;
  photos?: string[]; // Additional photos for carousel (avatar is first photo)
  isSeed?: boolean; // true for demo/seed profiles shown when real pool is empty
}

export type NotificationType = 'match' | 'message' | 'verification' | 'system';
export type NotificationStatus = 'unread' | 'read';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  body: string;
  data: {
    matchId?: string;
    userId?: string;
    userPhoto?: string;
    userName?: string;
    actionUrl?: string;
  };
  createdAt: Date;
  readAt?: Date;
}

export type ReportReason = 'inappropriate_content' | 'harassment' | 'fake_profile' | 'scam' | 'other';

export interface BlockedUser {
  id: string;
  userId: string;
  blockedUserId: string;
  createdAt: Date;
}

export interface Report {
  id: string;
  userId: string;
  reportedUserId: string;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
  reviewedAt?: Date;
}

export interface UIState {
  currentPhase: Phase;
  currentTab: Tab;
  loading: boolean;
  error: string | null;
}

// API Request/Response Types
export interface RegisterRequest {
  gender: Gender;
  archetype: Archetype;
  firstName: string;
  age: number;
  city: string;
}

export interface VerifyStepRequest {
  step: VerificationStep;
  data: Record<string, any>;
}

export interface VerifyStepResponse {
  status: VerificationStatus;
  data: Record<string, any>;
  trustPoints: number;
}

export interface LikeRequest {
  profileId: string;
}

export interface LikeResponse {
  matched: boolean;
  matchId?: string;
}

export interface MessageRequest {
  matchId: string;
  content: string;
}

export interface DiscoverResponse {
  profiles: DiscoveryProfile[];
}

// Claude Integration Types
export interface IDExtractionResult {
  idNumber: string;
  idName: string;
  idDOB: string;
  expirationDate?: string;
}

export interface LivenessCheckResult {
  confidence: number;
  match: boolean;
}

export interface PhotoConsistencyResult {
  confidence: number;
  consistent: boolean;
}
