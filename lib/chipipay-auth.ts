// lib/chipipay-auth.ts
import jwt from 'jsonwebtoken';
import { chipipayConfigService } from '../services/chipipayConfigService';

export interface BearerTokenResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

export interface TokenCacheEntry {
  token: string;
  expiresAt: number;
  merchantId: string;
}

// Token cache (in production, use Redis or similar)
const tokenCache = new Map<string, TokenCacheEntry>();
const TOKEN_EXPIRY_MINUTES = 55; // JWT tokens expire in 60 minutes, refresh at 55
const TOKEN_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up expired tokens every 5 minutes

export class ChipiPayAuth {
  private static configService = chipipayConfigService;

  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize token cleanup interval
   */
  static initialize() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, TOKEN_CLEANUP_INTERVAL);
  }

  /**
   * Stop token cleanup interval
   */
  static cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired tokens from cache
   */
  private static cleanupExpiredTokens() {
    const now = Date.now();
    for (const [key, entry] of tokenCache.entries()) {
      if (now >= entry.expiresAt) {
        tokenCache.delete(key);
      }
    }
  }

  /**
   * Generate cache key for merchant token
   */
  private static getCacheKey(merchantId: string, environment: 'testnet' | 'mainnet'): string {
    return `${merchantId}_${environment}`;
  }

  /**
   * Generate JWT bearer token for ChipiPay API
   */
  private static async generateJWTToken(
    merchantId: string,
    environment: 'testnet' | 'mainnet'
  ): Promise<BearerTokenResult> {
    try {
      // Get ChipiPay configuration
      const envConfig = this.configService.getEnvironmentConfig(environment);
      if (!envConfig) {
        return {
          success: false,
          error: `ChipiPay configuration not found for ${environment}`
        };
      }

      // Get JWKS endpoint for token signing
      const config = this.configService.getConfig();
      if (!config || !config.jwksEndpoint) {
        return {
          success: false,
          error: 'JWKS endpoint not configured'
        };
      }

      // Create JWT payload
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (TOKEN_EXPIRY_MINUTES * 60);
      
      const payload = {
        iss: 'egyptfi-merchant-platform', // Issuer
        sub: merchantId, // Subject (merchant ID)
        aud: 'chipipay-api', // Audience
        iat: now, // Issued at
        exp: expiresAt, // Expires at
        environment: environment,
        api_public_key: envConfig.apiPublicKey
      };

      // For now, we'll use a simple secret-based JWT
      // In production, you should use proper JWKS with RSA keys
      const secret = process.env.CHIPIPAY_JWT_SECRET || 'your-jwt-secret-key';
      
      const token = jwt.sign(payload, secret, {
        algorithm: 'HS256',
        header: {
          typ: 'JWT',
          alg: 'HS256'
        }
      });

      return {
        success: true,
        token,
        expiresAt: expiresAt * 1000 // Convert to milliseconds
      };

    } catch (error) {
      console.error('JWT token generation error:', error);
      return {
        success: false,
        error: 'Failed to generate bearer token'
      };
    }
  }

  /**
   * Get cached token or generate new one
   */
  static async getBearerToken(
    merchantId: string,
    environment: 'testnet' | 'mainnet'
  ): Promise<BearerTokenResult> {
    try {
      const cacheKey = this.getCacheKey(merchantId, environment);
      const cached = tokenCache.get(cacheKey);
      
      // Check if we have a valid cached token
      if (cached && Date.now() < cached.expiresAt) {
        return {
          success: true,
          token: cached.token,
          expiresAt: cached.expiresAt
        };
      }

      // Generate new token
      const tokenResult = await this.generateJWTToken(merchantId, environment);
      
      if (tokenResult.success && tokenResult.token && tokenResult.expiresAt) {
        // Cache the new token
        tokenCache.set(cacheKey, {
          token: tokenResult.token,
          expiresAt: tokenResult.expiresAt,
          merchantId
        });
      }

      return tokenResult;

    } catch (error) {
      console.error('Bearer token generation error:', error);
      return {
        success: false,
        error: 'Failed to get bearer token'
      };
    }
  }

  /**
   * Refresh token if it's close to expiry
   */
  static async refreshTokenIfNeeded(
    merchantId: string,
    environment: 'testnet' | 'mainnet'
  ): Promise<BearerTokenResult> {
    const cacheKey = this.getCacheKey(merchantId, environment);
    const cached = tokenCache.get(cacheKey);
    
    if (!cached) {
      return this.getBearerToken(merchantId, environment);
    }

    // Refresh if token expires in less than 5 minutes
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    if (Date.now() + refreshThreshold >= cached.expiresAt) {
      // Remove old token and generate new one
      tokenCache.delete(cacheKey);
      return this.getBearerToken(merchantId, environment);
    }

    return {
      success: true,
      token: cached.token,
      expiresAt: cached.expiresAt
    };
  }

  /**
   * Invalidate cached token for a merchant
   */
  static invalidateToken(merchantId: string, environment: 'testnet' | 'mainnet'): void {
    const cacheKey = this.getCacheKey(merchantId, environment);
    tokenCache.delete(cacheKey);
  }

  /**
   * Validate JWT token
   */
  static validateToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const secret = process.env.CHIPIPAY_JWT_SECRET || 'your-jwt-secret-key';
      const payload = jwt.verify(token, secret);
      
      return {
        valid: true,
        payload
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  /**
   * Get token info without validation
   */
  static getTokenInfo(token: string): { payload?: any; error?: string } {
    try {
      const payload = jwt.decode(token);
      if (!payload) {
        return {
          error: 'Invalid token format'
        };
      }
      return { payload };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Token decode failed'
      };
    }
  }

  /**
   * Get token cache for testing purposes
   */
  static getTokenCache(): Map<string, TokenCacheEntry> {
    return tokenCache;
  }
}

// Initialize token cleanup on module load (only in production)
if (process.env.NODE_ENV !== 'test') {
  ChipiPayAuth.initialize();
}