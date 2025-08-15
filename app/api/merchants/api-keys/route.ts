import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyJWT, generateApiKeys, hashSecretKey, generateJWT } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT public_key, created_at FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC',
        [payload.merchantId]
      );

      const apiKeys = result.rows.map(row => ({
        publicKey: row.public_key,
        environment: row.public_key.includes('test_') ? 'testnet' : 'mainnet',
        createdAt: row.created_at
      }));

      return NextResponse.json({
        apiKeys,
        currentEnvironment: payload.environment
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { environment } = await request.json();

    if (!['testnet', 'mainnet'].includes(environment)) {
      return NextResponse.json(
        { error: 'Invalid environment. Must be testnet or mainnet' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Revoke old keys for this environment
      await client.query(
        'DELETE FROM api_keys WHERE merchant_id = $1 AND public_key LIKE $2',
        [payload.merchantId, environment === 'testnet' ? 'pk_test_%' : 'pk_live_%']
      );

      // Generate new API keys
      const newKeys = generateApiKeys(payload.merchantId, environment as 'testnet' | 'mainnet');

      // Store new API keys
      await client.query(
        'INSERT INTO api_keys (merchant_id, secret_key, public_key) VALUES ($1, $2, $3)',
        [payload.merchantId, hashSecretKey(newKeys.secretKey), newKeys.publicKey]
      );

      // Generate new JWT
      const newJWT = generateJWT({
        merchantId: payload.merchantId,
        walletAddress: payload.walletAddress,
        egyptfiSecret: environment === 'testnet' 
          ? process.env.EGYPTFI_TESTNET_SECRET || ''
          : process.env.EGYPTFI_MAINNET_SECRET || '',
        createdDate: new Date().toISOString(),
        environment: environment as 'testnet' | 'mainnet'
      });

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        apiKeys: {
          publicKey: newKeys.publicKey,
          secretKey: newKeys.secretKey, // Send once
          environment,
          jwt: newJWT
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error regenerating API keys:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate API keys' },
      { status: 500 }
    );
  }
}