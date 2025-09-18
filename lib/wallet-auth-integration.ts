// lib/wallet-auth-integration.ts
import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from './auth-middleware';
import { WalletCrypto } from './wallet-crypto';
import { ChipiPayAuth } from './chipipay-auth';

export interface WalletOperationRequest {
  pin: string;
  [key: string]: any;
}

export interface AuthenticatedWalletOperation {
  merchantData: MerchantAuthData;
  privateKey: string;
  bearerToken: string;
}

export interface WalletAuthResult {
  success: boolean;
  data?: AuthenticatedWalletOperation;
  error?: string;
}

/**
 * Complete authentication flow for wallet operations
 * This combines API key validation, PIN verification, and bearer token generation
 */
export class WalletAuthIntegration {
  /**
   * Authenticate a wallet operation request
   * This performs the complete authentication flow:
   * 1. Validate API key and get merchant data
   * 2. Validate PIN and decrypt private key
   * 3. Generate bearer token for ChipiPay
   */
  static async authenticateWalletOperation(
    request: NextRequest,
    requestBody: WalletOperationRequest
  ): Promise<WalletAuthResult> {
    try {
      // Step 1: Validate API key and get merchant data
      const authResult = await AuthMiddleware.authenticate(request);
      
      if (authResult instanceof NextResponse) {
        const errorData = await authResult.json();
        return {
          success: false,
          error: errorData.error || 'Authentication failed'
        };
      }

      const merchantData = authResult as MerchantAuthData;

      // Step 2: Validate PIN and decrypt private key
      const pinResult = await WalletCrypto.validatePinAndDecryptWallet(
        merchantData.merchantId,
        requestBody.pin
      );

      if (!pinResult.success) {
        return {
          success: false,
          error: pinResult.error || 'PIN validation failed'
        };
      }

      // Step 3: Generate bearer token for ChipiPay
      const tokenResult = await ChipiPayAuth.getBearerToken(
        merchantData.merchantId,
        merchantData.environment
      );

      if (!tokenResult.success) {
        return {
          success: false,
          error: tokenResult.error || 'Bearer token generation failed'
        };
      }

      return {
        success: true,
        data: {
          merchantData,
          privateKey: pinResult.privateKey!,
          bearerToken: tokenResult.token!
        }
      };

    } catch (error) {
      console.error('Wallet authentication error:', error);
      return {
        success: false,
        error: 'Internal authentication error'
      };
    }
  }

  /**
   * Middleware wrapper for wallet operation endpoints
   * Use this to wrap your wallet operation API endpoints
   */
  static async withWalletAuth<T>(
    request: NextRequest,
    requestBody: WalletOperationRequest,
    operation: (auth: AuthenticatedWalletOperation) => Promise<T>
  ): Promise<NextResponse> {
    const authResult = await this.authenticateWalletOperation(request, requestBody);

    if (!authResult.success || !authResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error
        },
        { status: 401 }
      );
    }

    try {
      const result = await operation(authResult.data);
      return NextResponse.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Wallet operation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Operation failed'
        },
        { status: 500 }
      );
    }
  }

  /**
   * Validate request body for wallet operations
   */
  static validateWalletRequest(body: any): { valid: boolean; error?: string } {
    if (!body) {
      return { valid: false, error: 'Request body is required' };
    }

    if (!body.pin) {
      return { valid: false, error: 'PIN is required' };
    }

    if (typeof body.pin !== 'string') {
      return { valid: false, error: 'PIN must be a string' };
    }

    if (!/^[0-9]{4,8}$/.test(body.pin)) {
      return { valid: false, error: 'PIN must be 4-8 digits' };
    }

    return { valid: true };
  }

  /**
   * Get merchant authentication status
   */
  static async getMerchantAuthStatus(request: NextRequest): Promise<{
    authenticated: boolean;
    merchantId?: string;
    environment?: string;
    remainingAttempts?: number;
    isLocked?: boolean;
  }> {
    try {
      const authResult = await AuthMiddleware.authenticate(request);
      
      if (authResult instanceof NextResponse) {
        return { authenticated: false };
      }

      const merchantData = authResult as MerchantAuthData;
      
      return {
        authenticated: true,
        merchantId: merchantData.merchantId,
        environment: merchantData.environment,
        remainingAttempts: WalletCrypto.getRemainingAttempts(merchantData.merchantId),
        isLocked: WalletCrypto.isAccountLocked(merchantData.merchantId)
      };
    } catch (error) {
      return { authenticated: false };
    }
  }
}