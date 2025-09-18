import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import pool from '../../../../../lib/db';

interface StakeVesuUsdcRequest {
  pin: string;
  amount: string;
  receiverWallet: string;
}

interface StakeVesuUsdcResponse {
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
    const body: StakeVesuUsdcRequest = await request.json();
    
    // Validate required fields
    if (!body.pin || !body.amount || !body.receiverWallet) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pin, amount, receiverWallet',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate amount (must be positive number)
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Amount must be a positive number',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate minimum staking amount (VESU typically has minimum requirements)
    const MIN_STAKE_AMOUNT = 1; // 1 USDC minimum
    if (amount < MIN_STAKE_AMOUNT) {
      return NextResponse.json({
        success: false,
        error: `Minimum staking amount is ${MIN_STAKE_AMOUNT} USDC`,
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate receiver wallet address format
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(body.receiverWallet)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid receiver wallet address format',
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

    // Execute VESU USDC staking using ChipiPay service
    const stakeResult = await chipipayService.stakeVesuUsdc({
      privateKey: pinValidation.privateKey!,
      amount: body.amount,
      receiverWallet: body.receiverWallet,
      bearerToken: tokenResult.token!
    });

    // Log the operation in database
    await logWalletOperation({
      merchantId: merchant.merchantId,
      operationType: 'stake_vesu_usdc',
      amount: body.amount,
      recipient: body.receiverWallet,
      txHash: stakeResult.txHash,
      status: stakeResult.success ? 'completed' : 'failed',
      errorMessage: stakeResult.error,
      metadata: {
        protocol: 'VESU',
        asset: 'USDC',
        environment: merchant.environment,
        stakingType: 'vesu_usdc_pool'
      }
    });

    if (!stakeResult.success) {
      // Handle VESU-specific errors with user-friendly messages
      let userFriendlyError = stakeResult.error || 'VESU staking failed';
      
      if (stakeResult.error?.includes('insufficient balance')) {
        userFriendlyError = 'Insufficient USDC balance for staking';
      } else if (stakeResult.error?.includes('pool capacity')) {
        userFriendlyError = 'VESU pool has reached maximum capacity';
      } else if (stakeResult.error?.includes('minimum amount')) {
        userFriendlyError = `Minimum staking amount is ${MIN_STAKE_AMOUNT} USDC`;
      } else if (stakeResult.error?.includes('contract paused')) {
        userFriendlyError = 'VESU staking is temporarily paused';
      }

      return NextResponse.json({
        success: false,
        error: userFriendlyError,
        code: 'VESU_STAKE_FAILED'
      }, { status: 400 });
    }

    const response: StakeVesuUsdcResponse = {
      success: true,
      txHash: stakeResult.txHash,
      data: {
        ...stakeResult.data,
        protocol: 'VESU',
        asset: 'USDC',
        stakedAmount: body.amount,
        receiverWallet: body.receiverWallet
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('VESU staking endpoint error:', error);
    
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
        params.amount ? parseFloat(params.amount) : null,
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