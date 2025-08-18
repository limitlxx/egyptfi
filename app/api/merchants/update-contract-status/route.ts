// app/api/merchants/update-contract-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface UpdateContractStatusRequest {
  merchantId: string;
  contractRegistered: boolean;
  contractData?: {
    transactionHash?: string;
    nameAsFelt?: string;
    emailAsFelt?: string;
    withdrawalAddress?: string;
    feePercentage?: number;
    blockNumber?: number;
    confirmationTime?: string;
  };
}

export async function POST(request: NextRequest) {
  console.log("POST route to update merchant contract status");
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const data: UpdateContractStatusRequest = await request.json();

    console.log("Contract status update data:", data);

    // Validate required fields
    if (!data.merchantId) {
      return NextResponse.json(
        { error: 'Merchant ID is required' },
        { status: 400 }
      );
    }

    // Check if merchant exists
    const existingMerchant = await client.query(
      'SELECT id, wallet_address, business_name, business_email FROM merchants WHERE id = $1',
      [data.merchantId]
    );

    if (existingMerchant.rows.length === 0) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const merchant = existingMerchant.rows[0];

    // Prepare update data
    const updateData: any = {
      contract_registered: data.contractRegistered,
      contract_updated_at: new Date().toISOString(),
    };

    // Add contract-specific data if provided
    if (data.contractData) {
      if (data.contractData.transactionHash) {
        updateData.contract_transaction_hash = data.contractData.transactionHash;
      }

      // Store contract registration data as JSON
      const contractMetadata = {
        transactionHash: data.contractData.transactionHash,
        nameAsFelt: data.contractData.nameAsFelt,
        emailAsFelt: data.contractData.emailAsFelt,
        withdrawalAddress: data.contractData.withdrawalAddress,
        feePercentage: data.contractData.feePercentage,
        blockNumber: data.contractData.blockNumber,
        confirmationTime: data.contractData.confirmationTime || new Date().toISOString(),
        registeredAt: new Date().toISOString(),
      };

      // Update existing metadata to include contract data
      const currentMetadataResult = await client.query(
        'SELECT metadata FROM merchants WHERE id = $1',
        [data.merchantId]
      );

      const currentMetadata = currentMetadataResult.rows[0]?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        contractRegistration: contractMetadata,
      };

      updateData.metadata = JSON.stringify(updatedMetadata);
    }

    // Build dynamic update query
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const updateQuery = `
      UPDATE merchants 
      SET ${setClause}
      WHERE id = $1 
      RETURNING id, wallet_address, business_name, business_email, contract_registered, contract_transaction_hash, contract_updated_at, metadata
    `;

    const updateResult = await client.query(updateQuery, [data.merchantId, ...updateValues]);
    const updatedMerchant = updateResult.rows[0];

    // Log the successful update
    await client.query(
      `INSERT INTO merchant_activity_logs (merchant_id, activity_type, description, metadata, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        data.merchantId,
        'CONTRACT_STATUS_UPDATE',
        `Contract registration status updated to: ${data.contractRegistered}`,
        JSON.stringify({
          contractRegistered: data.contractRegistered,
          transactionHash: data.contractData?.transactionHash,
          updatedBy: 'system',
        }),
      ]
    );

    await client.query('COMMIT');

    console.log("Successfully updated merchant contract status:", {
      merchantId: data.merchantId,
      contractRegistered: data.contractRegistered,
      transactionHash: data.contractData?.transactionHash,
    });

    return NextResponse.json({
      success: true,
      message: 'Merchant contract status updated successfully',
      merchant: {
        id: updatedMerchant.id,
        wallet_address: updatedMerchant.wallet_address,
        business_name: updatedMerchant.business_name,
        business_email: updatedMerchant.business_email,
        contract_registered: updatedMerchant.contract_registered,
        contract_transaction_hash: updatedMerchant.contract_transaction_hash,
        contract_updated_at: updatedMerchant.contract_updated_at,
        metadata: updatedMerchant.metadata,
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating merchant contract status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update merchant contract status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Optional: Add GET method to retrieve contract status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const merchantId = searchParams.get('merchantId');

  if (!merchantId) {
    return NextResponse.json(
      { error: 'Merchant ID is required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT id, wallet_address, business_name, contract_registered, 
       contract_transaction_hash, contract_updated_at, metadata 
       FROM merchants WHERE id = $1`,
      [merchantId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const merchant = result.rows[0];

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        wallet_address: merchant.wallet_address,
        business_name: merchant.business_name,
        contract_registered: merchant.contract_registered,
        contract_transaction_hash: merchant.contract_transaction_hash,
        contract_updated_at: merchant.contract_updated_at,
        contractMetadata: merchant.metadata?.contractRegistration || null,
      },
    });

  } catch (error) {
    console.error('Error retrieving merchant contract status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve merchant contract status' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}