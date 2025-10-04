// app/api/merchants/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db'; 

interface LoginRequest {
  email: string;
  environment?: 'testnet' | 'mainnet';
}

interface LoginResponse {
  success: boolean;
  message: string;
  merchant?: {
    id: string;
    wallet_address: string;
    business_name: string;
    business_email: string;
    apikeys: {
      testnet: { public_key: string; jwt: string };
      mainnet: { public_key: string; jwt: string };
    };
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const data: LoginRequest = await request.json();
    console.log('DATABASE', data);
    

    // Validate input
    if (!data.email) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );0
    }

    // Check environment secrets
    if (!process.env.NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET || !process.env.EGYPTFI_MAINNET_SECRET) {
      console.error('Login error: Missing EGYPTFI_TESTNET_SECRET or EGYPTFI_MAINNET_SECRET');
      return NextResponse.json(
        { success: false, error: 'Server configuration error. Contact support.' },
        { status: 500 }
      );
    }

    // Check if merchant exists
    const merchantResult = await client.query(
      `SELECT 
        id,
        wallet_address,
        business_name,
        business_email,
        webhook,
        business_logo,
        phone,
        is_verified,
        local_currency,
        created_at
       FROM merchants 
       WHERE LOWER(business_email) = LOWER($1)`,
      [data.email]
    );

    if (merchantResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No merchant found with this wallet address' },
        { status: 404 }
      );
    }

    const merchant = merchantResult.rows[0];

    if (!merchant.is_verified) {
      return NextResponse.json(
        { success: false, error: 'Merchant account is not verified' },
        { status: 403 }
      );
    }

    // Retrieve API keys
    const apiKeysResult = await client.query(
      `SELECT public_key, secret_key 
       FROM api_keys 
       WHERE merchant_id = $1`,
      [merchant.id]
    );

    const testnetKey = apiKeysResult.rows.find(key => key.public_key.startsWith('pk_test_'));
    const mainnetKey = apiKeysResult.rows.find(key => key.public_key.startsWith('pk_live_'));

    if (!testnetKey || !mainnetKey) {
      return NextResponse.json(
        { success: false, error: 'API keys not found. Contact support or re-register.' },
        { status: 500 }
      );
    }

    // Log login activity
    await client.query(
      `INSERT INTO merchant_activity_logs 
       (merchant_id, activity_type, description, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [merchant.id, 'login', 'Successful wallet-based login']
    );

    return NextResponse.json({
      success: true,
      message: 'Wallet login successful',
      merchant: {
        id: merchant.id,
        wallet_address: merchant.wallet_address,
        business_name: merchant.business_name,
        business_email: merchant.business_email,
        webhook: merchant.webhook,
        phone: merchant.phone,
        local_currency: merchant.local_currency,
        business_logo: merchant.business_logo,
        apikeys: {
          testnet: {
            public_key: testnetKey.public_key,
          },
          mainnet: {
            public_key: mainnetKey.public_key,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error processing login:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process login',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}