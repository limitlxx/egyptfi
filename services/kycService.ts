// services/kycService.ts
import crypto from 'crypto';
import pool from '@/lib/db';
import ContractMerchantService from './contractMerchantService';

export interface KycDocumentData {
  documentType: 'passport' | 'id_card' | 'drivers_license' | 'utility_bill';
  encryptedDocument: string; // Base64 encoded encrypted document
  documentHash: string; // Hash of the original document for integrity
  merchantId: string;
}

export interface KycSubmissionResult {
  success: boolean;
  kycId?: string;
  proofHash?: string;
  status?: 'pending' | 'verified' | 'rejected';
  error?: string;
}

export interface KycVerificationResult {
  verified: boolean;
  proofHash?: string;
  rejectionReason?: string;
}

class KycService {
  // Store encrypted KYC document (never store raw data)
  static async storeEncryptedDocument(data: KycDocumentData): Promise<string> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert encrypted document record
      const result = await client.query(
        `INSERT INTO kyc_documents (merchant_id, document_type, encrypted_document, document_hash, status, created_at)
         VALUES ($1, $2, $3, $4, 'pending', NOW()) RETURNING id`,
        [
          data.merchantId,
          data.documentType,
          data.encryptedDocument,
          data.documentHash
        ]
      );

      await client.query('COMMIT');
      return result.rows[0].id;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing encrypted KYC document:', error);
      throw new Error('Failed to store KYC document');
    } finally {
      client.release();
    }
  }

  // Mock KYC verification (in production, this would involve manual review or AI)
  static async verifyDocument(kycId: string): Promise<KycVerificationResult> {
    try {
      // For demo purposes, randomly approve/reject
      // In production, this would be a manual process or AI-powered verification
      const isVerified = Math.random() > 0.3; // 70% approval rate for demo

      if (isVerified) {
        // Generate STARK proof hash (mock implementation)
        const proofHash = await this.generateStarkProof(kycId);

        return {
          verified: true,
          proofHash
        };
      } else {
        return {
          verified: false,
          rejectionReason: 'Document quality insufficient or information unclear'
        };
      }
    } catch (error) {
      console.error('Error verifying document:', error);
      return {
        verified: false,
        rejectionReason: 'Verification process failed'
      };
    }
  }

  // Mock STARK proof generation using Garaga Toolkit
  // In production, this would integrate with actual Garaga Toolkit
  static async generateStarkProof(kycId: string): Promise<string> {
    try {
      // Mock implementation - in production, use Garaga Toolkit
      // This would generate a real STARK proof of KYC verification

      // For now, create a deterministic hash based on kycId and timestamp
      const timestamp = Date.now().toString();
      const proofData = `kyc_verified_${kycId}_${timestamp}`;

      // Generate SHA-256 hash as mock proof
      const proofHash = crypto.createHash('sha256').update(proofData).digest('hex');

      console.log(`Generated mock STARK proof for KYC ${kycId}: ${proofHash}`);

      return proofHash;
    } catch (error) {
      console.error('Error generating STARK proof:', error);
      throw new Error('Failed to generate proof');
    }
  }

  // Update merchant KYC status and proof hash
  static async updateMerchantKycStatus(
    merchantId: string,
    status: 'pending' | 'verified' | 'rejected',
    proofHash?: string
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE merchants
         SET kyc_status = $1, kyc_proof_hash = $2, updated_at = NOW()
         WHERE id = $3`,
        [status, proofHash || null, merchantId]
      );

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating merchant KYC status:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Set KYC proof on-chain after verification
  static async setKycProofOnChain(
    merchantId: string,
    proofHash: string,
    encryptedPrivateKey: string,
    walletAddress: string,
    encryptKey: string,
    bearerToken: string
  ): Promise<string> {
    try {
      // Get contract service instance (you might need to pass provider)
      const contractService = new ContractMerchantService(null); // Provider will be handled internally

      const txHash = await contractService.setKycProof(
        encryptedPrivateKey,
        walletAddress,
        proofHash,
        encryptKey,
        bearerToken
      );

      console.log(`KYC proof set on-chain for merchant ${merchantId}: ${txHash}`);
      return txHash;
    } catch (error) {
      console.error('Error setting KYC proof on-chain:', error);
      throw new Error('Failed to set proof on-chain');
    }
  }

  // Update KYC document status
  static async updateKycDocumentStatus(
    kycId: string,
    status: 'pending' | 'verified' | 'rejected'
  ): Promise<boolean> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `UPDATE kyc_documents SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, kycId]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error updating KYC document status:', error);
      return false;
    } finally {
      client.release();
    }
  }

  // Get merchant KYC status
  static async getMerchantKycStatus(merchantId: string): Promise<any> {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT kyc_status, kyc_proof_hash FROM merchants WHERE id = $1`,
        [merchantId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting merchant KYC status:', error);
      return null;
    } finally {
      client.release();
    }
  }

  // Verify proof hash on-chain (mock implementation)
  static async verifyProofOnChain(proofHash: string, merchantAddress: string): Promise<boolean> {
    try {
      // Mock on-chain verification
      // In production, this would call the smart contract to verify the proof

      console.log(`Mock verifying proof ${proofHash} for merchant ${merchantAddress}`);

      // For demo, always return true if proof hash exists
      return !!proofHash && proofHash.length === 64;
    } catch (error) {
      console.error('Error verifying proof on-chain:', error);
      return false;
    }
  }
}

export default KycService;