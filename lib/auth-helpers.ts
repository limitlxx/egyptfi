// lib/auth-helpers.ts
import pool from '@/lib/db';
import { log } from 'console';

interface AuthResult {
  success: boolean;
  merchant?: {
    id: string;
    walletAddress: string;
    businessName: string;
    isVerified: boolean;
  };
  error?: string;
}

export async function authenticateApiKey(
  apiKey: string,
  // walletAddress: string,
  environment: 'testnet' | 'mainnet'
): Promise<AuthResult> {
  try {
    const client = await pool.connect();
    try {
      // console.log('Authenticating API key:', { apiKey, environment });
      
      // Verify the API key belongs to the merchant with the given wallet address
      const result = await client.query(
        `SELECT 
          m.id,
          m.wallet_address,
          m.business_name,
          m.is_verified
         FROM merchants m
         JOIN api_keys ak ON m.id = ak.merchant_id
         WHERE ak.public_key = $1
         AND m.is_verified = true`,
        [apiKey]
      );

      // console.log('Auth query result:', result.rows);
      

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid API key or wallet address'
        };
      }

      const merchant = result.rows[0];

      // Verify environment matches key prefix
      // const expectedEnv = apiKey.startsWith('pk_test_') ? 'testnet' : 'mainnet';
      // if (environment !== expectedEnv) {
      //   return {
      //     success: false,
      //     error: 'Environment mismatch with API key'
      //   };
      // }

      return {
        success: true,
        merchant: {
          id: merchant.id,
          walletAddress: merchant.wallet_address,
          businessName: merchant.business_name,
          isVerified: merchant.is_verified
        }
      };

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

export function getAuthHeaders(request: Request) {
  return {
    apiKey: request.headers.get('x-api-key'),
    walletAddress: request.headers.get('x-wallet-address'),
    environment: request.headers.get('x-environment') as 'testnet' | 'mainnet'
  };
}