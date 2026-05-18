// Verified Vibe — Utility Functions

import type {
  TrustScore,
  TrustItem,
  VerificationRecord,
  VerificationStatus,
  Archetype,
  ArchetypeDefinition,
  VerifiedVibeUser,
} from './types';
import { ARCHETYPES } from './constants';

// ============================================================================
// TRUST SCORE CALCULATION
// ============================================================================

/**
 * Calculate overall trust score based on verification records
 * Identity: 30 pts max (ID 10 + Liveness 10 + Face match 10)
 * Lifestyle: 45 pts max (Photos 15 + Consistency 15 + Grooming 15)
 * Intent: 20 pts max (Q&A 10 + Archetype clarity 10)
 * Total: 0-100 pts
 */
export function calculateTrustScore(verificationRecords: VerificationRecord[]): TrustScore {
  const identity = calculateIdentityScore(verificationRecords);
  const lifestyle = calculateLifestyleScore(verificationRecords);
  const intent = calculateIntentScore(verificationRecords);

  const total = identity.score + lifestyle.score + intent.score;

  return {
    total: Math.min(100, total),
    identity,
    lifestyle,
    intent,
  };
}

/**
 * Get trust score range and color based on score value
 */
export function getTrustScoreRange(score: number): {
  range: 'low' | 'medium' | 'high' | 'excellent';
  color: string;
  label: string;
} {
  if (score >= 80) {
    return { range: 'excellent', color: 'emerald', label: 'Excellent' };
  }
  if (score >= 60) {
    return { range: 'high', color: 'lime', label: 'High' };
  }
  if (score >= 40) {
    return { range: 'medium', color: 'amber', label: 'Medium' };
  }
  return { range: 'low', color: 'red', label: 'Low' };
}

function calculateIdentityScore(verificationRecords: VerificationRecord[]): {
  score: number;
  max: number;
  items: TrustItem[];
} {
  const items: TrustItem[] = [];
  let score = 0;

  // ID verification (10 pts)
  const idRecord = verificationRecords.find((r) => r.step === 'id' && r.status === 'completed');
  if (idRecord) {
    items.push({ label: 'Government ID verified', ok: true });
    score += 10;
  } else {
    items.push({ label: 'Government ID verified', ok: false });
  }

  // Liveness check (10 pts)
  const livenessRecord = verificationRecords.find(
    (r) => r.step === 'liveness' && r.status === 'completed'
  );
  if (livenessRecord) {
    items.push({ label: 'Liveness check passed', ok: true });
    score += 10;
  } else {
    items.push({ label: 'Liveness check passed', ok: false });
  }

  // Face match (10 pts)
  if (livenessRecord?.data?.confidence >= 80) {
    items.push({ label: 'Face matches ID', ok: true });
    score += 10;
  } else {
    items.push({ label: 'Face matches ID', ok: false });
  }

  return { score, max: 30, items };
}

function calculateLifestyleScore(verificationRecords: VerificationRecord[]): {
  score: number;
  max: number;
  items: TrustItem[];
} {
  const items: TrustItem[] = [];
  let score = 0;

  // Photos verification (15 pts)
  const photosRecord = verificationRecords.find(
    (r) => r.step === 'photos' && r.status === 'completed'
  );
  if (photosRecord) {
    items.push({ label: 'Photos verified', ok: true });
    score += 15;
  } else {
    items.push({ label: 'Photos verified', ok: false });
  }

  // Photo consistency (15 pts)
  if (photosRecord?.data?.consistent) {
    items.push({ label: 'Photos are consistent', ok: true });
    score += 15;
  } else {
    items.push({ label: 'Photos are consistent', ok: false });
  }

  // Grooming/presentation (15 pts) - based on photo quality
  if (photosRecord?.data?.quality === 'high') {
    items.push({ label: 'High-quality presentation', ok: true });
    score += 15;
  } else {
    items.push({ label: 'High-quality presentation', ok: false });
  }

  return { score, max: 45, items };
}

function calculateIntentScore(verificationRecords: VerificationRecord[]): {
  score: number;
  max: number;
  items: TrustItem[];
} {
  const items: TrustItem[] = [];
  let score = 0;

  // Q&A or Spending verification (10 pts)
  const qaRecord = verificationRecords.find(
    (r) => r.step === 'spending_or_qa' && r.status === 'completed'
  );
  if (qaRecord) {
    items.push({ label: 'Intent verified', ok: true });
    score += 10;
  } else {
    items.push({ label: 'Intent verified', ok: false });
  }

  // Archetype clarity (10 pts) - assume clear if they completed verification
  if (qaRecord) {
    items.push({ label: 'Clear dating intent', ok: true });
    score += 10;
  } else {
    items.push({ label: 'Clear dating intent', ok: false });
  }

  return { score, max: 20, items };
}

// ============================================================================
// VERIFICATION PROGRESS
// ============================================================================

