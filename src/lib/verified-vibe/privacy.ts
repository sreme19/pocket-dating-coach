/**
 * Privacy & Data Management Utilities
 * Handles GDPR compliance, data export, and privacy settings
 */

export type ProfileVisibility = 'verified_only' | 'all_users' | 'hidden';
export type DataRetention = '3_months' | '6_months' | '12_months' | 'indefinite';

export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  allowMessages: boolean;
  allowNotifications: boolean;
  dataRetention: DataRetention;
  analyticsOptIn: boolean;
}

export interface ExportedData {
  profile: Record<string, any>;
  verification: Record<string, any>[];
  matches: Record<string, any>[];
  messages: Record<string, any>[];
  privacySettings: PrivacySettings;
  exportedAt: string;
}

export interface DeletionResult {
  success: boolean;
  message: string;
  deletedAt: string;
  dataRetentionUntil: string;
}

/**
 * Validate privacy settings
 */
export function validatePrivacySettings(settings: Partial<PrivacySettings>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (settings.profileVisibility) {
    const validVisibility: ProfileVisibility[] = ['verified_only', 'all_users', 'hidden'];
    if (!validVisibility.includes(settings.profileVisibility)) {
      errors.push('Invalid profile visibility setting');
    }
  }

  if (settings.dataRetention) {
    const validRetention: DataRetention[] = ['3_months', '6_months', '12_months', 'indefinite'];
    if (!validRetention.includes(settings.dataRetention)) {
      errors.push('Invalid data retention setting');
    }
  }

  if (typeof settings.allowMessages !== 'undefined' && typeof settings.allowMessages !== 'boolean') {
    errors.push('allowMessages must be a boolean');
  }

  if (typeof settings.allowNotifications !== 'undefined' && typeof settings.allowNotifications !== 'boolean') {
    errors.push('allowNotifications must be a boolean');
  }

  if (typeof settings.analyticsOptIn !== 'undefined' && typeof settings.analyticsOptIn !== 'boolean') {
    errors.push('analyticsOptIn must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default privacy settings
 */
export function getDefaultPrivacySettings(): PrivacySettings {
  return {
    profileVisibility: 'verified_only',
    allowMessages: true,
    allowNotifications: true,
    dataRetention: '12_months',
    analyticsOptIn: false
  };
}

/**
 * Calculate data retention expiration date
 */
export function calculateRetentionExpiration(
  createdAt: Date,
  retention: DataRetention
): Date | null {
  if (retention === 'indefinite') {
    return null;
  }

  const date = new Date(createdAt);
  const months = {
    '3_months': 3,
    '6_months': 6,
    '12_months': 12
  };

  const monthsToAdd = months[retention as keyof typeof months];
  date.setMonth(date.getMonth() + monthsToAdd);

  return date;
}

/**
 * Check if data should be retained
 */
export function shouldRetainData(
  createdAt: Date,
  retention: DataRetention,
  currentDate: Date = new Date()
): boolean {
  if (retention === 'indefinite') {
    return true;
  }

  const expirationDate = calculateRetentionExpiration(createdAt, retention);
  if (!expirationDate) {
    return true;
  }

  return currentDate < expirationDate;
}

/**
 * Validate account deletion confirmation
 */
export function validateDeletionConfirmation(confirmation: string): boolean {
  return confirmation === 'DELETE';
}

/**
 * Format exported data for download
 */
export function formatExportedData(data: ExportedData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Generate export filename
 */
export function generateExportFilename(): string {
  const date = new Date().toISOString().split('T')[0];
  return `verified-vibe-data-${date}.json`;
}

/**
 * Check if profile is visible to user
 */
export function isProfileVisible(
  profileVisibility: ProfileVisibility,
  viewerVerified: boolean
): boolean {
  switch (profileVisibility) {
    case 'hidden':
      return false;
    case 'verified_only':
      return viewerVerified;
    case 'all_users':
      return true;
    default:
      return false;
  }
}

/**
 * Get visibility label for display
 */
export function getVisibilityLabel(visibility: ProfileVisibility): string {
  const labels: Record<ProfileVisibility, string> = {
    verified_only: 'Verified users only',
    all_users: 'All users',
    hidden: 'Hidden from discovery'
  };
  return labels[visibility];
}

/**
 * Get retention label for display
 */
export function getRetentionLabel(retention: DataRetention): string {
  const labels: Record<DataRetention, string> = {
    '3_months': '3 months',
    '6_months': '6 months',
    '12_months': '12 months',
    indefinite: 'Keep indefinitely'
  };
  return labels[retention];
}

/**
 * Calculate GDPR compliance status
 */
export function getGDPRComplianceStatus(settings: PrivacySettings): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check if user has opted out of analytics
  if (settings.analyticsOptIn) {
    // This is actually compliant - user has given consent
  }

  // Check if data retention is set
  if (!settings.dataRetention) {
    issues.push('Data retention policy not set');
  }

  // Check if profile visibility is set
  if (!settings.profileVisibility) {
    issues.push('Profile visibility not configured');
  }

  return {
    compliant: issues.length === 0,
    issues
  };
}

/**
 * Generate deletion audit log entry
 */
export function generateDeletionAuditLog(userId: string, reason?: string): {
  userId: string;
  action: string;
  timestamp: string;
  reason?: string;
} {
  return {
    userId,
    action: 'account_deletion',
    timestamp: new Date().toISOString(),
    reason
  };
}

/**
 * Calculate data retention until date (GDPR 30-day requirement)
 */
export function calculateGDPRRetentionUntil(deletedAt: Date = new Date()): Date {
  const retentionUntil = new Date(deletedAt);
  retentionUntil.setDate(retentionUntil.getDate() + 30);
  return retentionUntil;
}

/**
 * Validate exported data structure
 */
export function validateExportedData(data: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const requiredKeys = ['profile', 'verification', 'matches', 'messages', 'privacySettings', 'exportedAt'];

  requiredKeys.forEach(key => {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`);
    }
  });

  if (data.profile && typeof data.profile !== 'object') {
    errors.push('profile must be an object');
  }

  if (data.verification && !Array.isArray(data.verification)) {
    errors.push('verification must be an array');
  }

  if (data.matches && !Array.isArray(data.matches)) {
    errors.push('matches must be an array');
  }

  if (data.messages && !Array.isArray(data.messages)) {
    errors.push('messages must be an array');
  }

  if (data.privacySettings && typeof data.privacySettings !== 'object') {
    errors.push('privacySettings must be an object');
  }

  if (data.exportedAt && !isValidISODate(data.exportedAt)) {
    errors.push('exportedAt must be a valid ISO date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if string is valid ISO date
 */
function isValidISODate(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Get privacy settings summary for user
 */
export function getPrivacySettingsSummary(settings: PrivacySettings): string[] {
  const summary: string[] = [];

  summary.push(`Profile visibility: ${getVisibilityLabel(settings.profileVisibility)}`);
  summary.push(`Messages: ${settings.allowMessages ? 'Allowed' : 'Blocked'}`);
  summary.push(`Notifications: ${settings.allowNotifications ? 'Enabled' : 'Disabled'}`);
  summary.push(`Data retention: ${getRetentionLabel(settings.dataRetention)}`);
  summary.push(`Analytics: ${settings.analyticsOptIn ? 'Opted in' : 'Opted out'}`);

  return summary;
}

/**
 * Anonymize user data for privacy
 */
export function anonymizeUserData(data: any): any {
  return {
    ...data,
    firstName: '[REDACTED]',
    city: '[REDACTED]',
    about: '[REDACTED]',
    looking: '[REDACTED]',
    avatar: null
  };
}

/**
 * Check if user can export data
 */
export function canExportData(userVerified: boolean): boolean {
  return userVerified;
}

/**
 * Check if user can delete account
 */
export function canDeleteAccount(userVerified: boolean): boolean {
  return true; // Any user can delete their account
}
