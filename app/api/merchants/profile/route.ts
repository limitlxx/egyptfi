import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyJWT } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get merchant profile from database
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          id, wallet_address, business_name, business_logo, business_email, 
          webhook, local_currency, supported_currencies, metadata, created_at, updated_at
         FROM merchants WHERE id = $1`,
        [payload.merchantId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      const merchant = result.rows[0];

      return NextResponse.json({
        id: merchant.id,
        walletAddress: merchant.wallet_address,
        businessName: merchant.business_name,
        businessLogo: merchant.business_logo,
        businessEmail: merchant.business_email,
        webhook: merchant.webhook,
        localCurrency: merchant.local_currency,
        supportedCurrencies: merchant.supported_currencies,
        metadata: merchant.metadata,
        environment: payload.environment,
        createdAt: merchant.created_at,
        updatedAt: merchant.updated_at
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching merchant profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const updates = await request.json();
    const allowedFields = ['business_name', 'business_logo', 'webhook', 'local_currency', 'supported_currencies'];
    
    const setFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(payload.merchantId); // Add merchant ID for WHERE clause

    const client = await pool.connect();
    try {
      const query = `
        UPDATE merchants 
        SET ${setFields.join(', ')}, updated_at = NOW() 
        WHERE id = $${paramCount} 
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      const updatedMerchant = result.rows[0];

      return NextResponse.json({
        success: true,
        merchant: {
          id: updatedMerchant.id,
          walletAddress: updatedMerchant.wallet_address,
          businessName: updatedMerchant.business_name,
          businessLogo: updatedMerchant.business_logo,
          businessEmail: updatedMerchant.business_email,
          webhook: updatedMerchant.webhook,
          localCurrency: updatedMerchant.local_currency,
          supportedCurrencies: updatedMerchant.supported_currencies,
          metadata: updatedMerchant.metadata,
          updatedAt: updatedMerchant.updated_at
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating merchant profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}