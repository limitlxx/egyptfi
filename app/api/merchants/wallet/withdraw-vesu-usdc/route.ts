import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import pool from '../../../../../lib/db';

interface WithdrawVesuUsdcRequest {
  pin: string;
  amount: string;
  recipient: string;
}

interface WithdrawVesuUsdcResponse {
  success: boolean;
  txHash?: string;
  data?: any;
  error?: string;
  code?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate the request
    const authResult = await AuthMiddleware.authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const merchant = authResult as MerchantAuthData;

    // Parse request body
    const body: WithdrawVesuUsdcRequest = await request.json();
    
    // Validate required fields
    if (!body.pin || !body.amount || !body.recipient) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pin, amount, recipient',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate amount (must be positive number or "max" for full withdrawal)
    if (body.amount !== 'max') {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Amount must be a positive number or "max" for full withdrawal',
          code: 'INVALID_PARAMETERS'
        }, { status: 400 });
      }

      // Validate minimum withdrawal amount (VESU typically has minimum requirements)
      const MIN_WITHDRAW_AMOUNT = 0.01; // 0.01 USDC minimum
      if (amount < MIN_WITHDRAW_AMOUNT) {
        return NextResponse.json({
          success: false,
          error: `Minimum withdrawal amount is ${MIN_WITHDRAW_AMOUNT} USDC`,
          code: 'INVALID_PARAMETERS'
        }, { status: 400 });
      }
    }

    // Validate recipient address format
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(body.recipient)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid recipient address format',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate PIN and decrypt wallet
    const pinValidation = await WalletCrypto.validatePinAndDecryptWallet(
      merchant.merchantId,
      body.pin
    );

    if (!pinValidation.success) {
      return NextResponse.json({
        success: false,
        error: pinValidation.error,
        code: 'INVALID_PIN',
        attemptsRemaining: pinValidation.attemptsRemaining
      }, { status: 401 });
    }

    // Get bearer token for ChipiPay API
    const tokenResult = await ChipiPayAuth.getBearerToken(
      merchant.merchantId,
      merchant.environment
    );

    if (!tokenResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to authenticate with ChipiPay',
        code: 'AUTHENTICATION_ERROR'
      }, { status: 500 });
    }

    // Execute VESU USDC withdrawal using ChipiPay service
    const withdrawResult = await chipipayService.withdrawVesuUsdc({
      privateKey: pinValidation.privateKey!,
      amount: body.amount,
      recipient: body.recipient,
      bearerToken: tokenResult.token!
    });

    // Log the operation in database
    await logWalletOperation({
      merchantId: merchant.merchantId,
      operationType: 'withdraw_vesu_usdc',
      amount: body.amount,
      recipient: body.recipient,
      txHash: withdrawResult.txHash,
      status: withdrawResult.success ? 'completed' : 'failed',
      errorMessage: withdrawResult.error,
      metadata: {
        protocol: 'VESU',
        asset: 'USDC',
        environment: merchant.environment,
        withdrawalType: 'vesu_usdc_pool',
        isFullWithdrawal: body.amount === 'max'
      }
    });

    if (!withdrawResult.success) {
      // Handle VESU-specific errors with user-friendly messages
      let userFriendlyError = withdrawResult.error || 'VESU withdrawal failed';
      
      if (withdrawResult.error?.includes('insufficient staked balance')) {
        userFriendlyError = 'Insufficient staked USDC balance for withdrawal';
      } else if (withdrawResult.error?.includes('withdrawal limit')) {
        userFriendlyError = 'Daily withdrawal limit exceeded';
      } else if (withdrawResult.error?.includes('minimum amount')) {
        userFriendlyError = 'Minimum withdrawal amount is 0.01 USDC';
      } else if (withdrawResult.error?.includes('contract paused')) {
        userFriendlyError = 'VESU withdrawals are temporarily paused';
      } else if (withdrawResult.error?.includes('cooldown period')) {
        userFriendlyError = 'Withdrawal cooldown period has not elapsed';
      } else if (withdrawResult.error?.includes('liquidity')) {
        userFriendlyError = 'Insufficient liquidity in VESU pool for withdrawal';
      }

      return NextResponse.json({
        success: false,
        error: userFriendlyError,
        code: 'VESU_WITHDRAW_FAILED'
      }, { status: 400 });
    }

    const response: WithdrawVesuUsdcResponse = {
      success: true,
      txHash: withdrawResult.txHash,
      data: {
        ...withdrawResult.data,
        protocol: 'VESU',
        asset: 'USDC',
        withdrawnAmount: body.amount,
        recipient: body.recipient
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('VESU withdrawal endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

// Helper function to log wallet operations
async function logWalletOperation(params: {
  merchantId: string;
  operationType: string;
  contractAddress?: string;
  amount?: string;
  recipient?: string;
  txHash?: string;
  status: string;
  errorMessage?: string;
  metadata?: any;
}) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO wallet_operations_log 
       (merchant_id, operation_type, contract_address, amount, recipient, tx_hash, status, error_message, metadata, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.merchantId,
        params.operationType,
        params.contractAddress,
        params.amount && params.amount !== 'max' ? parseFloat(params.amount) : null,
        params.recipient,
        params.txHash,
        params.status,
        params.errorMessage,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.status === 'completed' ? new Date() : null
      ]
    );
  } catch (error) {
    console.error('Failed to log wallet operation:', error);
    // Don't throw error here as it shouldn't fail the main operation
  } finally {
    client.release();
  }
}