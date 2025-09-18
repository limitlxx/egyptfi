import { NextRequest } from 'next/server';
import { POST } from '../../../../../app/api/merchants/wallet/withdraw-vesu-usdc/route';
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

describe('/api/merchants/wallet/withdraw-vesu-usdc', () => {
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

    it('should return 400 when amount is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: 'invalid',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Amount must be a positive number or "max"');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should accept "max" as a valid amount for full withdrawal', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: 'max',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 400 when amount is below minimum', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '0.005',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Minimum withdrawal amount is 0.01 USDC');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when recipient address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: 'invalid-address'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid recipient address format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });
  });

  describe('VESU Withdrawal Execution', () => {
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

    it('should successfully execute VESU USDC withdrawal', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '50',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { 
          withdrawnAmount: '50',
          remainingStake: '50',
          rewards: '2.5'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.txHash).toBe('0xabcdef...');
      expect(data.data.protocol).toBe('VESU');
      expect(data.data.asset).toBe('USDC');
      expect(data.data.withdrawnAmount).toBe('50');

      // Verify ChipiPay service was called with correct parameters
      expect(mockChipipayService.withdrawVesuUsdc).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        amount: '50',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234',
        bearerToken: 'bearer-token'
      });

      // Verify operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'withdraw_vesu_usdc',
          undefined,
          50,
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('VESU'),
          expect.any(Date)
        ])
      );
    });

    it('should successfully execute full VESU USDC withdrawal', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: 'max',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { 
          withdrawnAmount: '100',
          remainingStake: '0',
          rewards: '5.2'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify full withdrawal was logged with null amount
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'withdraw_vesu_usdc',
          undefined,
          null, // null for "max" amount
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('isFullWithdrawal'),
          expect.any(Date)
        ])
      );
    });

    it('should handle insufficient staked balance error', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'insufficient staked balance for withdrawal'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient staked USDC balance for withdrawal');
      expect(data.code).toBe('VESU_WITHDRAW_FAILED');
    });

    it('should handle withdrawal limit error', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'withdrawal limit exceeded'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Daily withdrawal limit exceeded');
      expect(data.code).toBe('VESU_WITHDRAW_FAILED');
    });

    it('should handle cooldown period error', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'cooldown period not elapsed'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Withdrawal cooldown period has not elapsed');
      expect(data.code).toBe('VESU_WITHDRAW_FAILED');
    });

    it('should handle liquidity error', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'insufficient liquidity in pool'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient liquidity in VESU pool for withdrawal');
      expect(data.code).toBe('VESU_WITHDRAW_FAILED');
    });

    it('should handle contract paused error', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
      });

      mockChipipayService.withdrawVesuUsdc.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'contract paused for maintenance'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VESU withdrawals are temporarily paused');
      expect(data.code).toBe('VESU_WITHDRAW_FAILED');
    });
  });

  describe('PIN Validation', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
    });

    it('should return 401 when PIN is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
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

  describe('Error Handling', () => {
    it('should handle unexpected errors', async () => {
      const request = mockRequest({
        pin: '1234',
        amount: '100',
        recipient: '0x1234567890123456789012345678901234567890123456789012345678901234'
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