import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyJWT } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { chipiWalletAddress, merchantId } = await request.json();
    
    if (!chipiWalletAddress || !merchantId) {
      return NextResponse.json(
        { error: 'chipiWalletAddress and merchantId are required' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token is required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload || payload.merchantId !== merchantId) {
      return NextResponse.json(
        { error: 'Invalid or unauthorized token' },
        { status: 401 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'UPDATE merchants SET chipi_wallet_address = $1 WHERE id = $2 RETURNING id',
        [chipiWalletAddress, merchantId]
      );

      await client.query('COMMIT');

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Wallet address updated successfully',
        merchantId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating wallet address:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}