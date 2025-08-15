import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { token, publicKey } = await request.json();

    if (!token && !publicKey) {
      return NextResponse.json(
        { error: 'Token or public key required' },
        { status: 400 }
      );
    }

    let merchantId: string;

    if (token) {
      // Verify JWT token
      const payload = verifyJWT(token);
      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      merchantId = payload.merchantId;
    } else {
      // Verify public key
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT merchant_id FROM api_keys WHERE public_key = $1',
          [publicKey]
        );

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Invalid public key' },
            { status: 401 }
          );
        }

        merchantId = result.rows[0].merchant_id;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({
      valid: true,
      merchantId
    });

  } catch (error) {
    console.error('Error verifying auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}