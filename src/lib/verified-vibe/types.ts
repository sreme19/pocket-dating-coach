// Verified Vibe — TypeScript Types

export type Gender = 'man' | 'woman' | 'prefer_not_to_say';
export type Archetype = 'casual_man' | 'marriage_minded_man' | 'spoilt_woman' | 'safety_first_woman';
export type VerificationStep = 'id' | 'liveness' | 'photos' | 'spending_or_qa';
export type VerificationStatus = 'pending' | 'completed' | 'failed';
export type MatchStatus = 'pending' | 'mutual' | 'rejected';
export type Phase = 'gate' | 'home' | 'verify' | 'verification' | 'app';
export type Tab = 'discover' | 'trust' | 'chat';

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
}

export interface DiscoveryProfile extends VerifiedVibeUser {
  distance: string;
  verified: string[];
  trustScore: number;
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
