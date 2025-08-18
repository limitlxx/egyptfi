import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, walletAddress, environment } = getAuthHeaders(request);
    
    if (!apiKey || !walletAddress || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, walletAddress, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Get merchant profile from database
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM invoices WHERE merchant_id = $1`,
        [authResult.merchant!.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      const invoices = result.rows[0];

      return NextResponse.json({
        ref: invoices.payment_ref,
        amount: invoices.local_amount,
        currency: invoices.local_currency,
        description: invoices.description,
        tokenPaid: invoices.token_amount,
        chain: invoices.chain,
        status: invoices.status,
        txHash: invoices.txHash,
        date: invoices.created_at,
        hostedUrl: invoices.secondary_endpoint
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get authentication headers
    const { apiKey, walletAddress, environment } = getAuthHeaders(request);
    
    if (!apiKey || !walletAddress || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    // Authenticate the request
    const authResult = await authenticateApiKey(apiKey, walletAddress, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const updates = await request.json();
    
    // Extended allowed fields to include phone
    const allowedFields = [
      'merchant_id', 
      'payment_ref', 
      'secondary_ref', 
      'access_code', 
      'status', 
      'local_amount',
      'usdc_amount',
      'token_amount',
      'payment_token',
      'local_currency',
      'chains',
      'receipt_number',
      'secondary_endpoint',
      'paid_at',
      'ip_address',
      'metadata',
      'channel'
    ];
    
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

    values.push(authResult.merchant!.id); // Add merchant ID for WHERE clause

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
          phone: updatedMerchant.phone,
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
 