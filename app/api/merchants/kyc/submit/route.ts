import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import pool from "@/lib/db";
import KycService, { KycDocumentData } from "@/services/kycService";

interface KycSubmitRequest {
  documentType: 'passport' | 'id_card' | 'drivers_license' | 'utility_bill';
  encryptedDocument: string; // Base64 encoded encrypted document
  documentHash: string; // Hash of the original document
}

export async function POST(request: NextRequest) {
  console.log("POST route to submit KYC documents");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const data: KycSubmitRequest = await request.json();
    console.log("KYC submission data received");

    // Get Clerk authentication info
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!data.documentType || !data.encryptedDocument || !data.documentHash) {
      return NextResponse.json(
        { error: "Document type, encrypted document, and document hash are required" },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ['passport', 'id_card', 'drivers_license', 'utility_bill'];
    if (!validTypes.includes(data.documentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Find merchant by Clerk user ID
    const merchantResult = await client.query(
      "SELECT id, kyc_status FROM merchants WHERE clerk_user_id = $1",
      [userId]
    );

    if (merchantResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    const merchant = merchantResult.rows[0];

    // Check if merchant already has verified KYC
    if (merchant.kyc_status === 'verified') {
      return NextResponse.json(
        { error: "KYC already verified for this merchant" },
        { status: 409 }
      );
    }

    // Store the encrypted document
    const kycDocumentData: KycDocumentData = {
      documentType: data.documentType,
      encryptedDocument: data.encryptedDocument,
      documentHash: data.documentHash,
      merchantId: merchant.id
    };

    const kycId = await KycService.storeEncryptedDocument(kycDocumentData);

    // Update merchant KYC status to pending
    await KycService.updateMerchantKycStatus(merchant.id, 'pending');

    await client.query("COMMIT");

    console.log(`KYC document submitted successfully for merchant ${merchant.id}, KYC ID: ${kycId}`);

    return NextResponse.json({
      success: true,
      message: "KYC document submitted successfully",
      kycId,
      status: "pending"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error submitting KYC document:", error);
    return NextResponse.json(
      { error: "Failed to submit KYC document" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET endpoint to check KYC status
export async function GET(request: NextRequest) {
  console.log("GET route to check KYC status");

  try {
    // Get Clerk authentication info
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const client = await pool.connect();

    try {
      // Find merchant by Clerk user ID
      const merchantResult = await client.query(
        "SELECT id, kyc_status, kyc_proof_hash FROM merchants WHERE clerk_user_id = $1",
        [userId]
      );

      if (merchantResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Merchant not found" },
          { status: 404 }
        );
      }

      const merchant = merchantResult.rows[0];

      return NextResponse.json({
        success: true,
        kycStatus: merchant.kyc_status,
        proofHash: merchant.kyc_proof_hash
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("Error checking KYC status:", error);
    return NextResponse.json(
      { error: "Failed to check KYC status" },
      { status: 500 }
    );
  }
}