/**
 * Calculate verification progress as percentage (0-100)
 */
export function calculateVerificationProgress(verificationRecords: VerificationRecord[]): number {
  const completedSteps = verificationRecords.filter((r) => r.status === 'completed').length;
  const totalSteps = 4; // id, liveness, photos, spending_or_qa
  return Math.round((completedSteps / totalSteps) * 100);
}

/**
 * Get verification status label and description
 */
export function getVerificationStatus(
  verificationRecords: VerificationRecord[]
): {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  label: string;
  description: string;
  progress: number;
} {
  const progress = calculateVerificationProgress(verificationRecords);
  const hasFailures = verificationRecords.some((r) => r.status === 'failed');

  if (progress === 100) {
    return {
      status: 'completed',
      label: 'Verification Complete',
      description: 'All verification steps completed successfully',
      progress: 100,
    };
  }

  if (hasFailures) {
    return {
      status: 'failed',
      label: 'Verification Failed',
      description: 'Some verification steps failed. Please retry.',
      progress,
    };
  }

  if (progress > 0) {
    return {
      status: 'in_progress',
      label: 'Verification In Progress',
      description: `${progress}% complete`,
      progress,
    };
  }

  return {
    status: 'not_started',
    label: 'Verification Not Started',
    description: 'Start your verification to build trust',
    progress: 0,
  };
}

// ============================================================================
// ARCHETYPE MATCHING
// ============================================================================

/**
 * Get matched archetypes based on user's archetype
 */
export function getMatchedArchetypes(userArchetype: Archetype): ArchetypeDefinition[] {
  // Simple matching: men match with women and vice versa
  const userDef = ARCHETYPES[userArchetype];
  if (!userDef) return [];

  const oppositeGender = userDef.gender === 'man' ? 'woman' : 'man';
  return Object.values(ARCHETYPES).filter((a) => a.gender === oppositeGender);
}

/**
 * Check if two archetypes are valid matches
 */
export function isValidMatch(archetype1: Archetype, archetype2: Archetype): boolean {
  const def1 = ARCHETYPES[archetype1];
  const def2 = ARCHETYPES[archetype2];

  if (!def1 || !def2) return false;

  // Valid match if different genders
  return def1.gender !== def2.gender;
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format trust score for display (e.g., "81/100")
 */
export function formatTrustScore(score: number): string {
  return `${Math.round(score)}/100`;
}

/**
 * Format distance for display (e.g., "2.5 mi" or "4 km")
 */
export function formatDistance(
  distanceInMiles: number,
  unit: 'mi' | 'km' = 'mi'
): string {
  if (unit === 'km') {
    const km = distanceInMiles * 1.60934;
    return `${km.toFixed(1)} km`;
  }
  return `${distanceInMiles.toFixed(1)} mi`;
}

/**
 * Format time duration for display (e.g., "~10 minutes")
 */
export function formatTime(minutes: number): string {
  if (minutes < 1) return '< 1 minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `~${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return `${hours}h ${mins}m`;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate age (must be 18+)
 */
export function validateAge(age: number): boolean {
  return age >= 18 && age <= 120;
}

/**
 * Validate phone number (basic validation)
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  // Check if it's 10+ digits
  return /^\d{10,}$/.test(cleaned);
}

// ============================================================================
// DATE/TIME UTILITIES
// ============================================================================

/**
 * Format date for display (e.g., "May 17, 2026")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 */
export function getTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(d);
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dob: Date | string): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// ============================================================================
// LOCALSTORAGE HELPERS
// ============================================================================

/**
 * Save data to localStorage with optional expiration
 */
export function saveToLocalStorage(
  key: string,
  value: any,
  expirationMinutes?: number
): void {
  try {
    const data = {
      value,
      timestamp: Date.now(),
      expiration: expirationMinutes ? Date.now() + expirationMinutes * 60 * 1000 : null,
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

/**
 * Get data from localStorage with expiration check
 */
export function getFromLocalStorage<T = any>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const data = JSON.parse(item);

    // Check if expired
    if (data.expiration && Date.now() > data.expiration) {
      localStorage.removeItem(key);
      return null;
    }

    return data.value as T;
  } catch (error) {
    console.error(`Failed to get from localStorage: ${key}`, error);
    return null;
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove from localStorage: ${key}`, error);
  }
}

/**
 * Clear all Verified Vibe data from localStorage
 */
export function clearVerifiedVibeLocalStorage(): void {
  const keys = [
    'verified-vibe-user',
    'verified-vibe-matches',
    'verified-vibe-messages',
    'verified-vibe-verification',
  ];

  keys.forEach((key) => removeFromLocalStorage(key));
}

/**
 * Helper function to calculate trust score from verification records
 * Can be used in components or stores to update trust score after verification
 */
export function calculateTrustScoreFromRecords(verificationRecords: VerificationRecord[]): TrustScore {
  return calculateTrustScore(verificationRecords);
}
