import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, JWTPayload } from '@/lib/jwt';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Verify: Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify merchant exists and is still valid
    const client = await pool.connect();
    try {
      const merchantResult = await client.query(
        `SELECT id, wallet_address, is_verified 
         FROM merchants 
         WHERE id = $1 AND LOWER(wallet_address) = LOWER($2)`,
        [payload.merchantId, payload.walletAddress]
      );

      if (merchantResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Merchant not found' },
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

      return NextResponse.json({
        success: true,
        message: 'Token is valid',
        merchant: {
          id: merchant.id,
          wallet_address: merchant.wallet_address
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}