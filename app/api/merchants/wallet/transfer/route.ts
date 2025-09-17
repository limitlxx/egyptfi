import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import { chipipayConfigService } from '../../../../../services/chipipayConfigService';
import pool from '../../../../../lib/db';

interface TransferRequest {
  pin: string;
  recipient: string;
  amount: string;
  contractAddress?: string;
  decimals?: number;
}

interface TransferResponse {
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
    const body: TransferRequest = await request.json();
    
    // Validate required fields
    if (!body.pin || !body.recipient || !body.amount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pin, recipient, amount',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate recipient address format (basic Starknet address validation)
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(body.recipient)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid recipient address format',
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

    // Validate contract address if provided
    if (body.contractAddress && !/^0x[0-9a-fA-F]{63,64}$/.test(body.contractAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract address format',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate decimals if provided
    if (body.decimals !== undefined && (!Number.isInteger(body.decimals) || body.decimals < 0 || body.decimals > 18)) {
      return NextResponse.json({
        success: false,
        error: 'Decimals must be an integer between 0 and 18',
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

    // Execute transfer using ChipiPay service
    const transferResult = await chipipayService.transfer({
      privateKey: pinValidation.privateKey!,
      recipient: body.recipient,
      amount: body.amount,
      contractAddress: body.contractAddress,
      decimals: body.decimals,
      bearerToken: tokenResult.token!
    });

    // Log the operation in database
    await logWalletOperation({
      merchantId: merchant.merchantId,
      operationType: 'transfer',
      contractAddress: body.contractAddress,
      amount: body.amount,
      recipient: body.recipient,
      txHash: transferResult.txHash,
      status: transferResult.success ? 'completed' : 'failed',
      errorMessage: transferResult.error,
      metadata: {
        decimals: body.decimals,
        environment: merchant.environment
      }
    });

    if (!transferResult.success) {
      return NextResponse.json({
        success: false,
        error: transferResult.error || 'Transfer failed',
        code: 'TRANSFER_FAILED'
      }, { status: 400 });
    }

    const response: TransferResponse = {
      success: true,
      txHash: transferResult.txHash,
      data: transferResult.data
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Transfer endpoint error:', error);
    
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