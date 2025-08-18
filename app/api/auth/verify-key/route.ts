// app/api/auth/verify-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface VerifyKeyRequest {
  publicKey: string;
  walletAddress: string;
}

interface VerifyKeyResponse {
  success: boolean;
  merchant?: {
    id: string;
    walletAddress: string;
    businessName: string;
    environment: 'testnet' | 'mainnet';
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { publicKey, walletAddress }: VerifyKeyRequest = await request.json();
    
    if (!publicKey || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Public key and wallet address are required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Find merchant by wallet address and verify they have this public key
      const result = await client.query(
        `SELECT 
          m.id,
          m.wallet_address,
          m.business_name,
          m.is_verified,
          ak.public_key
         FROM merchants m
         JOIN api_keys ak ON m.id = ak.merchant_id
         WHERE LOWER(m.wallet_address) = LOWER($1) 
         AND ak.public_key = $2
         AND m.is_verified = true`,
        [walletAddress, publicKey]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid public key or wallet address' },
          { status: 401 }
        );
      }

      const merchant = result.rows[0];
      
      // Determine environment from public key prefix
      const environment = publicKey.startsWith('pk_test_') ? 'testnet' : 'mainnet';

      return NextResponse.json({
        success: true,
        merchant: {
          id: merchant.id,
          walletAddress: merchant.wallet_address,
          businessName: merchant.business_name,
          environment,
        },
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Public key verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify public key',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}