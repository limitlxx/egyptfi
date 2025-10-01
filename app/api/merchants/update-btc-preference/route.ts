import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateApiKey, getAuthHeaders } from '@/lib/auth-helpers';

export async function PUT(request: NextRequest) {
  try {
    const { apiKey, environment } = getAuthHeaders(request);

    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: 'Missing authentication headers' },
        { status: 401 }
      );
    }

    const authResult = await authenticateApiKey(apiKey, environment);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferred_btc_flow } = body;

    if (!preferred_btc_flow || !['l1', 'l2'].includes(preferred_btc_flow)) {
      return NextResponse.json(
        { error: 'Invalid preferred_btc_flow. Must be l1 or l2' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE merchants SET preferred_btc_flow = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [preferred_btc_flow, authResult.merchant!.id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        merchant: {
          id: result.rows[0].id,
          preferred_btc_flow: result.rows[0].preferred_btc_flow
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating BTC preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}