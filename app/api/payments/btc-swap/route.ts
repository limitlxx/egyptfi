// app/api/payments/btc-swap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SwapService } from "@/lib/swap-service";
import pool from "@/lib/db";

const swapService = new SwapService();

export async function POST(req: NextRequest) {
  try {
    const { payment_ref, token_type, user_address } = await req.json();

    if (!payment_ref || !token_type || !user_address) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Fetch invoice details
      const invoiceResult = await client.query(
        `SELECT i.*, m.wallet_address as merchant_address 
         FROM invoices i 
         JOIN merchants m ON i.merchant_id = m.id 
         WHERE i.payment_ref = $1`,
        [payment_ref]
      );

      if (invoiceResult.rows.length === 0) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      const invoice = invoiceResult.rows[0];
      
      if (invoice.status !== 'pending') {
        return NextResponse.json({ error: "Invoice already processed" }, { status: 400 });
      }

      // Initiate BTC -> USDC swap
      const swapRequest = {
        tokenIn: token_type, // 'BTC' or 'BTCLN'
        tokenOut: process.env.USDC_CONTRACT_ADDRESS!, // Target USDC
        amount: invoice.local_amount.toString(),
        accountAddress: user_address, // User's Starknet address for final USDC
        destAddress: invoice.merchant_address, // Not used for BTC input
      };

      const swapResult = await swapService.executeSwap(swapRequest);

      if (!swapResult.success) {
        throw new Error(swapResult.error || "Swap initiation failed");
      }

      // Store swap association
      await client.query(
        `UPDATE invoices 
         SET swap_id = $1, swap_status = 'waiting_payment', customer_address = $2
         WHERE payment_ref = $3`,
        [swapResult.swapId, user_address, payment_ref]
      );

      return NextResponse.json({
        // success: true,
        ...swapResult,
        payment_ref,
      });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("BTC swap initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate BTC payment", details: error.message },
      { status: 500 }
    );
  }
}