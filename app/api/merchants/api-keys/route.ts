import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateApiKeys, hashSecretKey } from '@/lib/jwt';
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, walletAddress, environment } = getAuthHeaders(request);
    
    if (!apiKey || !walletAddress || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, walletAddress, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT secret_key, public_key, created_at FROM api_keys WHERE merchant_id = $1 ORDER BY created_at DESC',
        [authResult.merchant!.id]
      );

      const apiKeys = result.rows.map(row => ({
        publicKey: row.public_key,
        secretKey: row.secret_key,
        environment: row.public_key.includes('test_') ? 'testnet' : 'mainnet',
        createdAt: row.created_at
      }));

      return NextResponse.json({
        apiKeys,
        currentEnvironment: environment || 'testnet'
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
    // Get authentication headers
    const { apiKey, walletAddress, environment: currentEnv } = getAuthHeaders(request);
    
    if (!apiKey || !walletAddress || !currentEnv) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, walletAddress, currentEnv);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
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
        [authResult.merchant!.id, environment === 'testnet' ? 'pk_test_%' : 'pk_live_%']
      );

      // Generate new API keys
      const newKeys = generateApiKeys(authResult.merchant!.id, environment as 'testnet' | 'mainnet');

      // Store new API keys
      await client.query(
        'INSERT INTO api_keys (merchant_id, secret_key, public_key) VALUES ($1, $2, $3)',
        [authResult.merchant!.id, hashSecretKey(newKeys.secretKey), newKeys.publicKey]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        apiKeys: {
          publicKey: newKeys.publicKey,
          secretKey: newKeys.secretKey, // Send once
          environment
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
