import { NextRequest } from 'next/server';
import { POST } from '../../../../../app/api/merchants/wallet/transfer/route';
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

describe('/api/merchants/wallet/transfer', () => {
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

    it('should return 401 when API key is invalid', async () => {
      const request = mockRequest({});
      mockAuthMiddleware.authenticate.mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'Invalid API key' }), { status: 401 })
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

    it('should return 400 when recipient address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: 'invalid-address',
        amount: '100'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid recipient address format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when amount is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: 'invalid'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Amount must be a positive number');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when amount is negative', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '-100'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Amount must be a positive number');
    });

    it('should return 400 when contract address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100',
        contractAddress: 'invalid-contract'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid contract address format');
    });

    it('should return 400 when decimals is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
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
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
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

    it('should return 401 when account is locked', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100'
      });

      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: false,
        error: 'Account locked due to too many failed attempts. Try again in 15 minutes.'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Account locked');
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
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
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

  describe('Transfer Execution', () => {
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

    it('should successfully execute transfer', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100',
        contractAddress: '0x9876543210987654321098765432109876543210987654321098765432109876',
        decimals: 18
      });

      mockChipipayService.transfer.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { blockNumber: 12345 }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.txHash).toBe('0xabcdef...');
      expect(data.data).toEqual({ blockNumber: 12345 });

      // Verify ChipiPay service was called with correct parameters
      expect(mockChipipayService.transfer).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100',
        contractAddress: '0x9876543210987654321098765432109876543210987654321098765432109876',
        decimals: 18,
        bearerToken: 'bearer-token'
      });

      // Verify operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'transfer',
          '0x9876543210987654321098765432109876543210987654321098765432109876',
          100,
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('testnet'),
          expect.any(Date)
        ])
      );
    });

    it('should handle transfer failure', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100'
      });

      mockChipipayService.transfer.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'Insufficient balance'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient balance');
      expect(data.code).toBe('TRANSFER_FAILED');

      // Verify failed operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'transfer',
          undefined,
          100,
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '',
          'failed',
          'Insufficient balance',
          expect.any(String),
          null
        ])
      );
    });

    it('should handle transfer without optional parameters', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100'
      });

      mockChipipayService.transfer.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify ChipiPay service was called without optional parameters
      expect(mockChipipayService.transfer).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100',
        contractAddress: undefined,
        decimals: undefined,
        bearerToken: 'bearer-token'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
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

    it('should handle database logging errors gracefully', async () => {
      const request = mockRequest({
        pin: '1234',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '100'
      });

      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
      mockChipipayService.transfer.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      // Mock database error
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed even if logging fails
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});