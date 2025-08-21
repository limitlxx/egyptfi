// app/api/swap/route.ts
import { NextResponse } from "next/server";
import { AutoSwappr } from "autoswap-sdk"; 

export async function POST(req: Request) {
  try {
    const { tokenIn, tokenOut, amount, accountAddress } = await req.json();

    if (!tokenIn || !tokenOut || !amount || !accountAddress) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const autoswapprContractAddress = process.env.AUTOSWAPPR_CONTRACT_ADDRESS;
    const rpcUrl = process.env.STARKNET_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!autoswapprContractAddress || !rpcUrl || !accountAddress || !privateKey) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const config = {
      contractAddress: autoswapprContractAddress,
      rpcUrl,
      accountAddress,
      privateKey,
    };

    const autoswappr = new AutoSwappr(config);

    const swapOptions = {
      amount: amount.toString(), // SDK expects string
      isToken1: tokenIn > tokenOut, // ✅ careful: if these are addresses, you may need a different comparison
      skipAhead: 0,
    };

    const swapResult = await autoswappr.executeSwap(tokenIn, tokenOut, swapOptions);

    return NextResponse.json({
      success: true,
      results: swapResult,
    });
  } catch (error: any) {
    console.error("Swap error:", error);
    return NextResponse.json(
      { error: "Swap failed", details: error.message ?? error.toString() },
      { status: 500 }
    );
  }
}
