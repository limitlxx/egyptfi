// __tests__/lib/wallet-auth-integration.test.ts
import { WalletAuthIntegration } from '../../lib/wallet-auth-integration';
import { AuthMiddleware } from '../../lib/auth-middleware';
import { WalletCrypto } from '../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../lib/chipipay-auth';
import { NextRequest, NextResponse } from 'next/server';

// Mock all dependencies
jest.mock('../../lib/auth-middleware');
jest.mock('../../lib/wallet-crypto');
jest.mock('../../lib/chipipay-auth');

const mockAuthMiddleware = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
const mockWalletCrypto = WalletCrypto as jest.Mocked<typeof WalletCrypto>;
const mockChipiPayAuth = ChipiPayAuth as jest.Mocked<typeof ChipiPayAuth>;

describe('WalletAuthIntegration', () => {
  const mockMerchantData = {
    merchantId: 'merchant-123',
    businessEmail: 'test@example.com',
    environment: 'testnet' as const,
    walletData: {
      publicKey: 'public_key_123',
      encryptedPrivateKey: 'encrypted_private_key',
      chipipayExternalUserId: 'external_123'
    }
  };

  const mockRequest = new NextRequest('http://localhost/api/test', {
    headers: {
      'x-api-key': 'pk_test_123456'
    }
  });

  const mockRequestBody = {
    pin: '123456',
    amount: '100',
    recipient: '0x123...'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateWalletOperation', () => {
    it('should complete full authentication flow successfully', async () => {
      // Mock successful authentication
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      
      // Mock successful PIN validation
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted_private_key'
      });

      // Mock successful bearer token generation
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer_token_123',
        expiresAt: Date.now() + 3600000
      });

      const result = await WalletAuthIntegration.authenticateWalletOperation(
        mockRequest,
        mockRequestBody
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        merchantData: mockMerchantData,
        privateKey: 'decrypted_private_key',
        bearerToken: 'bearer_token_123'
      });

      // Verify all steps were called
      expect(mockAuthMiddleware.authenticate).toHaveBeenCalledWith(mockRequest);
      expect(mockWalletCrypto.validatePinAndDecryptWallet).toHaveBeenCalledWith(
        'merchant-123',
        '123456'
      );
      expect(mockChipiPayAuth.getBearerToken).toHaveBeenCalledWith(
        'merchant-123',
        'testnet'
      );
    });

    it('should fail if API key authentication fails', async () => {
      const errorResponse = NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      mockAuthMiddleware.authenticate.mockResolvedValue(errorResponse);

      const result = await WalletAuthIntegration.authenticateWalletOperation(
        mockRequest,
        mockRequestBody
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should fail if PIN validation fails', async () => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: false,
        error: 'Invalid PIN'
      });

      const result = await WalletAuthIntegration.authenticateWalletOperation(
        mockRequest,
        mockRequestBody
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid PIN');
    });

    it('should fail if bearer token generation fails', async () => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted_private_key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: false,
        error: 'Token generation failed'
      });

      const result = await WalletAuthIntegration.authenticateWalletOperation(
        mockRequest,
        mockRequestBody
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token generation failed');
    });

    it('should handle unexpected errors', async () => {
      mockAuthMiddleware.authenticate.mockRejectedValue(new Error('Unexpected error'));

      const result = await WalletAuthIntegration.authenticateWalletOperation(
        mockRequest,
        mockRequestBody
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal authentication error');
    });
  });

  describe('withWalletAuth', () => {
    it('should execute operation with successful authentication', async () => {
      // Mock successful authentication
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted_private_key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer_token_123',
        expiresAt: Date.now() + 3600000
      });

      const mockOperation = jest.fn().mockResolvedValue({ txHash: '0xabc123' });

      const response = await WalletAuthIntegration.withWalletAuth(
        mockRequest,
        mockRequestBody,
        mockOperation
      );

      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual({ txHash: '0xabc123' });

      expect(mockOperation).toHaveBeenCalledWith({
        merchantData: mockMerchantData,
        privateKey: 'decrypted_private_key',
        bearerToken: 'bearer_token_123'
      });
    });

    it('should return 401 for authentication failure', async () => {
      const errorResponse = NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      mockAuthMiddleware.authenticate.mockResolvedValue(errorResponse);

      const mockOperation = jest.fn();

      const response = await WalletAuthIntegration.withWalletAuth(
        mockRequest,
        mockRequestBody,
        mockOperation
      );

      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid API key');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should return 500 for operation failure', async () => {
      // Mock successful authentication
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted_private_key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer_token_123',
        expiresAt: Date.now() + 3600000
      });

      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      const response = await WalletAuthIntegration.withWalletAuth(
        mockRequest,
        mockRequestBody,
        mockOperation
      );

      expect(response).toBeInstanceOf(NextResponse);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Operation failed');
    });
  });

  describe('validateWalletRequest', () => {
    it('should validate correct request body', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        pin: '123456',
        amount: '100'
      });

      expect(result.valid).toBe(true);
    });

    it('should reject missing body', () => {
      const result = WalletAuthIntegration.validateWalletRequest(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Request body is required');
    });

    it('should reject missing PIN', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        amount: '100'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('PIN is required');
    });

    it('should reject non-string PIN', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        pin: 123456
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('PIN must be a string');
    });

    it('should reject invalid PIN format', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        pin: 'abc123'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
    });

    it('should reject PIN that is too short', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        pin: '123'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
    });

    it('should reject PIN that is too long', () => {
      const result = WalletAuthIntegration.validateWalletRequest({
        pin: '123456789'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
    });
  });

  describe('getMerchantAuthStatus', () => {
    it('should return authentication status for valid merchant', async () => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchantData);
      mockWalletCrypto.getRemainingAttempts.mockReturnValue(5);
      mockWalletCrypto.isAccountLocked.mockReturnValue(false);

      const result = await WalletAuthIntegration.getMerchantAuthStatus(mockRequest);

      expect(result).toEqual({
        authenticated: true,
        merchantId: 'merchant-123',
        environment: 'testnet',
        remainingAttempts: 5,
        isLocked: false
      });
    });

    it('should return unauthenticated for invalid merchant', async () => {
      const errorResponse = NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      mockAuthMiddleware.authenticate.mockResolvedValue(errorResponse);

      const result = await WalletAuthIntegration.getMerchantAuthStatus(mockRequest);

      expect(result).toEqual({
        authenticated: false
      });
    });

    it('should handle authentication errors', async () => {
      mockAuthMiddleware.authenticate.mockRejectedValue(new Error('Auth error'));

      const result = await WalletAuthIntegration.getMerchantAuthStatus(mockRequest);

      expect(result).toEqual({
        authenticated: false
      });
    });
  });
});