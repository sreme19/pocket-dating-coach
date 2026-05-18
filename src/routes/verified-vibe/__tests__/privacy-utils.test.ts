import { describe, it, expect } from 'vitest';
import {
  validatePrivacySettings,
  getDefaultPrivacySettings,
  calculateRetentionExpiration,
  shouldRetainData,
  validateDeletionConfirmation,
  formatExportedData,
  generateExportFilename,
  isProfileVisible,
  getVisibilityLabel,
  getRetentionLabel,
  getGDPRComplianceStatus,
  generateDeletionAuditLog,
  calculateGDPRRetentionUntil,
  validateExportedData,
  getPrivacySettingsSummary,
  anonymizeUserData,
  canExportData,
  canDeleteAccount
} from '$lib/verified-vibe/privacy';

describe('Privacy Utilities', () => {
  describe('validatePrivacySettings', () => {
    it('should validate correct privacy settings', () => {
      const settings = {
        profileVisibility: 'verified_only' as const,
        allowMessages: true,
        allowNotifications: true,
        dataRetention: '12_months' as const,
        analyticsOptIn: false
      };
      const result = validatePrivacySettings(settings);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid profile visibility', () => {
      const settings = { profileVisibility: 'invalid' as any };
      const result = validatePrivacySettings(settings);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid data retention', () => {
      const settings = { dataRetention: 'invalid' as any };
      const result = validatePrivacySettings(settings);
      expect(result.valid).toBe(false);
    });

    it('should reject non-boolean allowMessages', () => {
      const settings = { allowMessages: 'yes' as any };
      const result = validatePrivacySettings(settings);
      expect(result.valid).toBe(false);
    });

    it('should accept all valid profile visibility options', () => {
      const options = ['verified_only', 'all_users', 'hidden'] as const;
      options.forEach(visibility => {
        const result = validatePrivacySettings({ profileVisibility: visibility });
        expect(result.valid).toBe(true);
      });
    });

    it('should accept all valid data retention options', () => {
      const options = ['3_months', '6_months', '12_months', 'indefinite'] as const;
      options.forEach(retention => {
        const result = validatePrivacySettings({ dataRetention: retention });
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getDefaultPrivacySettings', () => {
    it('should return default settings', () => {
      const defaults = getDefaultPrivacySettings();
      expect(defaults.profileVisibility).toBe('verified_only');
      expect(defaults.allowMessages).toBe(true);
      expect(defaults.allowNotifications).toBe(true);
      expect(defaults.dataRetention).toBe('12_months');
      expect(defaults.analyticsOptIn).toBe(false);
    });

    it('should return new object each time', () => {
      const defaults1 = getDefaultPrivacySettings();
      const defaults2 = getDefaultPrivacySettings();
      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('calculateRetentionExpiration', () => {
    it('should return null for indefinite retention', () => {
      const date = new Date('2024-01-01');
      const expiration = calculateRetentionExpiration(date, 'indefinite');
      expect(expiration).toBeNull();
    });

    it('should calculate 3-month expiration', () => {
      const date = new Date('2024-01-01');
      const expiration = calculateRetentionExpiration(date, '3_months');
      expect(expiration).not.toBeNull();
      expect(expiration!.getMonth()).toBe(3); // April
    });

    it('should calculate 6-month expiration', () => {
      const date = new Date('2024-01-01');
      const expiration = calculateRetentionExpiration(date, '6_months');
      expect(expiration).not.toBeNull();
      expect(expiration!.getMonth()).toBe(6); // July
    });

    it('should calculate 12-month expiration', () => {
      const date = new Date('2024-01-01');
      const expiration = calculateRetentionExpiration(date, '12_months');
      expect(expiration).not.toBeNull();
      expect(expiration!.getFullYear()).toBe(2025);
    });
  });

  describe('shouldRetainData', () => {
    it('should retain indefinite data', () => {
      const createdAt = new Date('2024-01-01');
      const currentDate = new Date('2030-01-01');
      expect(shouldRetainData(createdAt, 'indefinite', currentDate)).toBe(true);
    });

    it('should retain data before expiration', () => {
      const createdAt = new Date('2024-01-01');
      const currentDate = new Date('2024-02-01');
      expect(shouldRetainData(createdAt, '3_months', currentDate)).toBe(true);
    });

    it('should not retain data after expiration', () => {
      const createdAt = new Date('2024-01-01');
      const currentDate = new Date('2024-05-01');
      expect(shouldRetainData(createdAt, '3_months', currentDate)).toBe(false);
    });
  });

  describe('validateDeletionConfirmation', () => {
    it('should accept exact "DELETE" confirmation', () => {
      expect(validateDeletionConfirmation('DELETE')).toBe(true);
    });

    it('should reject lowercase "delete"', () => {
      expect(validateDeletionConfirmation('delete')).toBe(false);
    });

    it('should reject partial confirmation', () => {
      expect(validateDeletionConfirmation('DEL')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateDeletionConfirmation('')).toBe(false);
    });

    it('should reject confirmation with spaces', () => {
      expect(validateDeletionConfirmation('DELETE ')).toBe(false);
      expect(validateDeletionConfirmation(' DELETE')).toBe(false);
    });
  });

  describe('formatExportedData', () => {
    it('should format data as JSON string', () => {
      const data = {
        profile: { id: 'uuid-123' },
        verification: [],
        matches: [],
        messages: [],
        privacySettings: {},
        exportedAt: new Date().toISOString()
      };
      const formatted = formatExportedData(data);
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('"profile"');
    });

    it('should include proper indentation', () => {
      const data = {
        profile: { id: 'uuid-123' },
        verification: [],
        matches: [],
        messages: [],
        privacySettings: {},
        exportedAt: new Date().toISOString()
      };
      const formatted = formatExportedData(data);
      expect(formatted).toContain('\n');
    });

    it('should be valid JSON', () => {
      const data = {
        profile: { id: 'uuid-123' },
        verification: [],
        matches: [],
        messages: [],
        privacySettings: {},
        exportedAt: new Date().toISOString()
      };
      const formatted = formatExportedData(data);
      expect(() => JSON.parse(formatted)).not.toThrow();
    });
  });

  describe('generateExportFilename', () => {
    it('should generate filename with .json extension', () => {
      const filename = generateExportFilename();
      expect(filename).toMatch(/\.json$/);
    });

    it('should include ISO date', () => {
      const filename = generateExportFilename();
      const datePattern = /\d{4}-\d{2}-\d{2}/;
      expect(filename).toMatch(datePattern);
    });

    it('should start with correct prefix', () => {
      const filename = generateExportFilename();
      expect(filename).toMatch(/^verified-vibe-data-/);
    });
  });

  describe('isProfileVisible', () => {
    it('should show profile to verified users when visibility is verified_only', () => {
      expect(isProfileVisible('verified_only', true)).toBe(true);
    });

    it('should hide profile from unverified users when visibility is verified_only', () => {
      expect(isProfileVisible('verified_only', false)).toBe(false);
    });

    it('should show profile to all users when visibility is all_users', () => {
      expect(isProfileVisible('all_users', true)).toBe(true);
      expect(isProfileVisible('all_users', false)).toBe(true);
    });

    it('should hide profile when visibility is hidden', () => {
      expect(isProfileVisible('hidden', true)).toBe(false);
      expect(isProfileVisible('hidden', false)).toBe(false);
    });
  });

  describe('getVisibilityLabel', () => {
    it('should return label for verified_only', () => {
      expect(getVisibilityLabel('verified_only')).toBe('Verified users only');
    });

    it('should return label for all_users', () => {
      expect(getVisibilityLabel('all_users')).toBe('All users');
    });

    it('should return label for hidden', () => {
      expect(getVisibilityLabel('hidden')).toBe('Hidden from discovery');
    });
  });

  describe('getRetentionLabel', () => {
    it('should return label for 3_months', () => {
      expect(getRetentionLabel('3_months')).toBe('3 months');
    });

    it('should return label for 6_months', () => {
      expect(getRetentionLabel('6_months')).toBe('6 months');
    });

    it('should return label for 12_months', () => {
      expect(getRetentionLabel('12_months')).toBe('12 months');
    });

    it('should return label for indefinite', () => {
      expect(getRetentionLabel('indefinite')).toBe('Keep indefinitely');
    });
  });

  describe('getGDPRComplianceStatus', () => {
    it('should be compliant with valid settings', () => {
      const settings = {
        profileVisibility: 'verified_only' as const,
        allowMessages: true,
        allowNotifications: true,
        dataRetention: '12_months' as const,
        analyticsOptIn: false
      };
      const status = getGDPRComplianceStatus(settings);
      expect(status.compliant).toBe(true);
      expect(status.issues).toHaveLength(0);
    });

    it('should report issues for missing settings', () => {
      const settings = {
        profileVisibility: '' as any,
        allowMessages: true,
        allowNotifications: true,
        dataRetention: '' as any,
        analyticsOptIn: false
      };
      const status = getGDPRComplianceStatus(settings);
      expect(status.compliant).toBe(false);
      expect(status.issues.length).toBeGreaterThan(0);
    });
  });

  describe('generateDeletionAuditLog', () => {
    it('should generate audit log entry', () => {
      const log = generateDeletionAuditLog('user-123');
      expect(log.userId).toBe('user-123');
      expect(log.action).toBe('account_deletion');
      expect(log.timestamp).toBeDefined();
    });

    it('should include optional reason', () => {
      const log = generateDeletionAuditLog('user-123', 'User requested deletion');
      expect(log.reason).toBe('User requested deletion');
    });

    it('should have valid ISO timestamp', () => {
      const log = generateDeletionAuditLog('user-123');
      expect(() => new Date(log.timestamp)).not.toThrow();
    });
  });

  describe('calculateGDPRRetentionUntil', () => {
    it('should calculate 30 days from deletion date', () => {
      const deletedAt = new Date('2024-01-01');
      const retentionUntil = calculateGDPRRetentionUntil(deletedAt);
      const diffMs = retentionUntil.getTime() - deletedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('should use current date if not provided', () => {
      const retentionUntil = calculateGDPRRetentionUntil();
      const now = new Date();
      const diffMs = retentionUntil.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });
  });

  describe('validateExportedData', () => {
    it('should validate correct exported data', () => {
      const data = {
        profile: { id: 'uuid-123' },
        verification: [],
        matches: [],
        messages: [],
        privacySettings: {},
        exportedAt: new Date().toISOString()
      };
      const result = validateExportedData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report missing required fields', () => {
      const data = { profile: {} };
      const result = validateExportedData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate array fields', () => {
      const data = {
        profile: {},
        verification: 'not-an-array' as any,
        matches: [],
        messages: [],
        privacySettings: {},
        exportedAt: new Date().toISOString()
      };
      const result = validateExportedData(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('getPrivacySettingsSummary', () => {
    it('should generate summary of privacy settings', () => {
      const settings = {
        profileVisibility: 'verified_only' as const,
        allowMessages: true,
        allowNotifications: true,
        dataRetention: '12_months' as const,
        analyticsOptIn: false
      };
      const summary = getPrivacySettingsSummary(settings);
      expect(summary).toHaveLength(5);
      expect(summary[0]).toContain('Profile visibility');
      expect(summary[1]).toContain('Messages');
      expect(summary[2]).toContain('Notifications');
      expect(summary[3]).toContain('Data retention');
      expect(summary[4]).toContain('Analytics');
    });
  });

  describe('anonymizeUserData', () => {
    it('should redact personal information', () => {
      const data = {
        id: 'uuid-123',
        firstName: 'John',
        city: 'New York',
        about: 'Personal bio',
        looking: 'Looking for...',
        avatar: 'https://example.com/avatar.jpg'
      };
      const anonymized = anonymizeUserData(data);
      expect(anonymized.firstName).toBe('[REDACTED]');
      expect(anonymized.city).toBe('[REDACTED]');
      expect(anonymized.about).toBe('[REDACTED]');
      expect(anonymized.looking).toBe('[REDACTED]');
      expect(anonymized.avatar).toBeNull();
    });

    it('should preserve id field', () => {
      const data = { id: 'uuid-123', firstName: 'John' };
      const anonymized = anonymizeUserData(data);
      expect(anonymized.id).toBe('uuid-123');
    });
  });

  describe('canExportData', () => {
    it('should allow verified users to export data', () => {
      expect(canExportData(true)).toBe(true);
    });

    it('should not allow unverified users to export data', () => {
      expect(canExportData(false)).toBe(false);
    });
  });

  describe('canDeleteAccount', () => {
    it('should allow verified users to delete account', () => {
      expect(canDeleteAccount(true)).toBe(true);
    });

    it('should allow unverified users to delete account', () => {
      expect(canDeleteAccount(false)).toBe(true);
    });
  });
});
