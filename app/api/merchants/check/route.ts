// app/api/merchants/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface MerchantCheckRequest {
  walletAddress: string;
  businessEmail?: string;
}

export async function POST(request: NextRequest) {
  // console.log("POST route to check merchant existence");
  
  const client = await pool.connect();
  
  try {
    const data: MerchantCheckRequest = await request.json();

    // console.log("Merchant check data:", data);

    // Validate required fields
    if (!data.walletAddress && !data.businessEmail) {
      return NextResponse.json(
        { error: 'Wallet address or business email is required' },
        { status: 400 }
      );
    }

    // Build query based on provided parameters
    let query = `
      SELECT 
        id,
        wallet_address,
        business_name,
        business_email,
        local_currency,
        supported_currencies,
        contract_registered,
        contract_transaction_hash,
        contract_updated_at,
        metadata,
        created_at,
        updated_at,
        is_verified
      FROM merchants 
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Check by wallet address (primary method)
    if (data.walletAddress) {
      query += ` AND LOWER(wallet_address) = LOWER($${paramIndex})`;
      queryParams.push(data.walletAddress);
      paramIndex++;
    }

    // Check by business email (secondary method)
    if (data.businessEmail) {
      if (data.walletAddress) {
        query += ` OR LOWER(business_email) = LOWER($${paramIndex})`;
      } else {
        query += ` AND LOWER(business_email) = LOWER($${paramIndex})`;
      }
      queryParams.push(data.businessEmail);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 1`;

    // console.log("Executing query:", query, "with params:", queryParams);

    const result = await client.query(query, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'No merchant found with the provided criteria'
      });
    }

    const merchant = result.rows[0];

    // Parse metadata if it exists
    let parsedMetadata = {};
    if (merchant.metadata) {
      try {
        parsedMetadata = typeof merchant.metadata === 'string' 
          ? JSON.parse(merchant.metadata) 
          : merchant.metadata;
      } catch (error) {
        console.warn('Failed to parse merchant metadata:', error);
      }
    }

    // Get recent activity logs for this merchant
    const activityResult = await client.query(
      `SELECT activity_type, description, created_at 
       FROM merchant_activity_logs 
       WHERE merchant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [merchant.id]
    );

    const recentActivity = activityResult.rows;

    const apiKeys = await client.query(
      `SELECT * 
       FROM api_keys
       WHERE merchant_id = $1`,
      [merchant.id]
    );

    const Keys = apiKeys.rows;

    console.log("Found merchant:", {
      id: merchant.id,
      wallet_address: merchant.wallet_address,
      contract_registered: merchant.contract_registered,
    });

    return NextResponse.json({
      success: true,
      exists: true,
      merchant: {
        id: merchant.id,
        wallet_address: merchant.wallet_address,
        business_name: merchant.business_name,
        business_email: merchant.business_email,
        local_currency: merchant.local_currency,
        supported_currencies: merchant.supported_currencies,
        contract_registered: merchant.contract_registered,
        contract_transaction_hash: merchant.contract_transaction_hash,
        contract_updated_at: merchant.contract_updated_at,
        is_verified: merchant.is_verified,
        created_at: merchant.created_at,
        updated_at: merchant.updated_at,
        metadata: parsedMetadata,
        recent_activity: recentActivity,
        // Status information for the frontend
        status: {
          database_registered: true,
          contract_registered: merchant.contract_registered || false,
          verification_required: !merchant.is_verified,
          setup_complete: !!(merchant.contract_registered && merchant.is_verified),
        },
        apikeys: Keys
      }
    });

  } catch (error) {
    console.error('Error checking merchant:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check merchant status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Optional: Add GET method for URL-based queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');
  const businessEmail = searchParams.get('businessEmail');

  if (!walletAddress && !businessEmail) {
    return NextResponse.json(
      { error: 'Wallet address or business email is required as query parameter' },
      { status: 400 }
    );
  }

  // Reuse the POST logic
  const mockRequest = {
    json: async () => ({
      walletAddress: walletAddress || undefined,
      businessEmail: businessEmail || undefined,
    })
  } as NextRequest;

  return POST(mockRequest);
}