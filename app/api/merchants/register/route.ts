import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateApiKeys, hashSecretKey, generateJWT } from '@/lib/jwt';
import { FormValidator, SimplifiedRegistrationRequest } from '@/lib/form-validation';
import { ChipiPayServiceImpl } from '@/services/chipipayService';
import { ChipiPayConfigServiceImpl } from '@/services/chipipayConfigService';

interface MerchantRegistrationData {
  business_name: string;
  business_email: string;
  business_type: string;
  monthly_volume: string;
  wallet_address?: string;
  authMethod: 'wallet' | 'google';
  local_currency?: string;
  transaction_hash?: string;
}

interface RegistrationResponse {
  success: boolean;
  message?: string;
  merchant?: {
    id: string;
    business_email: string;
    wallet: {
      publicKey: string;
    };
  };
  apiKeys?: {
    testnet: { publicKey: string; secretKey: string };
    mainnet: { publicKey: string; secretKey: string };
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<RegistrationResponse>> {
  console.log("POST route to register merchant with ChipiPay wallet");
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const data: SimplifiedRegistrationRequest = await request.json();

    console.log("Simplified Registration Data", { email: data.business_email, pinLength: data.pin?.length });

    // Validate input data using FormValidator
    const validation = FormValidator.validateSimplifiedRegistration(data);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false,
          error: validation.errors.join(', ') 
        },
        { status: 400 }
      );
    }

    // Check if merchant already exists by email
    const existingMerchant = await client.query(
      'SELECT id FROM merchants WHERE business_email = $1',
      [data.business_email.toLowerCase()]
    );

    if (existingMerchant.rows.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Merchant account already exists with this email' 
        },
        { status: 409 }
      );
    }

    // Initialize ChipiPay services
    const configService = new ChipiPayConfigServiceImpl();
    const chipiPayService = new ChipiPayServiceImpl();

    // Generate external user ID for ChipiPay
    const externalUserId = `merchant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log("[Registration] Creating ChipiPay wallet for external user:", {
      externalUserId,
      email: data.business_email,
      timestamp: new Date().toISOString()
    });

    // Create ChipiPay invisible wallet
    let walletCreationResult;
    try {
      const testnetConfig = configService.getEnvironmentConfig('testnet');
      const bearerToken = await configService.generateBearerToken(externalUserId, 'testnet');
      
      console.log("[Registration] Attempting wallet creation with ChipiPay API");
      
      walletCreationResult = await chipiPayService.createWallet({
        encryptKey: data.pin,
        externalUserId: externalUserId,
        apiPublicKey: testnetConfig.apiPublicKey,
        bearerToken: bearerToken
      });

      if (!walletCreationResult.success) {
        throw new Error(`Wallet creation failed: ${walletCreationResult || 'Unknown error'}`);
      }

      console.log("[Registration] ChipiPay wallet created successfully:", {
        externalUserId,
        txHash: walletCreationResult.txHash,
        publicKey: walletCreationResult.wallet.publicKey.substring(0, 10) + '...',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Registration] ChipiPay wallet creation failed:', {
        externalUserId,
        email: data.business_email,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Provide user-friendly error messages based on error type
      let userErrorMessage = 'Failed to create wallet. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('PIN')) {
          userErrorMessage = 'Invalid PIN format. Please use 4-8 digits.';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          userErrorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('authentication')) {
          userErrorMessage = 'Authentication failed. Please contact support.';
        }
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: userErrorMessage 
        },
        { status: 500 }
      );
    }

    // Create new merchant with wallet information
    const merchantResult = await client.query(
      `INSERT INTO merchants (
        business_email, local_currency, supported_currencies, 
        wallet_public_key, wallet_encrypted_private_key, wallet_created_at,
        chipipay_external_user_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
      [
        data.business_email.toLowerCase(),
        'USD', // Default to USD for ChipiPay integration
        ['USDC', 'ETH', 'STRK'], // Default supported currencies
        walletCreationResult.wallet.publicKey,
        walletCreationResult.wallet.encryptedPrivateKey,
        new Date(),
        externalUserId,
        JSON.stringify({
          authMethod: 'chipipay',
          registrationDate: new Date().toISOString(),
          walletProvider: 'chipipay'
        })
      ]
    );

    const newMerchant = merchantResult.rows[0];

    console.log("[Registration] Merchant created with ChipiPay wallet:", { 
      merchantId: newMerchant.id, 
      externalUserId,
      email: data.business_email,
      walletPublicKey: walletCreationResult.wallet.publicKey.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });
    

    // Generate API keys for both testnet and mainnet (only here)
    const testnetKeys = generateApiKeys(newMerchant.id, 'testnet');
    const mainnetKeys = generateApiKeys(newMerchant.id, 'mainnet');

    // Store API keys in database (hashed secret)
    await client.query(
      `INSERT INTO api_keys (merchant_id, secret_key, public_key, created_at) VALUES 
       ($1, $2, $3, NOW()), 
       ($1, $4, $5, NOW())`,
      [
        newMerchant.id,
        hashSecretKey(testnetKeys.secretKey),
        testnetKeys.publicKey,
        hashSecretKey(mainnetKeys.secretKey),
        mainnetKeys.publicKey
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Merchant account created successfully with ChipiPay wallet.',
      merchant: {
        id: newMerchant.id,
        business_email: data.business_email,
        wallet: {
          publicKey: walletCreationResult.wallet.publicKey
          // Note: encrypted private key is NOT returned for security
        }
      },
      apiKeys: {
        testnet: {
          publicKey: testnetKeys.publicKey,
          secretKey: testnetKeys.secretKey, // Unhashed, sent only once
        },
        mainnet: {
          publicKey: mainnetKeys.publicKey,
          secretKey: mainnetKeys.secretKey, // Unhashed, sent only once
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    
    console.error('[Registration] Error creating merchant:', {
      // email: data?.business_email,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to create merchant account';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('wallet creation')) {
        errorMessage = 'Failed to create wallet. Please check your PIN and try again.';
        statusCode = 400;
      } else if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
        errorMessage = 'An account with this email already exists.';
        statusCode = 409;
      } else if (error.message.includes('validation')) {
        errorMessage = 'Invalid input data. Please check your email and PIN.';
        statusCode = 400;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'Network error. Please try again later.';
        statusCode = 503;
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: statusCode }
    );
  } finally {
    client.release();
  }
}