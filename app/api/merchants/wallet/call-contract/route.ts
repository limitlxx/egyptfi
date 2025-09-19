import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware, MerchantAuthData } from '../../../../../lib/auth-middleware';
import { WalletCrypto } from '../../../../../lib/wallet-crypto';
import { ChipiPayAuth } from '../../../../../lib/chipipay-auth';
import { chipipayService } from '../../../../../services/chipipayService';
import pool from '../../../../../lib/db';

interface CallContractRequest {
  pin: string;
  contractAddress: string;
  entrypoint: string;
  calldata: any[];
}

interface CallContractResponse {
  success: boolean;
  txHash?: string;
  data?: any;
  error?: string;
  code?: string;
}

// Security: List of potentially dangerous entrypoints that require extra validation
const DANGEROUS_ENTRYPOINTS = [
  'transfer_ownership',
  'upgrade',
  'set_admin',
  'pause',
  'unpause',
  'mint',
  'burn',
  'destroy',
  'selfdestruct',
  'delegate_call',
  'call_contract'
];

// Security: List of known safe entrypoints for common operations
const SAFE_ENTRYPOINTS = [
  'transfer',
  'approve',
  'increase_allowance',
  'decrease_allowance',
  'stake',
  'unstake',
  'claim_rewards',
  'deposit',
  'withdraw',
  'swap',
  'add_liquidity',
  'remove_liquidity'
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate the request
    const authResult = await AuthMiddleware.authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const merchant = authResult as MerchantAuthData;

    // Parse request body
    const body: CallContractRequest = await request.json();
    
    // Validate required fields
    if (!body.pin || !body.contractAddress || !body.entrypoint || !Array.isArray(body.calldata)) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: pin, contractAddress, entrypoint, calldata (array)',
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

    // Validate entrypoint format (alphanumeric with underscores)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(body.entrypoint)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid entrypoint format. Must be alphanumeric with underscores',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Security check: Warn about dangerous entrypoints
    const isDangerous = DANGEROUS_ENTRYPOINTS.some(dangerous => 
      body.entrypoint.toLowerCase().includes(dangerous.toLowerCase())
    );

    if (isDangerous) {
      console.warn(`Potentially dangerous contract call by merchant ${merchant.merchantId}: ${body.entrypoint} on ${body.contractAddress}`);
      
      // In production, you might want to require additional confirmation or restrict these calls
      return NextResponse.json({
        success: false,
        error: 'This contract call contains potentially dangerous operations and is not allowed',
        code: 'DANGEROUS_OPERATION'
      }, { status: 403 });
    }

    // Validate calldata array length (prevent extremely large payloads)
    if (body.calldata.length > 50) {
      return NextResponse.json({
        success: false,
        error: 'Calldata array too large. Maximum 50 parameters allowed',
        code: 'INVALID_PARAMETERS'
      }, { status: 400 });
    }

    // Validate each calldata parameter
    for (let i = 0; i < body.calldata.length; i++) {
      const param = body.calldata[i];
      
      // Check for potentially malicious data
      if (typeof param === 'string') {
        // Validate hex strings
        if (param.startsWith('0x') && !/^0x[0-9a-fA-F]*$/.test(param)) {
          return NextResponse.json({
            success: false,
            error: `Invalid hex string in calldata parameter ${i}`,
            code: 'INVALID_PARAMETERS'
          }, { status: 400 });
        }
        
        // Prevent extremely long strings
        if (param.length > 1000) {
          return NextResponse.json({
            success: false,
            error: `Calldata parameter ${i} is too long. Maximum 1000 characters`,
            code: 'INVALID_PARAMETERS'
          }, { status: 400 });
        }
      }
      
      // Validate numbers
      if (typeof param === 'number' && (!Number.isFinite(param) || param < 0)) {
        return NextResponse.json({
          success: false,
          error: `Invalid number in calldata parameter ${i}. Must be a positive finite number`,
          code: 'INVALID_PARAMETERS'
        }, { status: 400 });
      }
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
    // error
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

    // Execute contract call using ChipiPay service
    const contractCallResult = await chipipayService.callAnyContract({
      privateKey: pinValidation.privateKey!,
      contractAddress: body.contractAddress,
      entrypoint: body.entrypoint,
      calldata: body.calldata,
      bearerToken: tokenResult.token!
    });

    // Log the operation in database
    await logWalletOperation({
      merchantId: merchant.merchantId,
      operationType: 'contract_call',
      contractAddress: body.contractAddress,
      txHash: contractCallResult.txHash,
      status: contractCallResult.success ? 'completed' : 'failed',
      errorMessage: contractCallResult.error,
      metadata: {
        entrypoint: body.entrypoint,
        calldataLength: body.calldata.length,
        environment: merchant.environment,
        isSafeEntrypoint: SAFE_ENTRYPOINTS.includes(body.entrypoint.toLowerCase()),
        isDangerous: isDangerous
      }
    });

    if (!contractCallResult.success) {
      // Handle contract call specific errors with user-friendly messages
      let userFriendlyError = contractCallResult.error || 'Contract call failed';
      
      if (contractCallResult.error?.includes('contract not found')) {
        userFriendlyError = 'Contract not found at the specified address';
      } else if (contractCallResult.error?.includes('entrypoint not found')) {
        userFriendlyError = `Entrypoint '${body.entrypoint}' not found in contract`;
      } else if (contractCallResult.error?.includes('invalid calldata')) {
        userFriendlyError = 'Invalid parameters provided for contract call';
      } else if (contractCallResult.error?.includes('execution reverted')) {
        userFriendlyError = 'Contract execution failed. Check parameters and contract state';
      } else if (contractCallResult.error?.includes('insufficient gas')) {
        userFriendlyError = 'Insufficient gas for contract execution';
      } else if (contractCallResult.error?.includes('unauthorized')) {
        userFriendlyError = 'Wallet not authorized to call this contract function';
      }

      return NextResponse.json({
        success: false,
        error: userFriendlyError,
        code: 'CONTRACT_CALL_FAILED'
      }, { status: 400 });
    }

    const response: CallContractResponse = {
      success: true,
      txHash: contractCallResult.txHash,
      data: {
        ...contractCallResult.data,
        contractAddress: body.contractAddress,
        entrypoint: body.entrypoint,
        calldataLength: body.calldata.length
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Contract call endpoint error:', error);
    
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