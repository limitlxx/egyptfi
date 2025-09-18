/**
 * Unit tests for error middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withErrorHandling,
  validateContentType,
  parseAndValidateBody,
  checkRateLimit,
  validateRequest,
  safeAsync,
  withDatabaseTransaction
} from '../../lib/error-middleware';
import { ErrorCode } from '../../lib/error-handling';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      data,
      status: options?.status || 200,
      headers: options?.headers || {}
    }))
  },
  NextRequest: jest.fn().mockImplementation((url, options = {}) => ({
    url,
    method: options.method || 'GET',
    headers: {
      get: jest.fn((name) => {
        const headers = options.headers || {};
        return headers[name] || null;
      })
    },
    nextUrl: {
      pathname: new URL(url).pathname
    },
    json: jest.fn()
  }))
}));

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

describe('Error Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('withErrorHandling', () => {
    it('should handle successful requests', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      
      const wrappedHandler = withErrorHandling(mockHandler, 'Test context');
      const mockRequest = new NextRequest('http://localhost/test');
      
      const result = await wrappedHandler(mockRequest);
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(NextResponse.json({ success: true }));
    });

    it('should handle errors thrown by handler', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const wrappedHandler = withErrorHandling(mockHandler, 'Test context');
      const mockRequest = new NextRequest('http://localhost/test');
      
      await wrappedHandler(mockRequest);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Test context] Error occurred:',
        expect.objectContaining({
          error: 'Test error'
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

    it('should use default context when none provided', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const wrappedHandler = withErrorHandling(mockHandler);
      const mockRequest = new NextRequest('http://localhost/test');
      
      await wrappedHandler(mockRequest);
      
      expect(console.error).toHaveBeenCalledWith(
        '[GET /test] Error occurred:',
        expect.any(Object)
      );
    });
  });

  describe('validateContentType', () => {
    it('should return null for GET requests', () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'GET'
      });
      
      const result = validateContentType(mockRequest);
      expect(result).toBeNull();
    });

    it('should return null for POST requests with correct content type', () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });
      
      const result = validateContentType(mockRequest);
      expect(result).toBeNull();
    });

    it('should return error for POST requests without JSON content type', () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' }
      });
      
      const result = validateContentType(mockRequest);
      
      expect(result).not.toBeNull();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INVALID_PARAMETERS
          })
        }),
        { status: 400 }
      );
    });

    it('should return error for POST requests without content type', () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'POST'
      });
      
      const result = validateContentType(mockRequest);
      expect(result).not.toBeNull();
    });
  });

  describe('parseAndValidateBody', () => {
    it('should parse valid JSON body', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({ email: 'test@example.com', pin: '123456' })
      } as any;
      
      const result = await parseAndValidateBody(mockRequest);
      
      expect(result.body).toEqual({ email: 'test@example.com', pin: '123456' });
      expect(result.error).toBeUndefined();
    });

    it('should validate required fields', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({ email: 'test@example.com' })
      } as any;
      
      const result = await parseAndValidateBody(mockRequest, ['email', 'pin']);
      
      expect(result.error).not.toBeUndefined();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.MISSING_REQUIRED_FIELDS
          })
        }),
        { status: 400 }
      );
    });

    it('should handle invalid JSON', async () => {
      const mockRequest = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any;
      
      const result = await parseAndValidateBody(mockRequest);
      
      expect(result.error).not.toBeUndefined();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INVALID_PARAMETERS
          })
        }),
        { status: 400 }
      );
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit map between tests
      jest.clearAllMocks();
    });

    it('should allow first request', () => {
      const result = checkRateLimit('test-user', 5, 60000);
      expect(result).toBeNull();
    });

    it('should allow requests within limit', () => {
      checkRateLimit('test-user', 5, 60000);
      checkRateLimit('test-user', 5, 60000);
      const result = checkRateLimit('test-user', 5, 60000);
      
      expect(result).toBeNull();
    });

    it('should block requests exceeding limit', () => {
      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        checkRateLimit('test-user', 5, 60000);
      }
      
      // 6th request should be blocked
      const result = checkRateLimit('test-user', 5, 60000);
      
      expect(result).not.toBeNull();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.PIN_ATTEMPTS_EXCEEDED
          })
        }),
        expect.any(Object)
      );
    });

    it('should reset after window expires', () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = jest.fn(() => currentTime);
      
      // Make requests up to limit with a different user to avoid interference
      for (let i = 0; i < 5; i++) {
        checkRateLimit('test-user-2', 5, 60000);
      }
      
      // Advance time beyond window
      currentTime += 61000;
      
      // Should allow new request
      const result = checkRateLimit('test-user-2', 5, 60000);
      expect(result).toBeNull();
      
      Date.now = originalNow;
    });
  });

  describe('validateRequest', () => {
    it('should validate allowed methods', async () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'DELETE'
      });
      
      const result = await validateRequest(mockRequest, {
        allowedMethods: ['GET', 'POST']
      });
      
      expect(result.error).not.toBeUndefined();
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INVALID_PARAMETERS,
            details: { allowedMethods: ['GET', 'POST'] }
          })
        }),
        { status: 400 }
      );
    });

    it('should validate content length', async () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '2000000' // 2MB
        }
      });
      
      const result = await validateRequest(mockRequest, {
        maxBodySize: 1024 * 1024 // 1MB
      });
      
      expect(result.error).not.toBeUndefined();
    });

    it('should handle successful validation', async () => {
      const mockRequest = new NextRequest('http://localhost/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });
      
      // Mock the json method
      mockRequest.json = jest.fn().mockResolvedValue({ email: 'test@example.com' });
      
      const result = await validateRequest(mockRequest, {
        allowedMethods: ['POST'],
        requiredFields: ['email']
      });
      
      expect(result.error).toBeUndefined();
      expect(result.body).toEqual({ email: 'test@example.com' });
    });
  });

  describe('safeAsync', () => {
    it('should return result for successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await safeAsync(operation, 'Test operation');
      
      expect(result.result).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should return error for failed operation', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      const result = await safeAsync(operation, 'Test operation');
      
      expect(result.result).toBeUndefined();
      expect(result.error).not.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        '[Test operation] Error occurred:',
        expect.any(Object)
      );
    });

    it('should use custom fallback error code', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await safeAsync(operation, 'Test operation', ErrorCode.NETWORK_ERROR);
      
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.NETWORK_ERROR
          })
        }),
        { status: 503 }
      );
    });
  });

  describe('withDatabaseTransaction', () => {
    let mockPool: any;
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      
      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient)
      };
    });

    it('should handle successful transaction', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await withDatabaseTransaction(operation, mockPool, 'Test DB operation');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(operation).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.result).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should handle failed transaction', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('DB operation failed'));
      
      const result = await withDatabaseTransaction(operation, mockPool, 'Test DB operation');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.result).toBeUndefined();
      expect(result.error).not.toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        '[Test DB operation] Error occurred:',
        expect.any(Object)
      );
    });

    it('should always release client even if rollback fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('DB operation failed'));
      mockClient.query.mockImplementation((query: string) => {
        if (query === 'ROLLBACK') {
          throw new Error('Rollback failed');
        }
      });
      
      // Suppress console.error for this test since we expect it
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await withDatabaseTransaction(operation, mockPool, 'Test DB operation');
      
      expect(mockClient.release).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});