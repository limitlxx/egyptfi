/**
 * Unit tests for error handling system
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  createErrorResponse,
  createSuccessResponse,
  createErrorNextResponse,
  createSuccessNextResponse,
  ErrorHandler
} from '../../lib/error-handling';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      data,
      status: options?.status || 200,
      headers: options?.headers || {}
    }))
  }
}));

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

describe('Error Handling System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createErrorResponse', () => {
    it('should create a standardized error response', () => {
      const response = createErrorResponse(ErrorCode.INVALID_PIN, 'Custom message');
      
      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.INVALID_PIN,
          message: 'Custom message',
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.MEDIUM,
          details: undefined,
          timestamp: expect.any(String),
          requestId: 'test-uuid-123',
          userMessage: 'Invalid PIN provided',
          retryable: true,
          attemptsRemaining: undefined
        }
      });
    });

    it('should use default message when no technical message provided', () => {
      const response = createErrorResponse(ErrorCode.NETWORK_ERROR);
      
      expect(response.error.message).toBe('Network error occurred. Please try again.');
      expect(response.error.userMessage).toBe('Network error occurred. Please try again.');
    });

    it('should include attempts remaining when provided', () => {
      const response = createErrorResponse(ErrorCode.INVALID_PIN, undefined, undefined, 2);
      
      expect(response.error.attemptsRemaining).toBe(2);
    });

    it('should include details when provided', () => {
      const details = { field: 'email', value: 'invalid-email' };
      const response = createErrorResponse(ErrorCode.INVALID_PARAMETERS, undefined, details);
      
      expect(response.error.details).toEqual(details);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create a standardized success response', () => {
      const data = { id: '123', name: 'Test' };
      const response = createSuccessResponse(data);
      
      expect(response).toEqual({
        success: true,
        data,
        requestId: 'test-uuid-123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('createErrorNextResponse', () => {
    it('should create NextResponse with correct status code', () => {
      const response = createErrorNextResponse(ErrorCode.INVALID_PIN);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.INVALID_PIN
          })
        }),
        { status: 401 }
      );
    });

    it('should use correct status code for different error types', () => {
      createErrorNextResponse(ErrorCode.RECORD_NOT_FOUND);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 404 }
      );

      createErrorNextResponse(ErrorCode.INTERNAL_ERROR);
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.any(Object),
        { status: 500 }
      );
    });
  });

  describe('createSuccessNextResponse', () => {
    it('should create NextResponse with success data', () => {
      const data = { result: 'success' };
      createSuccessNextResponse(data);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data
        })
      );
    });
  });

  describe('ErrorHandler', () => {
    describe('handleError', () => {
      it('should handle generic errors', () => {
        const error = new Error('Test error');
        const response = ErrorHandler.handleError(error, 'Test context');
        
        expect(console.error).toHaveBeenCalledWith(
          '[Test context] Error occurred:',
          expect.objectContaining({
            requestId: expect.any(String),
            error: 'Test error',
            stack: expect.any(String),
            timestamp: expect.any(String)
          })
        );
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: ErrorCode.INTERNAL_ERROR
            })
          }),
          { status: 500 }
        );
      });

      it('should map timeout errors correctly', () => {
        const error = new Error('Request timeout occurred');
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.TIMEOUT_ERROR
            })
          }),
          { status: 504 }
        );
      });

      it('should map network errors correctly', () => {
        const error = new Error('Network connection failed');
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.NETWORK_ERROR
            })
          }),
          { status: 503 }
        );
      });

      it('should map database errors correctly', () => {
        const error = new Error('Database query failed');
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.DATABASE_ERROR
            })
          }),
          { status: 500 }
        );
      });

      it('should map ChipiPay errors correctly', () => {
        const error = new Error('ChipiPay API error');
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.CHIPIPAY_API_ERROR
            })
          }),
          { status: 502 }
        );
      });

      it('should use error code from error object if valid', () => {
        const error = { code: ErrorCode.WALLET_CREATION_FAILED, message: 'Wallet failed' };
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.WALLET_CREATION_FAILED
            })
          }),
          { status: 500 }
        );
      });

      it('should include error details in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        
        const error = new Error('Test error');
        ErrorHandler.handleError(error, 'Test context');
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              details: {
                originalMessage: 'Test error',
                context: 'Test context'
              }
            })
          }),
          expect.any(Object)
        );
        
        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('validateRequiredFields', () => {
      it('should return null when all required fields are present', () => {
        const body = { email: 'test@example.com', pin: '123456' };
        const result = ErrorHandler.validateRequiredFields(body, ['email', 'pin']);
        
        expect(result).toBeNull();
      });

      it('should return error response when required fields are missing', () => {
        const body = { email: 'test@example.com' };
        const result = ErrorHandler.validateRequiredFields(body, ['email', 'pin']);
        
        expect(result).not.toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.MISSING_REQUIRED_FIELDS,
              details: { missingFields: ['pin'] }
            })
          }),
          { status: 400 }
        );
      });

      it('should handle multiple missing fields', () => {
        const body = {};
        const result = ErrorHandler.validateRequiredFields(body, ['email', 'pin', 'amount']);
        
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              details: { missingFields: ['email', 'pin', 'amount'] }
            })
          }),
          expect.any(Object)
        );
      });
    });

    describe('validateStarknetAddress', () => {
      it('should return null for valid Starknet address', () => {
        const validAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const result = ErrorHandler.validateStarknetAddress(validAddress);
        
        expect(result).toBeNull();
      });

      it('should return error for invalid address format', () => {
        const invalidAddress = '0x123'; // Too short
        const result = ErrorHandler.validateStarknetAddress(invalidAddress, 'recipient');
        
        expect(result).not.toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.INVALID_ADDRESS_FORMAT,
              details: { field: 'recipient', value: invalidAddress }
            })
          }),
          { status: 400 }
        );
      });

      it('should return error for address without 0x prefix', () => {
        const invalidAddress = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        const result = ErrorHandler.validateStarknetAddress(invalidAddress);
        
        expect(result).not.toBeNull();
      });

      it('should return error for address with invalid characters', () => {
        const invalidAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg';
        const result = ErrorHandler.validateStarknetAddress(invalidAddress);
        
        expect(result).not.toBeNull();
      });
    });

    describe('validateAmount', () => {
      it('should return null for valid positive amount', () => {
        const result = ErrorHandler.validateAmount('100.5');
        expect(result).toBeNull();
      });

      it('should return error for zero amount', () => {
        const result = ErrorHandler.validateAmount('0');
        
        expect(result).not.toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: ErrorCode.INVALID_AMOUNT,
              details: { value: '0' }
            })
          }),
          { status: 400 }
        );
      });

      it('should return error for negative amount', () => {
        const result = ErrorHandler.validateAmount('-10');
        expect(result).not.toBeNull();
      });

      it('should return error for non-numeric amount', () => {
        const result = ErrorHandler.validateAmount('abc');
        expect(result).not.toBeNull();
      });

      it('should return error for empty amount', () => {
        const result = ErrorHandler.validateAmount('');
        expect(result).not.toBeNull();
      });
    });
  });

  describe('Error Code Coverage', () => {
    it('should have definitions for all error codes', () => {
      const errorCodes = Object.values(ErrorCode);
      
      errorCodes.forEach(code => {
        expect(() => createErrorResponse(code)).not.toThrow();
      });
    });

    it('should have consistent error categories', () => {
      const categories = Object.values(ErrorCategory);
      
      categories.forEach(category => {
        expect(typeof category).toBe('string');
        expect(category.length).toBeGreaterThan(0);
      });
    });

    it('should have consistent error severities', () => {
      const severities = Object.values(ErrorSeverity);
      
      severities.forEach(severity => {
        expect(typeof severity).toBe('string');
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(severity);
      });
    });
  });
});