import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import pool from '../../../../../lib/db';

interface ApproveRequest {
  pin: string;
  contractAddress: string;
  spender: string;
  amount: string;
  decimals?: number;
}

interface ApproveResponse {
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
    const body: ApproveRequest = await request.json();
    
    // Validate required fields
    if (!body.pin || !body.contractAddress || !body.spender || !body.amount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pin, contractAddress, spender, amount',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate contract address format
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(body.contractAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract address format',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate spender address format
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(body.spender)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid spender address format',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate amount (must be positive number or "max" for unlimited approval)
    if (body.amount !== 'max') {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({
          success: false,
          error: 'Amount must be a positive number or "max" for unlimited approval',
          code: 'INVALID_PARAMETERS'
        }, { status: 400 });
      }
    }

    // Validate decimals if provided
    if (body.decimals !== undefined && (!Number.isInteger(body.decimals) || body.decimals < 0 || body.decimals > 18)) {
      return NextResponse.json({
        success: false,
        error: 'Decimals must be an integer between 0 and 18',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Security check: Warn about unlimited approvals
    if (body.amount === 'max') {
      console.warn(`Unlimited approval requested by merchant ${merchant.merchantId} for contract ${body.contractAddress} to spender ${body.spender}`);
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

    // Execute approval using ChipiPay service
    const approveResult = await chipipayService.approve({
      privateKey: pinValidation.privateKey!,
      contractAddress: body.contractAddress,
      spender: body.spender,
      amount: body.amount,
      decimals: body.decimals,
      bearerToken: tokenResult.token!
    });

    // Log the operation in database
    await logWalletOperation({
      merchantId: merchant.merchantId,
      operationType: 'approve',
      contractAddress: body.contractAddress,
      amount: body.amount,
      recipient: body.spender, // Use spender as recipient for approval operations
      txHash: approveResult.txHash,
      status: approveResult.success ? 'completed' : 'failed',
      errorMessage: approveResult.error,
      metadata: {
        spender: body.spender,
        decimals: body.decimals,
        environment: merchant.environment,
        isUnlimitedApproval: body.amount === 'max'
      }
    });

    if (!approveResult.success) {
      return NextResponse.json({
        success: false,
        error: approveResult.error || 'Approval failed',
        code: 'APPROVE_FAILED'
      }, { status: 400 });
    }

    const response: ApproveResponse = {
      success: true,
      txHash: approveResult.txHash,
      data: approveResult.data
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Approve endpoint error:', error);
    
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