import { NextRequest } from 'next/server';
import { POST } from '../../../../../app/api/merchants/wallet/approve/route';
import { AuthMiddleware } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import pool from '../../../../../lib/db';

// Mock dependencies
jest.mock('../../../../../lib/auth-middleware');
jest.mock('../../../../../lib/wallet-crypto');
jest.mock('../../../../../lib/chipipay-auth');
jest.mock('../../../../../services/chipipayService');
jest.mock('../../../../../lib/db');

const mockAuthMiddleware = AuthMiddleware as jest.Mocked<typeof AuthMiddleware>;
const mockWalletCrypto = WalletCrypto as jest.Mocked<typeof WalletCrypto>;
const mockChipiPayAuth = ChipiPayAuth as jest.Mocked<typeof ChipiPayAuth>;
const mockChipipayService = chipipayService as jest.Mocked<typeof chipipayService>;
const mockPool = pool as jest.Mocked<typeof pool>;

describe('/api/merchants/wallet/approve', () => {
  const mockMerchant = {
    merchantId: 'merchant-123',
    businessEmail: 'test@example.com',
    environment: 'testnet' as const,
    walletData: {
      publicKey: '0x123...',
      encryptedPrivateKey: 'encrypted-key',
      chipipayExternalUserId: 'external-123'
    }
  };

  const mockRequest = (body: any) => {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: {
        get: jest.fn().mockReturnValue('test-api-key')
      }
    } as unknown as NextRequest;
  };

  const mockClient = {
    query: jest.fn(),
    release: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient as any);
  });

  describe('Authentication', () => {
    it('should return 401 when API key is missing', async () => {
      const request = mockRequest({});
      mockAuthMiddleware.authenticate.mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'API key required' }), { status: 401 })
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
    });

    it('should return 400 when required fields are missing', async () => {
      const request = mockRequest({});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when contract address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: 'invalid-address',
        spender: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid contract address format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when spender address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: 'invalid-spender',
        amount: '100'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid spender address format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when amount is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: 'invalid'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Amount must be a positive number or "max"');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should accept "max" as a valid amount for unlimited approval', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: 'max'
      });

      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
      mockChipipayService.approve.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 400 when decimals is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100',
        decimals: 25
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Decimals must be an integer between 0 and 18');
    });
  });

  describe('PIN Validation', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
    });

    it('should return 401 when PIN is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100'
      });

      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: false,
        error: 'Invalid PIN',
        attemptsRemaining: 4
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid PIN');
      expect(data.code).toBe('INVALID_PIN');
      expect(data.attemptsRemaining).toBe(4);
    });
  });

  describe('Bearer Token Generation', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
    });

    it('should return 500 when bearer token generation fails', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100'
      });

      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: false,
        error: 'Failed to generate token'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to authenticate with ChipiPay');
      expect(data.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('Approval Execution', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
    });

    it('should successfully execute approval', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100',
        decimals: 18
      });

      mockChipipayService.approve.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { allowance: '100' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.txHash).toBe('0xabcdef...');
      expect(data.data).toEqual({ allowance: '100' });

      // Verify ChipiPay service was called with correct parameters
      expect(mockChipipayService.approve).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100',
        decimals: 18,
        bearerToken: 'bearer-token'
      });

      // Verify operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'approve',
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          100,
          '0x9876543210987654321098765432109876543210987654321098765432109876',
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('testnet'),
          expect.any(Date)
        ])
      );
    });

    it('should successfully execute unlimited approval', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: 'max'
      });

      mockChipipayService.approve.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { allowance: 'unlimited' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify ChipiPay service was called with "max" amount
      expect(mockChipipayService.approve).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: 'max',
        decimals: undefined,
        bearerToken: 'bearer-token'
      });

      // Verify unlimited approval was logged with null amount
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'approve',
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          null, // null for "max" amount
          '0x9876543210987654321098765432109876543210987654321098765432109876',
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('isUnlimitedApproval'),
          expect.any(Date)
        ])
      );
    });

    it('should handle approval failure', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100'
      });

      mockChipipayService.approve.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'Contract not found'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Contract not found');
      expect(data.code).toBe('APPROVE_FAILED');

      // Verify failed operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'approve',
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          100,
          '0x9876543210987654321098765432109876543210987654321098765432109876',
          '',
          'failed',
          'Contract not found',
          expect.any(String),
          null
        ])
      );
    });

    it('should handle approval without optional parameters', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100'
      });

      mockChipipayService.approve.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify ChipiPay service was called without optional parameters
      expect(mockChipipayService.approve).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100',
        decimals: undefined,
        bearerToken: 'bearer-token'
      });
    });
  });

  describe('Security Considerations', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
      mockChipipayService.approve.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });
    });

    it('should log warning for unlimited approvals', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: 'max'
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unlimited approval requested by merchant merchant-123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        spender: '0x9876543210987654321098765432109876543210987654321098765432109876',
        amount: '100'
      });

      mockAuthMiddleware.authenticate.mockRejectedValue(new Error('Database error'));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
      expect(data.code).toBe('INTERNAL_ERROR');
    });
  });
});