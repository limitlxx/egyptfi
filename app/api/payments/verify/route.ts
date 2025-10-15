import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db' 

export async function GET(
  request: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
      const { searchParams } = new URL(request.url);
    const payment_ref = searchParams.get("payment_ref");

    console.log("Fetching invoice for ref:", payment_ref);

    if (!payment_ref) {
      return NextResponse.json({ error: "Missing payment_ref" }, { status: 400 });
    }
    
    const client = await pool.connect()
    try {
      const result = await client.query(
        `SELECT i.*, m.business_name, m.business_logo, m.wallet_address, m.preferred_btc_flow 
         FROM invoices i
         JOIN merchants m ON i.merchant_id = m.id
         WHERE i.payment_ref = $1`,
        [payment_ref]
      )

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 }
        )
      }

      const invoice = result.rows[0]
      
      return NextResponse.json({
        success: true,
        data: {
          merchant_name: invoice.business_name,
          merchant_logo: invoice.business_logo,
          payment_ref: invoice.payment_ref,
          status: invoice.status,
          amount: invoice.local_amount,
          currency: invoice.local_currency,
          description: invoice.description,
          chain: invoice.chain,
          created_at: invoice.created_at,
          paid_at: invoice.paid_at,
          tx_hash: invoice.tx_hash,
          paymentUrl: invoice.payment_endpoint,
          walletUrl: `${invoice.payment_endpoint}&redirect=${invoice.secondary_endpoint}`,
          secondary_endpoint: invoice.secondary_endpoint,
          merchant_address: invoice.wallet_address,
          preferred_btc_flow: invoice.preferred_btc_flow,
          qrCode: invoice.qr_url,
          paymentId: invoice.payment_id
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}