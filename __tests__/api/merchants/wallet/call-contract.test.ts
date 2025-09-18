import { NextRequest } from 'next/server';
import { POST } from '../../../../../app/api/merchants/wallet/call-contract/route';
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

describe('/api/merchants/wallet/call-contract', () => {
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

    it('should return 400 when contract address is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: 'invalid-address',
        entrypoint: 'transfer',
        calldata: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid contract address format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when entrypoint format is invalid', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'invalid-entrypoint!',
        calldata: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid entrypoint format');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when calldata is not an array', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: 'not-an-array'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when calldata array is too large', async () => {
      const largeCalldata = new Array(51).fill('0x123');
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: largeCalldata
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Calldata array too large');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when calldata contains invalid hex string', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['0xinvalid-hex']
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid hex string in calldata parameter 0');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when calldata contains string that is too long', async () => {
      const longString = 'a'.repeat(1001);
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: [longString]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Calldata parameter 0 is too long');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });

    it('should return 400 when calldata contains invalid number', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: [-1]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid number in calldata parameter 0');
      expect(data.code).toBe('INVALID_PARAMETERS');
    });
  });

  describe('Security Checks', () => {
    beforeEach(() => {
      mockAuthMiddleware.authenticate.mockResolvedValue(mockMerchant);
    });

    it('should block dangerous entrypoints', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer_ownership',
        calldata: ['0x9876543210987654321098765432109876543210987654321098765432109876']
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('potentially dangerous operations');
      expect(data.code).toBe('DANGEROUS_OPERATION');
    });

    it('should log warning for dangerous entrypoints', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'upgrade',
        calldata: []
      });

      await POST(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Potentially dangerous contract call by merchant merchant-123')
      );

      consoleSpy.mockRestore();
    });

    it('should allow safe entrypoints', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['0x9876543210987654321098765432109876543210987654321098765432109876', '1000']
      });

      mockWalletCrypto.validatePinAndDecryptWallet.mockResolvedValue({
        success: true,
        privateKey: 'decrypted-private-key'
      });
      mockChipiPayAuth.getBearerToken.mockResolvedValue({
        success: true,
        token: 'bearer-token'
      });
      mockChipipayService.callAnyContract.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: {}
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Contract Call Execution', () => {
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

    it('should successfully execute contract call', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['0x9876543210987654321098765432109876543210987654321098765432109876', '1000']
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: true,
        txHash: '0xabcdef...',
        data: { result: 'success' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.txHash).toBe('0xabcdef...');
      expect(data.data.contractAddress).toBe('0x1234567890123456789012345678901234567890123456789012345678901234');
      expect(data.data.entrypoint).toBe('transfer');
      expect(data.data.calldataLength).toBe(2);

      // Verify ChipiPay service was called with correct parameters
      expect(mockChipipayService.callAnyContract).toHaveBeenCalledWith({
        privateKey: 'decrypted-private-key',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['0x9876543210987654321098765432109876543210987654321098765432109876', '1000'],
        bearerToken: 'bearer-token'
      });

      // Verify operation was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_operations_log'),
        expect.arrayContaining([
          'merchant-123',
          'contract_call',
          '0x1234567890123456789012345678901234567890123456789012345678901234',
          null,
          undefined,
          '0xabcdef...',
          'completed',
          undefined,
          expect.stringContaining('transfer'),
          expect.any(Date)
        ])
      );
    });

    it('should handle contract not found error', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: []
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'contract not found at address'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Contract not found at the specified address');
      expect(data.code).toBe('CONTRACT_CALL_FAILED');
    });

    it('should handle entrypoint not found error', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'nonexistent_function',
        calldata: []
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'entrypoint not found in contract'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Entrypoint 'nonexistent_function' not found in contract");
      expect(data.code).toBe('CONTRACT_CALL_FAILED');
    });

    it('should handle invalid calldata error', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['invalid-param']
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'invalid calldata provided'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid parameters provided for contract call');
      expect(data.code).toBe('CONTRACT_CALL_FAILED');
    });

    it('should handle execution reverted error', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: ['0x9876543210987654321098765432109876543210987654321098765432109876', '1000000']
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'execution reverted: insufficient balance'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Contract execution failed. Check parameters and contract state');
      expect(data.code).toBe('CONTRACT_CALL_FAILED');
    });

    it('should handle unauthorized error', async () => {
      const request = mockRequest({
        pin: '1234',
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'admin_function',
        calldata: []
      });

      mockChipipayService.callAnyContract.mockResolvedValue({
        success: false,
        txHash: '',
        error: 'unauthorized caller'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Wallet not authorized to call this contract function');
      expect(data.code).toBe('CONTRACT_CALL_FAILED');
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
        entrypoint: 'transfer',
        calldata: []
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
        contractAddress: '0x1234567890123456789012345678901234567890123456789012345678901234',
        entrypoint: 'transfer',
        calldata: []
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