import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import KycService from "@/services/kycService";

interface KycVerifyRequest {
  kycId: string;
}

// POST endpoint to verify a specific KYC document
export async function POST(request: NextRequest) {
  console.log("POST route to verify KYC document");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const data: KycVerifyRequest = await request.json();
    console.log("KYC verification request:", data);

    if (!data.kycId) {
      return NextResponse.json(
        { error: "KYC ID is required" },
        { status: 400 }
      );
    }

    // Get the KYC document
    const kycResult = await client.query(
      `SELECT kd.*, m.id as merchant_id, m.wallet_address
       FROM kyc_documents kd
       JOIN merchants m ON kd.merchant_id = m.id
       WHERE kd.id = $1`,
      [data.kycId]
    );

    if (kycResult.rows.length === 0) {
      return NextResponse.json(
        { error: "KYC document not found" },
        { status: 404 }
      );
    }

    const kycDocument = kycResult.rows[0];

    if (kycDocument.status !== 'pending') {
      return NextResponse.json(
        { error: `KYC document is already ${kycDocument.status}` },
        { status: 409 }
      );
    }

    // Verify the document (mock verification)
    const verificationResult = await KycService.verifyDocument(data.kycId);

    let newStatus: 'verified' | 'rejected';
    let proofHash: string | undefined;

    if (verificationResult.verified) {
      newStatus = 'verified';
      proofHash = verificationResult.proofHash;

      // Update KYC document status
      await KycService.updateKycDocumentStatus(data.kycId, 'verified');

      // Update merchant status and proof hash
      await KycService.updateMerchantKycStatus(kycDocument.merchant_id, 'verified', proofHash);

      // Set proof on-chain (mock for now)
      try {
        // Get merchant wallet info for on-chain operation
        const merchantInfo = await client.query(
          `SELECT wallet_encrypted_private_key, wallet_address FROM merchants WHERE id = $1`,
          [kycDocument.merchant_id]
        );

        if (merchantInfo.rows.length > 0 && merchantInfo.rows[0].wallet_encrypted_private_key && proofHash) {
          // Mock on-chain proof setting - in production this would use real wallet credentials
          await KycService.setKycProofOnChain(
            kycDocument.merchant_id,
            proofHash as string,
            merchantInfo.rows[0].wallet_encrypted_private_key,
            merchantInfo.rows[0].wallet_address,
            'mock_encrypt_key', // This would come from the request/user session
            'mock_bearer_token' // This would come from auth
          );
        }
      } catch (onChainError) {
        console.warn('Failed to set KYC proof on-chain, but database updated successfully:', onChainError);
        // Don't fail the entire process if on-chain operation fails
      }

      console.log(`KYC verified for merchant ${kycDocument.merchant_id}, proof hash: ${proofHash}`);

    } else {
      newStatus = 'rejected';

      // Update KYC document status
      await KycService.updateKycDocumentStatus(data.kycId, 'rejected');

      // Update merchant status
      await KycService.updateMerchantKycStatus(kycDocument.merchant_id, 'rejected');

      console.log(`KYC rejected for merchant ${kycDocument.merchant_id}: ${verificationResult.rejectionReason}`);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: `KYC ${newStatus} successfully`,
      status: newStatus,
      proofHash: proofHash,
      rejectionReason: verificationResult.rejectionReason
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error verifying KYC document:", error);
    return NextResponse.json(
      { error: "Failed to verify KYC document" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET endpoint to get all pending KYC documents (for admin processing)
export async function GET(request: NextRequest) {
  console.log("GET route to get pending KYC documents");

  try {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT
          kd.id,
          kd.document_type,
          kd.status,
          kd.created_at,
          m.id as merchant_id,
          m.business_name,
          m.business_email,
          m.wallet_address
         FROM kyc_documents kd
         JOIN merchants m ON kd.merchant_id = m.id
         WHERE kd.status = 'pending'
         ORDER BY kd.created_at ASC`
      );

      return NextResponse.json({
        success: true,
        pendingDocuments: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("Error getting pending KYC documents:", error);
    return NextResponse.json(
      { error: "Failed to get pending KYC documents" },
      { status: 500 }
    );
  }
}