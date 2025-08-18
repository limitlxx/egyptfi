import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateApiKeys, hashSecretKey, generateJWT } from '@/lib/jwt';

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

export async function POST(request: NextRequest) {
  console.log("POst route to register");
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const data: MerchantRegistrationData = await request.json();

    console.log("Merchant Data", data);    

    // Validate required fields
    if (!data.business_name || !data.business_email || !data.business_type || !data.monthly_volume) {
      return NextResponse.json(
        { error: 'All business information fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.business_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if merchant already exists
    const existingMerchant = await client.query(
      'SELECT id FROM merchants WHERE business_email = $1 OR ($2::text IS NOT NULL AND wallet_address = $2)',
      [data.business_email, data.wallet_address?.toLowerCase() || null]
    );

    if (existingMerchant.rows.length > 0) {
      return NextResponse.json(
        { error: 'Merchant account already exists' },
        { status: 409 }
      );
    }

    // Create new merchant
    const merchantResult = await client.query(
      `INSERT INTO merchants (
        wallet_address, business_name, business_email, local_currency, 
        supported_currencies, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, wallet_address, created_at`,
      [
        data.wallet_address?.toLowerCase() || null,
        data.business_name,
        data.business_email,
        data.local_currency || 'NGN',
        ['USDC', 'ETH', 'STRK'], // Default supported currencies
        JSON.stringify({
          business_type: data.business_type,
          monthly_volume: data.monthly_volume,
          authMethod: data.authMethod,
          registrationDate: new Date().toISOString(),
          transaction_hash: data.transaction_hash
        })
      ]
    );

    const newMerchant = merchantResult.rows[0];

    console.log("Merchant", newMerchant);
    

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
      message: 'Merchant account created successfully. Login to get JWT.',
      merchant: {
        id: newMerchant.id,
        business_name: data.business_name,
        business_email: data.business_email,
        wallet_address: newMerchant.wallet_address,
        createdAt: newMerchant.created_at
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
    console.error('Error creating merchant:', error);
    return NextResponse.json(
      { error: 'Failed to create merchant account' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}