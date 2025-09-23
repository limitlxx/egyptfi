import KycService from '../kycService';
import pool from '@/lib/db';

// Mock the database pool
jest.mock('@/lib/db', () => ({
  connect: jest.fn(),
}));

// Mock ContractMerchantService
jest.mock('../contractMerchantService', () => {
  return jest.fn().mockImplementation(() => ({
    setKycProof: jest.fn().mockResolvedValue('0xmock_tx_hash'),
    getKycProof: jest.fn().mockResolvedValue('0xmock_proof_hash'),
    verifyKycProof: jest.fn().mockResolvedValue(true),
  }));
});

describe('KycService', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeEncryptedDocument', () => {
    it('should store encrypted KYC document successfully', async () => {
      const mockResult = { rows: [{ id: 'test-kyc-id' }] };
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce(mockResult) // INSERT
        .mockResolvedValueOnce(undefined); // COMMIT

      const documentData = {
        documentType: 'passport' as const,
        encryptedDocument: 'base64encrypteddata',
        documentHash: 'sha256hash',
        merchantId: 'merchant-123'
      };

      const result = await KycService.storeEncryptedDocument(documentData);

      expect(result).toBe('test-kyc-id');
      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        `INSERT INTO kyc_documents (merchant_id, document_type, encrypted_document, document_hash, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING id`,
        ['merchant-123', 'passport', 'base64encrypteddata', 'sha256hash']
      );
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      const documentData = {
        documentType: 'passport' as const,
        encryptedDocument: 'base64encrypteddata',
        documentHash: 'sha256hash',
        merchantId: 'merchant-123'
      };

      await expect(KycService.storeEncryptedDocument(documentData)).rejects.toThrow('Failed to store KYC document');
    });
  });

  describe('verifyDocument', () => {
    it('should verify document and return proof hash when approved', async () => {
      // Mock Math.random to return 0.8 (approved)
      jest.spyOn(Math, 'random').mockReturnValue(0.8);

      const result = await KycService.verifyDocument('kyc-123');

      expect(result.verified).toBe(true);
      expect(result.proofHash).toBeDefined();
      expect(result.proofHash?.length).toBe(64); // SHA-256 hash length
    });

    it('should reject document when verification fails', async () => {
      // Mock Math.random to return 0.2 (rejected)
      jest.spyOn(Math, 'random').mockReturnValue(0.2);

      const result = await KycService.verifyDocument('kyc-123');

      expect(result.verified).toBe(false);
      expect(result.rejectionReason).toBeDefined();
      expect(result.proofHash).toBeUndefined();
    });
  });

  describe('generateStarkProof', () => {
    it('should generate a valid proof hash', async () => {
      const proofHash = await KycService.generateStarkProof('kyc-123');

      expect(proofHash).toBeDefined();
      expect(typeof proofHash).toBe('string');
      expect(proofHash.length).toBe(64); // SHA-256 hash length
      expect(/^[a-f0-9]+$/.test(proofHash)).toBe(true); // Should be hexadecimal
    });

    it('should generate different hashes for different inputs', async () => {
      const proofHash1 = await KycService.generateStarkProof('kyc-123');
      const proofHash2 = await KycService.generateStarkProof('kyc-456');

      expect(proofHash1).not.toBe(proofHash2);
    });
  });

  describe('updateMerchantKycStatus', () => {
    it('should update merchant KYC status successfully', async () => {
      const mockResult = { rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await KycService.updateMerchantKycStatus('merchant-123', 'verified', 'proof-hash-123');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        `UPDATE merchants
         SET kyc_status = $1, kyc_proof_hash = $2, updated_at = NOW()
         WHERE id = $3`,
        ['verified', 'proof-hash-123', 'merchant-123']
      );
    });

    it('should handle null proof hash', async () => {
      const mockResult = { rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await KycService.updateMerchantKycStatus('merchant-123', 'pending');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        ['pending', null, 'merchant-123']
      );
    });
  });

  describe('updateKycDocumentStatus', () => {
    it('should update KYC document status successfully', async () => {
      const mockResult = { rowCount: 1 };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await KycService.updateKycDocumentStatus('kyc-123', 'verified');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        `UPDATE kyc_documents SET status = $1, updated_at = NOW() WHERE id = $2`,
        ['verified', 'kyc-123']
      );
    });
  });

  describe('getMerchantKycStatus', () => {
    it('should return merchant KYC status', async () => {
      const mockResult = {
        rows: [{
          kyc_status: 'verified',
          kyc_proof_hash: 'proof-hash-123'
        }]
      };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await KycService.getMerchantKycStatus('merchant-123');

      expect(result).toEqual({
        kyc_status: 'verified',
        kyc_proof_hash: 'proof-hash-123'
      });
    });

    it('should return null when merchant not found', async () => {
      const mockResult = { rows: [] };
      mockClient.query.mockResolvedValue(mockResult);

      const result = await KycService.getMerchantKycStatus('merchant-123');

      expect(result).toBeNull();
    });
  });

  describe('verifyProofOnChain', () => {
    it('should verify proof on-chain successfully', async () => {
      const validProofHash = 'a'.repeat(64); // 64 character hash
      const result = await KycService.verifyProofOnChain(validProofHash, 'merchant-address');

      expect(result).toBe(true);
    });

    it('should return false for invalid proof', async () => {
      const result = await KycService.verifyProofOnChain('', 'merchant-address');

      expect(result).toBe(false);
    });

    it('should return false for proof hash with wrong length', async () => {
      const result = await KycService.verifyProofOnChain('short-hash', 'merchant-address');

      expect(result).toBe(false);
    });
  });
});