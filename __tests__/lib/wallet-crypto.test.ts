// __tests__/lib/wallet-crypto.test.ts
import { WalletCrypto } from '../../lib/wallet-crypto';
import pool from '../../lib/db';

// Mock the database pool
jest.mock('../../lib/db', () => ({
  connect: jest.fn(),
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('WalletCrypto', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
    
    // Clear failed attempts before each test
    const failedAttempts = (WalletCrypto as any).failedAttempts;
    if (failedAttempts) {
      failedAttempts.clear();
    }
  });

  describe('encryptPrivateKey and decryptPrivateKey', () => {
    it('should encrypt and decrypt private key successfully', () => {
      const privateKey = '0x1234567890abcdef';
      const pin = '123456';

      const encrypted = WalletCrypto.encryptPrivateKey(privateKey, pin);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(privateKey);

      const decrypted = WalletCrypto.decryptPrivateKey(encrypted, pin);
      expect(decrypted.success).toBe(true);
      expect(decrypted.privateKey).toBe(privateKey);
    });

    it('should fail decryption with wrong PIN', () => {
      const privateKey = '0x1234567890abcdef';
      const correctPin = '123456';
      const wrongPin = '654321';

      const encrypted = WalletCrypto.encryptPrivateKey(privateKey, correctPin);
      const decrypted = WalletCrypto.decryptPrivateKey(encrypted, wrongPin);
      
      expect(decrypted.success).toBe(false);
      expect(decrypted.error).toBe('Invalid PIN or corrupted data');
    });

    it('should handle different PIN lengths', () => {
      const privateKey = '0x1234567890abcdef';
      const pins = ['1234', '12345', '123456', '1234567', '12345678'];

      pins.forEach(pin => {
        const encrypted = WalletCrypto.encryptPrivateKey(privateKey, pin);
        const decrypted = WalletCrypto.decryptPrivateKey(encrypted, pin);
        
        expect(decrypted.success).toBe(true);
        expect(decrypted.privateKey).toBe(privateKey);
      });
    });

    it('should produce different encrypted values for same input', () => {
      const privateKey = '0x1234567890abcdef';
      const pin = '123456';

      const encrypted1 = WalletCrypto.encryptPrivateKey(privateKey, pin);
      const encrypted2 = WalletCrypto.encryptPrivateKey(privateKey, pin);
      
      expect(encrypted1).not.toBe(encrypted2); // Different due to random salt and IV
    });

    it('should handle invalid encrypted data', () => {
      const invalidData = 'invalid_base64_data';
      const pin = '123456';

      const result = WalletCrypto.decryptPrivateKey(invalidData, pin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid PIN or corrupted data');
    });
  });

  describe('validatePinAndDecryptWallet', () => {
    const merchantId = 'merchant-123';
    const validPin = '123456';
    const privateKey = '0x1234567890abcdef';
    const encryptedPrivateKey = WalletCrypto.encryptPrivateKey(privateKey, validPin);

    it('should validate PIN and return private key', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: encryptedPrivateKey
        }]
      });

      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, validPin);
      
      expect(result.success).toBe(true);
      expect(result.privateKey).toBe(privateKey);
    });

    it('should reject invalid PIN format', async () => {
      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, 'abc');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
      expect(result.attemptsRemaining).toBe(4); // 5 - 1 failed attempt
    });

    it('should reject PIN that is too short', async () => {
      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, '123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
    });

    it('should reject PIN that is too long', async () => {
      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, '123456789');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('PIN must be 4-8 digits');
    });

    it('should handle merchant not found', async () => {
      mockClient.query.mockResolvedValue({
        rows: []
      });

      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, validPin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Merchant not found');
    });

    it('should handle merchant without wallet', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: null
        }]
      });

      const result = await WalletCrypto.validatePinAndDecryptWallet(merchantId, validPin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No wallet found for merchant');
    });

    it('should track failed attempts', async () => {
      const testMerchantId = 'merchant-track-attempts';
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: encryptedPrivateKey
        }]
      });

      const wrongPin = '654321';
      
      // First failed attempt
      let result = await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, wrongPin);
      expect(result.success).toBe(false);
      expect(result.attemptsRemaining).toBe(4);

      // Second failed attempt
      result = await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, wrongPin);
      expect(result.success).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
    });

    it('should lockout after max failed attempts', async () => {
      const testMerchantId = 'merchant-lockout-test';
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: encryptedPrivateKey
        }]
      });

      const wrongPin = '654321';
      
      // Exhaust all attempts
      for (let i = 0; i < 5; i++) {
        await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, wrongPin);
      }

      // Next attempt should be locked out
      const result = await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, validPin);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Account locked');
    });

    it('should clear failed attempts on successful validation', async () => {
      const testMerchantId = 'merchant-clear-attempts';
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: encryptedPrivateKey
        }]
      });

      const wrongPin = '654321';
      
      // Make some failed attempts
      await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, wrongPin);
      await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, wrongPin);
      
      // Successful attempt should clear failed attempts
      const result = await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, validPin);
      expect(result.success).toBe(true);
      
      // Check that attempts were cleared
      expect(WalletCrypto.getRemainingAttempts(testMerchantId)).toBe(5);
    });

    it('should handle database errors', async () => {
      const testMerchantId = 'merchant-db-error';
      mockClient.query.mockRejectedValue(new Error('Database error'));

      const result = await WalletCrypto.validatePinAndDecryptWallet(testMerchantId, validPin);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('PIN validation failed');
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return max attempts for new merchant', () => {
      const attempts = WalletCrypto.getRemainingAttempts('new-merchant');
      expect(attempts).toBe(5);
    });

    it('should return 0 for locked merchant', async () => {
      const merchantId = 'locked-merchant';
      const wrongPin = '000000';
      
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: 'dummy_encrypted_key'
        }]
      });

      // Exhaust all attempts
      for (let i = 0; i < 5; i++) {
        await WalletCrypto.validatePinAndDecryptWallet(merchantId, wrongPin);
      }

      const attempts = WalletCrypto.getRemainingAttempts(merchantId);
      expect(attempts).toBe(0);
    });
  });

  describe('isAccountLocked', () => {
    it('should return false for new merchant', () => {
      const locked = WalletCrypto.isAccountLocked('new-merchant');
      expect(locked).toBe(false);
    });

    it('should return true for locked merchant', async () => {
      const merchantId = 'locked-merchant-2';
      const wrongPin = '000000';
      
      mockClient.query.mockResolvedValue({
        rows: [{
          wallet_encrypted_private_key: 'dummy_encrypted_key'
        }]
      });

      // Exhaust all attempts
      for (let i = 0; i < 5; i++) {
        await WalletCrypto.validatePinAndDecryptWallet(merchantId, wrongPin);
      }

      const locked = WalletCrypto.isAccountLocked(merchantId);
      expect(locked).toBe(true);
    });
  });
});