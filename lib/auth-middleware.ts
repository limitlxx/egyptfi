// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from './db';

export interface MerchantAuthData {
  merchantId: string;
  businessEmail: string;
  environment: 'testnet' | 'mainnet';
  walletData: {
    publicKey: string;
    encryptedPrivateKey: string;
    chipipayExternalUserId: string;
  };
}

export interface AuthResult {
  success: boolean;
  merchant?: MerchantAuthData;
  error?: string;
}

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per merchant

export class AuthMiddleware {
  /**
   * Validate API key and retrieve merchant data with wallet information
   */
  static async validateApiKey(apiKey: string): Promise<AuthResult> {
    try {
      if (!apiKey) {
        return {
          success: false,
          error: 'API key is required'
        };
      }

      // Validate API key format
      if (!apiKey.startsWith('pk_test_') && !apiKey.startsWith('pk_live_')) {
        return {
          success: false,
          error: 'Invalid API key format'
        };
      }

      const environment = apiKey.startsWith('pk_test_') ? 'testnet' : 'mainnet';

      const client = await pool.connect();
      try {
        // Query merchant data with wallet information
        const result = await client.query(
          `SELECT 
            m.id,
            m.business_email,
            m.wallet_public_key,
            m.wallet_encrypted_private_key,
            m.chipipay_external_user_id,
            m.is_verified
           FROM merchants m
           JOIN api_keys ak ON m.id = ak.merchant_id
           WHERE ak.public_key = $1
           AND m.is_verified = true
           AND m.wallet_public_key IS NOT NULL
           AND m.wallet_encrypted_private_key IS NOT NULL`,
          [apiKey]
        );

        if (result.rows.length === 0) {
          return {
            success: false,
            error: 'Invalid API key or merchant not found'
          };
        }

        const merchant = result.rows[0];

        return {
          success: true,
          merchant: {
            merchantId: merchant.id,
            businessEmail: merchant.business_email,
            environment,
            walletData: {
              publicKey: merchant.wallet_public_key,
              encryptedPrivateKey: merchant.wallet_encrypted_private_key,
              chipipayExternalUserId: merchant.chipipay_external_user_id
            }
          }
        };

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('API key validation error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Check rate limiting for a merchant
   */
  static checkRateLimit(merchantId: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const key = `rate_limit_${merchantId}`;
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize rate limit
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      });
      return { allowed: true };
    }

    if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
      return { 
        allowed: false, 
        resetTime: current.resetTime 
      };
    }

    // Increment count
    current.count++;
    rateLimitStore.set(key, current);
    return { allowed: true };
  }

  /**
   * Middleware function to authenticate API requests
   */
  static async authenticate(request: NextRequest): Promise<NextResponse | MerchantAuthData> {
    try {
      const apiKey = request.headers.get('x-api-key');
      
      if (!apiKey) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'API key is required in x-api-key header' 
          },
          { status: 401 }
        );
      }

      // Validate API key and get merchant data
      const authResult = await this.validateApiKey(apiKey);
      
      if (!authResult.success || !authResult.merchant) {
        return NextResponse.json(
          { 
            success: false, 
            error: authResult.error || 'Authentication failed' 
          },
          { status: 401 }
        );
      }

      // Check rate limiting
      const rateLimit = this.checkRateLimit(authResult.merchant.merchantId);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Rate limit exceeded',
            resetTime: rateLimit.resetTime
          },
          { status: 429 }
        );
      }

      return authResult.merchant;

    } catch (error) {
      console.error('Authentication middleware error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Internal authentication error' 
        },
        { status: 500 }
      );
    }
  }

  /**
   * Extract authentication headers from request
   */
  static getAuthHeaders(request: NextRequest) {
    return {
      apiKey: request.headers.get('x-api-key'),
      environment: request.headers.get('x-environment') as 'testnet' | 'mainnet'
    };
  }
}