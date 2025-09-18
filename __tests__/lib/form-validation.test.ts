import { FormValidator, SimplifiedRegistrationRequest } from '@/lib/form-validation';

describe('FormValidator - Simplified Registration', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'merchant123@business.org',
        'info+tag@company.net'
      ];

      validEmails.forEach(email => {
        const result = FormValidator.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        '',
        '   ',
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user name@domain.com'
      ];

      invalidEmails.forEach(email => {
        const result = FormValidator.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty email', () => {
      const result = FormValidator.validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should trim whitespace from email', () => {
      const result = FormValidator.validateEmail('  test@example.com  ');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePin', () => {
    it('should validate correct PIN formats', () => {
      const validPins = [
        '1234',      // 4 digits
        '12345',     // 5 digits
        '123456',    // 6 digits
        '1234567',   // 7 digits
        '12345678'   // 8 digits
      ];

      validPins.forEach(pin => {
        const result = FormValidator.validatePin(pin);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid PIN formats', () => {
      const invalidPins = [
        '',           // empty
        '123',        // too short
        '123456789',  // too long
        '12ab',       // contains letters
        '12 34',      // contains space
        '12.34',      // contains special chars
        'abcd'        // all letters
      ];

      invalidPins.forEach(pin => {
        const result = FormValidator.validatePin(pin);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty PIN', () => {
      const result = FormValidator.validatePin('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PIN is required');
    });
  });

  describe('validateSimplifiedRegistration', () => {
    it('should validate complete valid registration data', () => {
      const validData: SimplifiedRegistrationRequest = {
        business_email: 'merchant@example.com',
        pin: '123456'
      };

      const result = FormValidator.validateSimplifiedRegistration(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all validation errors', () => {
      const invalidData: SimplifiedRegistrationRequest = {
        business_email: 'invalid-email',
        pin: '12'
      };

      const result = FormValidator.validateSimplifiedRegistration(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some(error => error.includes('email'))).toBe(true);
      expect(result.errors.some(error => error.includes('PIN'))).toBe(true);
    });

    it('should handle missing fields', () => {
      const incompleteData: SimplifiedRegistrationRequest = {
        business_email: '',
        pin: ''
      };

      const result = FormValidator.validateSimplifiedRegistration(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
      expect(result.errors).toContain('PIN is required');
    });
  });
});