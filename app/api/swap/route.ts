import { NextResponse } from "next/server";
import { SwapService, type SwapRequest, type SwapResponse } from "@/lib/swap-service";

const service = new SwapService();

export async function POST(req: Request) {
  try {
    const body: SwapRequest = await req.json();

    if (!body.tokenIn || !body.tokenOut || !body.amount || !body.accountAddress) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // For BTC out, validate destAddress
    if ((body.tokenOut === 'BTC' || body.tokenOut === 'BTCLN') && !body.destAddress) {
      return NextResponse.json({ error: "destAddress required for BTC output" }, { status: 400 });
    }

    const result: SwapResponse = await service.executeSwap(body);

    // For async paths, process pending immediately
    if (result.status === 'waiting_payment') {
      await service.processPendingSwaps();
    }

    return NextResponse.json({ ...result, success: true });
  } catch (error: any) {
    console.error("Swap API error:", error);
    return NextResponse.json({ error: "Swap failed", details: error.message }, { status: 500 });
  }
}

// Optional: Separate endpoint for polling/processing pending swaps (e.g., /api/swap/process)
export async function GET() {
  await service.processPendingSwaps();
  return NextResponse.json({ success: true, message: "Processed pending swaps" });
}