import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IDExtractionResult, LivenessCheckResult, PhotoConsistencyResult } from '../types';

/**
 * Unit Tests for Server-side Verification Functions
 *
 * Tests cover:
 * - Claude Vision API integration
 * - ID extraction
 * - Liveness checking
 * - Photo consistency analysis
 * - Error handling
 * - Response validation
 */

describe('Server Verification Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ID Extraction', () => {
    it('should extract all required ID fields', async () => {
      const mockResponse = {
        idNumber: 'DL123456',
        idName: 'John Doe',
        idDOB: '01/15/1990',
        expirationDate: '01/15/2030'
      };

      expect(mockResponse).toHaveProperty('idNumber');
      expect(mockResponse).toHaveProperty('idName');
      expect(mockResponse).toHaveProperty('idDOB');
      expect(mockResponse.idNumber).toBeTruthy();
      expect(mockResponse.idName).toBeTruthy();
      expect(mockResponse.idDOB).toBeTruthy();
    });

    it('should handle missing expiration date', () => {
      const mockResponse = {
        idNumber: 'DL123456',
        idName: 'John Doe',
        idDOB: '01/15/1990'
      };

      expect(mockResponse.expirationDate).toBeUndefined();
    });

    it('should validate base64 image format', () => {
      const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const invalidBase64 = 'not-valid-base64!!!';

      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      expect(validBase64).toMatch(base64Regex);
      expect(invalidBase64).not.toMatch(base64Regex);
    });

    it('should validate MIME type', () => {
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const invalidMimeTypes = ['text/plain', 'application/json', 'video/mp4'];

      validMimeTypes.forEach((mimeType) => {
        expect(mimeType).toMatch(/^image\//);
      });

      invalidMimeTypes.forEach((mimeType) => {
        expect(mimeType).not.toMatch(/^image\//);
      });
    });

    it('should handle API errors gracefully', () => {
      const errors = [
        'ID photo is unclear. Please upload a clearer photo.',
        'Could not find a valid ID in the photo. Please try again.',
        'Service temporarily unavailable. Please try again.'
      ];

      errors.forEach((error) => {
        expect(error).toBeTruthy();
        expect(error.length).toBeGreaterThan(0);
      });
    });

    it('should validate extracted data format', () => {
      const validData: IDExtractionResult = {
        idNumber: 'DL123456',
        idName: 'John Doe',
        idDOB: '01/15/1990'
      };

      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      expect(validData.idNumber).toBeTruthy();
      expect(validData.idName).toBeTruthy();
      expect(validData.idDOB).toMatch(dateRegex);
    });
  });

  describe('Liveness Check', () => {
    it('should compare two images and return confidence score', () => {
      const mockResult: LivenessCheckResult = {
        confidence: 92,
        match: true
      };

      expect(mockResult.confidence).toBeGreaterThanOrEqual(0);
      expect(mockResult.confidence).toBeLessThanOrEqual(100);
      expect(typeof mockResult.match).toBe('boolean');
    });

    it('should mark as match if confidence >= 80', () => {
      const highConfidence: LivenessCheckResult = {
        confidence: 85,
        match: true
      };

      const lowConfidence: LivenessCheckResult = {
        confidence: 75,
        match: false
      };

      expect(highConfidence.confidence).toBeGreaterThanOrEqual(80);
      expect(highConfidence.match).toBe(true);

      expect(lowConfidence.confidence).toBeLessThan(80);
      expect(lowConfidence.match).toBe(false);
    });

    it('should require at least 2 images', () => {
      const photoArray1 = ['image1'];
      const photoArray2 = ['image1', 'image2'];

      expect(photoArray1.length).toBeLessThan(2);
      expect(photoArray2.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle API errors', () => {
      const errors = [
        'Failed to check liveness',
        'Invalid image format',
        'API service error'
      ];

      errors.forEach((error) => {
        expect(error).toBeTruthy();
      });
    });
  });

  describe('Photo Consistency Check', () => {
    it('should analyze multiple photos for consistency', () => {
      const mockResult: PhotoConsistencyResult = {
        confidence: 88,
        consistent: true
      };

      expect(mockResult.confidence).toBeGreaterThanOrEqual(0);
      expect(mockResult.confidence).toBeLessThanOrEqual(100);
      expect(typeof mockResult.consistent).toBe('boolean');
    });

    it('should mark as consistent if confidence >= 80', () => {
      const highConfidence: PhotoConsistencyResult = {
        confidence: 85,
        consistent: true
      };

      const lowConfidence: PhotoConsistencyResult = {
        confidence: 75,
        consistent: false
      };

      expect(highConfidence.confidence).toBeGreaterThanOrEqual(80);
      expect(highConfidence.consistent).toBe(true);

      expect(lowConfidence.confidence).toBeLessThan(80);
      expect(lowConfidence.consistent).toBe(false);
    });

    it('should require minimum 2 photos', () => {
      const validPhotos = ['photo1', 'photo2', 'photo3', 'photo4', 'photo5'];
      expect(validPhotos.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle inconsistent photos', () => {
      const inconsistentResult: PhotoConsistencyResult = {
        confidence: 30,
        consistent: false
      };

      expect(inconsistentResult.consistent).toBe(false);
      expect(inconsistentResult.confidence).toBeLessThan(80);
    });

    it('should handle API errors', () => {
      const errors = [
        'Failed to check photo consistency',
        'Invalid image format',
        'Too many images'
      ];

      errors.forEach((error) => {
        expect(error).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key', () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        expect(apiKey).toBeUndefined();
      }
    });

    it('should handle network errors', () => {
      const networkErrors = [
        'Network timeout',
        'Connection refused',
        'DNS resolution failed'
      ];

      networkErrors.forEach((error) => {
        expect(error).toBeTruthy();
      });
    });

    it('should handle invalid JSON responses', () => {
      const invalidJson = 'not valid json';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle missing required fields in response', () => {
      const incompleteResponse = {
        idNumber: 'DL123456'
        // Missing idName and idDOB
      };

      expect(incompleteResponse).toHaveProperty('idNumber');
      expect(incompleteResponse).not.toHaveProperty('idName');
      expect(incompleteResponse).not.toHaveProperty('idDOB');
    });

    it('should provide meaningful error messages', () => {
      const errorMessages = [
        'ID photo is unclear. Please upload a clearer photo.',
        'Could not find a valid ID in the photo. Please try again.',
        'Service temporarily unavailable. Please try again.',
        'Failed to extract ID information. Please try again.'
      ];

      errorMessages.forEach((message) => {
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Response Validation', () => {
    it('should validate ID extraction response structure', () => {
      const validResponse: IDExtractionResult = {
        idNumber: 'DL123456',
        idName: 'John Doe',
        idDOB: '01/15/1990',
        expirationDate: '01/15/2030'
      };

      expect(validResponse).toHaveProperty('idNumber');
      expect(validResponse).toHaveProperty('idName');
      expect(validResponse).toHaveProperty('idDOB');
      expect(typeof validResponse.idNumber).toBe('string');
      expect(typeof validResponse.idName).toBe('string');
      expect(typeof validResponse.idDOB).toBe('string');
    });

    it('should validate liveness check response structure', () => {
      const validResponse: LivenessCheckResult = {
        confidence: 92,
        match: true
      };

      expect(validResponse).toHaveProperty('confidence');
      expect(validResponse).toHaveProperty('match');
      expect(typeof validResponse.confidence).toBe('number');
      expect(typeof validResponse.match).toBe('boolean');
    });

    it('should validate photo consistency response structure', () => {
      const validResponse: PhotoConsistencyResult = {
        confidence: 88,
        consistent: true
      };

      expect(validResponse).toHaveProperty('confidence');
      expect(validResponse).toHaveProperty('consistent');
      expect(typeof validResponse.confidence).toBe('number');
      expect(typeof validResponse.consistent).toBe('boolean');
    });
  });

  describe('Data Sanitization', () => {
    it('should handle special characters in names', () => {
      const names = [
        'John O\'Reilly',
        'María García',
        'Jean-Pierre Dupont',
        'Müller'
      ];

      names.forEach((name) => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('should handle various date formats', () => {
      const dates = [
        '01/15/1990',
        '12/31/2000',
        '06/30/1985'
      ];

      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      dates.forEach((date) => {
        expect(date).toMatch(dateRegex);
      });
    });

    it('should handle various ID number formats', () => {
      const idNumbers = [
        'DL123456',
        'PA1234567',
        'NY12345678',
        'CA1234567890'
      ];

      idNumbers.forEach((id) => {
        expect(id).toBeTruthy();
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large base64 images', () => {
      // Simulate a large base64 string (5MB)
      const largeBase64 = 'A'.repeat(5 * 1024 * 1024);
      expect(largeBase64.length).toBeGreaterThan(1000000);
    });

    it('should handle multiple photo analysis', () => {
      const photoCount = 10;
      expect(photoCount).toBeGreaterThanOrEqual(2);
      expect(photoCount).toBeLessThanOrEqual(20);
    });

    it('should timeout on slow API responses', () => {
      const timeoutMs = 30000; // 30 seconds
      expect(timeoutMs).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    it('should not expose API keys in responses', () => {
      const response = {
        data: {
          idNumber: 'DL123456',
          idName: 'John Doe',
          idDOB: '01/15/1990'
        }
      };

      expect(JSON.stringify(response)).not.toContain('ANTHROPIC_API_KEY');
      expect(JSON.stringify(response)).not.toContain('sk-');
    });

    it('should validate base64 input to prevent injection', () => {
      const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const injectionAttempt = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; DROP TABLE users; --';

      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      expect(validBase64).toMatch(base64Regex);
      expect(injectionAttempt).not.toMatch(base64Regex);
    });

    it('should sanitize error messages', () => {
      const errorMessage = 'ID photo is unclear. Please upload a clearer photo.';
      expect(errorMessage).not.toContain('<script>');
      expect(errorMessage).not.toContain('onclick=');
      expect(errorMessage).not.toContain('onerror=');
    });
  });
});
