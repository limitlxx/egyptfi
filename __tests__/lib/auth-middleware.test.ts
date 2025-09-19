// __tests__/lib/auth-middleware.test.ts
import { AuthMiddleware } from '../../lib/auth-middleware';
import pool from '../../lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Mock the database pool
jest.mock('../../lib/db', () => ({
  connect: jest.fn(),
}));

const mockPool = pool as jest.Mocked<{ connect: jest.MockedFunction<any> }>;

describe('AuthMiddleware', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('validateApiKey', () => {
    it('should return error for missing API key', async () => {
      const result = await AuthMiddleware.validateApiKey('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key is required');
    });

    it('should return error for invalid API key format', async () => {
      const result = await AuthMiddleware.validateApiKey('invalid_key');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key format');
    });

    it('should validate testnet API key successfully', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        business_email: 'test@example.com',
        wallet_public_key: 'public_key_123',
        wallet_encrypted_private_key: 'encrypted_private_key',
        chipipay_external_user_id: 'external_123',
        is_verified: true
      };

      mockClient.query.mockResolvedValue({
        rows: [mockMerchant]
      });

      const result = await AuthMiddleware.validateApiKey('pk_test_123456');
      
      expect(result.success).toBe(true);
      expect(result.merchant).toEqual({
        merchantId: 'merchant-123',
        businessEmail: 'test@example.com',
        environment: 'testnet',
        walletData: {
          publicKey: 'public_key_123',
          encryptedPrivateKey: 'encrypted_private_key',
          chipipayExternalUserId: 'external_123'
        }
      });
    });

    it('should validate mainnet API key successfully', async () => {
      const mockMerchant = {
        id: 'merchant-456',
        business_email: 'prod@example.com',
        wallet_public_key: 'public_key_456',
        wallet_encrypted_private_key: 'encrypted_private_key_prod',
        chipipay_external_user_id: 'external_456',
        is_verified: true
      };

      mockClient.query.mockResolvedValue({
        rows: [mockMerchant]
      });

      const result = await AuthMiddleware.validateApiKey('pk_live_789012');
      
      expect(result.success).toBe(true);
      expect(result.merchant?.environment).toBe('mainnet');
    });

    it('should return error for non-existent API key', async () => {
      mockClient.query.mockResolvedValue({
        rows: []
      });

      const result = await AuthMiddleware.validateApiKey('pk_test_nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or merchant not found');
    });

    it('should handle database errors gracefully', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await AuthMiddleware.validateApiKey('pk_test_123456');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store before each test
      const rateLimitStore = (AuthMiddleware as any).rateLimitStore;
      if (rateLimitStore) {
        rateLimitStore.clear();
      }
    });

    it('should allow first request', () => {
      const result = AuthMiddleware.checkRateLimit('merchant-123');
      
      expect(result.allowed).toBe(true);
      expect(result.resetTime).toBeUndefined();
    });

    it('should track multiple requests', () => {
      const merchantId = 'merchant-123';
      
      // Make multiple requests
      for (let i = 0; i < 50; i++) {
        const result = AuthMiddleware.checkRateLimit(merchantId);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests after rate limit exceeded', () => {
      const merchantId = 'merchant-123';
      
      // Make requests up to the limit
      for (let i = 0; i < 100; i++) {
        AuthMiddleware.checkRateLimit(merchantId);
      }
      
      // Next request should be blocked
      const result = AuthMiddleware.checkRateLimit(merchantId);
      expect(result.allowed).toBe(false);
      expect(result.resetTime).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should return 401 for missing API key', async () => {
      const request = new NextRequest('http://localhost/api/test');
      
      const response = await AuthMiddleware.authenticate(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await (response as NextResponse).json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('API key is required in x-api-key header');
    });

    it('should return 401 for invalid API key', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'invalid_key'
        }
      });

      const response = await AuthMiddleware.authenticate(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await (response as NextResponse).json();
      expect(responseData.success).toBe(false);
    });

    it('should return merchant data for valid API key', async () => {
      const mockMerchant = {
        id: 'merchant-valid-auth',
        business_email: 'test@example.com',
        wallet_public_key: 'public_key_123',
        wallet_encrypted_private_key: 'encrypted_private_key',
        chipipay_external_user_id: 'external_123',
        is_verified: true
      };

      mockClient.query.mockResolvedValue({
        rows: [mockMerchant]
      });

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'pk_test_valid_auth'
        }
      });

      const result = await AuthMiddleware.authenticate(request);
      
      // Should return merchant data, not a NextResponse
      if (result instanceof NextResponse) {
        const responseData = await result.json();
        console.log('Response data:', responseData);
        expect(false).toBe(true); // Force failure with message
      } else {
        expect((result as any).merchantId).toBe('merchant-valid-auth');
      }
    });

    it('should return 429 for rate limit exceeded', async () => {
      const mockMerchant = {
        id: 'merchant-rate-limit',
        business_email: 'test@example.com',
        wallet_public_key: 'public_key_123',
        wallet_encrypted_private_key: 'encrypted_private_key',
        chipipay_external_user_id: 'external_123',
        is_verified: true
      };

      mockClient.query.mockResolvedValue({
        rows: [mockMerchant]
      });

      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'pk_test_rate_limit'
        }
      });

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        AuthMiddleware.checkRateLimit('merchant-rate-limit');
      }

      const response = await AuthMiddleware.authenticate(request);
      
      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await (response as NextResponse).json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Rate limit exceeded');
    });
  });

  describe('getAuthHeaders', () => {
    it('should extract auth headers from request', () => {
      const request = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-api-key': 'pk_test_123456',
          'x-environment': 'testnet'
        }
      });

      const headers = AuthMiddleware.getAuthHeaders(request);
      
      expect(headers.apiKey).toBe('pk_test_123456');
      expect(headers.environment).toBe('testnet');
    });

    it('should handle missing headers', () => {
      const request = new NextRequest('http://localhost/api/test');

      const headers = AuthMiddleware.getAuthHeaders(request);
      
      expect(headers.apiKey).toBeNull();
      expect(headers.environment).toBeNull();
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle database connection failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await AuthMiddleware.validateApiKey('pk_test_connection_fail');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });

    it('should handle client release failure gracefully', async () => {
      const mockClientWithFailingRelease = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn().mockImplementation(() => {
          throw new Error('Release failed');
        })
      };
      
      mockPool.connect.mockResolvedValue(mockClientWithFailingRelease);

      const result = await AuthMiddleware.validateApiKey('pk_test_release_fail');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed'); // Generic error due to release failure
    });

    it('should handle merchant with missing wallet data', async () => {
      // The SQL query filters out merchants without wallet data using WHERE clauses
      // So we mock an empty result to simulate this behavior
      mockClient.query.mockResolvedValue({
        rows: []
      });

      const result = await AuthMiddleware.validateApiKey('pk_test_no_wallet');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or merchant not found');
    });

    it('should handle unverified merchant', async () => {
      // The SQL query filters out unverified merchants using WHERE is_verified = true
      // So we mock an empty result to simulate this behavior
      mockClient.query.mockResolvedValue({
        rows: []
      });

      const result = await AuthMiddleware.validateApiKey('pk_test_unverified');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key or merchant not found');
    });

    it('should handle rate limit reset after time window', () => {
      const merchantId = 'merchant-reset-test';
      
      // Mock Date.now to control time
      const originalDateNow = Date.now;
      let mockTime = 1000000000000; // Fixed timestamp
      Date.now = jest.fn(() => mockTime);

      try {
        // Make requests up to limit
        for (let i = 0; i < 100; i++) {
          AuthMiddleware.checkRateLimit(merchantId);
        }
        
        // Should be blocked
        let result = AuthMiddleware.checkRateLimit(merchantId);
        expect(result.allowed).toBe(false);
        
        // Advance time past reset window
        mockTime += 61 * 1000; // 61 seconds later
        
        // Should be allowed again
        result = AuthMiddleware.checkRateLimit(merchantId);
        expect(result.allowed).toBe(true);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should handle authentication middleware internal errors', async () => {
      // Mock validateApiKey to throw an unexpected error
      const originalValidateApiKey = AuthMiddleware.validateApiKey;
      AuthMiddleware.validateApiKey = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      try {
        const request = new NextRequest('http://localhost/api/test', {
          headers: {
            'x-api-key': 'pk_test_error'
          }
        });

        const response = await AuthMiddleware.authenticate(request);
        
        expect(response).toBeInstanceOf(NextResponse);
        const responseData = await (response as NextResponse).json();
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBe('Internal authentication error');
      } finally {
        AuthMiddleware.validateApiKey = originalValidateApiKey;
      }
    });
  });
});