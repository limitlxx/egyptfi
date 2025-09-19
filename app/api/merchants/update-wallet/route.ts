import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, environment } = getAuthHeaders(request);
    
    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const { chipiWalletAddress, merchantId, encryptedPin, contractHash, contractStatus } = await request.json();
    
    if (!chipiWalletAddress || !merchantId) {
      return NextResponse.json(
        { error: 'chipiWalletAddress and merchantId are required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE merchants SET wallet_address = $1, 
            wallet_public_key = $2, 
            chipipay_external_user_id = $3, 
            contract_transaction_hash = $4,
            contract_registered = $5
            pin_code = $6
                WHERE id = $7 RETURNING id`,
        [chipiWalletAddress, chipiWalletAddress, merchantId, contractHash, contractStatus, merchantId, encryptedPin]
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