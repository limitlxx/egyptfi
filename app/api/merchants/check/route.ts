import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Check if merchant exists in database
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, wallet_address, business_name, business_email, created_at FROM merchants WHERE wallet_address = $1',
        [walletAddress.toLowerCase()]
      );

      const merchant = result.rows[0];

      return NextResponse.json({
        exists: !!merchant,
        merchant: merchant ? {
          id: merchant.id,
          walletAddress: merchant.wallet_address,
          businessName: merchant.business_name,
          businessEmail: merchant.business_email,
          createdAt: merchant.created_at
        } : null
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error checking merchant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}