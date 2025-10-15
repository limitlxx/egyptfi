// app/api/payments/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { callContractFunction } from "@/lib/starknetService";
import { SwapService } from "@/lib/swap-service";

const swapService = new SwapService();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentRef = searchParams.get("payment_ref"); 

  if (!paymentRef) {
    return NextResponse.json(
      { error: "payment_ref required" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Fixed: Add JOIN for merchant fields
    const invoiceResult = await client.query(
      `SELECT i.*, m.business_name, m.business_logo, m.wallet_address, m.preferred_btc_flow 
       FROM invoices i 
       JOIN merchants m ON i.merchant_id = m.id 
       WHERE i.payment_ref = $1`,
      [paymentRef]
    );
    const invoice = invoiceResult.rows[0];

    if (!invoice)
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    let status = invoice.status;
    console.log("STATUS LOG", invoice);    

    if (invoice.swap_id != null) {
      try {
        const swap = await swapService.swapper.getSwapById(invoice.swap_id);
        if (!swap) {
          status = "expired"; // Or 'failed' if ID invalid
        } else {
          const state = swap.getState(); // Get numeric state for logging
          console.log(`Swap ${invoice.swap_id} state: ${state}`); // For debugging

          if (swap.isRefundable()) {
            status = "refundable"; // Handle via separate cron/webhook if needed
          } else if (swap.isClaimable()) {
            // Target-process this swap (extract from processPendingSwaps logic)
            const association = await swapService.getSwapAssociation(
              invoice.swap_id
            ); // From your placeholder
            if (association) {
              // Simplified claim (adapt from your processPendingSwaps)
              if (swap.canCommit())
                await swap.commit(swapService.starknetSigner);
              await swap.claim(swapService.starknetSigner);
              await swap.waitTillClaimedOrFronted(); // 30s timeout
              status = "processing";
            }
          } else if (swap.isCompleted()) {
            status = "paid";
          } else if (swap.getQuoteExpiry() < Date.now()) {
            status = "expired";
          } else {
            status = "waiting_payment"; // Default pending
          }
        }
      } catch (err: any) {
        console.error(`Swap check failed for ${invoice.swap_id}:`, err);
        status = "error"; // Fallback
      }
    } else {
      // Added: Starknet contract check (from previous suggestions)
      try {
        const merchantQuery = await client.query("SELECT id FROM merchants WHERE wallet_address = $1", [invoice.wallet_address]);
        const merchantId = merchantQuery.rows[0]?.id;
        if (merchantId) {
          const paymentState = await callContractFunction(merchantId, undefined, 'get_payment', [paymentRef]);
          // Map contract status (e.g., felt 0=pending, 1=completed; adjust per ABI)
          const contractStatus = paymentState?.status || paymentState[0]; // Tuple fallback
          status = contractStatus === 1 || contractStatus === 'completed' ? 'paid' : 'pending';
        }
      } catch (err: any) {
        console.error(`Contract check failed for ${paymentRef}:`, err);
        status = 'error';
      }
    }

    // Update DB if changed
    if (status !== invoice.status) {
      await client.query(
        "UPDATE invoices SET status = $1 WHERE payment_ref = $2",
        [status, paymentRef]
      );
    }

    // Fixed: Use updated status in response
    return NextResponse.json({
      success: true,
      data: {
        merchant_name: invoice.business_name,
        merchant_logo: invoice.business_logo,
        payment_ref: invoice.payment_ref,
        status: status, // Use updated status
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
      }
    });
  } finally {
    client.release();
  }
}