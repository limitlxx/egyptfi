// app/api/price/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Provider as StarknetProvider, RpcProvider, constants } from "starknet";

// In-memory cache for fiat/USD rates
const fiatPriceCache: Record<
  string,
  { price: number; timestamp: number }
> = {};
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Validation schema for query parameters
const PriceFetchSchema = z.object({
  token: z.enum(["strk", "eth", "usdc", "wbtc"], {
    message: "Token must be one of strk, eth, usdc",
  }),
  chain: z
    .enum(["starknet"], { message: "Only starknet is supported for now" })
    .optional(),
  fiat_amount: z.number().positive("Fiat amount must be positive"),
  fiat_currency: z
    .string()
    .min(3, "Fiat currency code must be at least 3 characters")
    .toUpperCase(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.toLowerCase();
    const chain = searchParams.get("chain")?.toLowerCase();
    const fiat_amount = parseFloat(searchParams.get("fiat_amount") || "0");
    const fiat_currency = searchParams.get("fiat_currency")?.toUpperCase();

    // Validate query parameters
    const validatedData = PriceFetchSchema.parse({
      token,
      chain,
      fiat_amount,
      fiat_currency,
    });
    
    // Check cache for fiat/USD rate
    const cacheKey = validatedData.fiat_currency;
    const cached = fiatPriceCache[cacheKey];
    const now = Date.now();
    let fiatPerUsd: number;

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      fiatPerUsd = cached.price;
    } else {
      // CMC API Key from env
      const cmcApiKey = process.env.CMC_API_KEY;
      if (!cmcApiKey) {
        return NextResponse.json(
          { error: "CMC API key not configured" },
          { status: 500 }
        );
      }

    // Fetch USDC price in fiat_currency from CoinMarketCap to bridge fiat/USD rate
    const cmcResponse = await fetch(
      `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=USDC&convert=${validatedData.fiat_currency}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": cmcApiKey,
          Accept: "application/json",
        },
      }
    );

    if (!cmcResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from CoinMarketCap" },
        { status: 502 }
      );
    }

    const cmcData = await cmcResponse.json();
      fiatPerUsd = cmcData.data.USDC[0].quote[validatedData.fiat_currency].price;
      if (!fiatPerUsd) {
        return NextResponse.json(
          { error: "Price not available for this fiat currency" },
          { status: 404 }
        );
      }

      // Update cache
      fiatPriceCache[cacheKey] = {
        price: fiatPerUsd,
        timestamp: now,
      };
      
    }
    

    // Calculate fiat_amount in USD
    console.log("FIAT AMOUNT", validatedData.fiat_amount);
    console.log("FIAT PER USD", fiatPerUsd);
    
    
    const fiatInUsd = validatedData.fiat_amount / fiatPerUsd;

    // Chainlink feeds on Starknet mainnet
    const chainlinkFeeds: Record<string, string> = {
      strk: "0x76a0254cdadb59b86da3b5960bf8d73779cac88edc5ae587cab3cedf03226ec",
      eth: "0x6b2ef9b416ad0f996b2a8ac0dd771b1788196f51c96f5b000df2e47ac756d26",
      usdc: "0x72495dbb867dd3c6373820694008f8a8bff7b41f7f7112245d687858b243470", 
      wbtc: "0x5a4930401bbb1d643ca501640e218fec253b33326f47d139bd025c62a1fbc7f"
    };

    // Starknet provider
    const starknetProvider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }); // constants.NetworkName.SN_MAIN

    // Fetch token/USD rates from Chainlink
    const tokenRates: Record<string, string> = {};
    const convertedAmount: Record<string, string> = {};

    for (const t of Object.keys(chainlinkFeeds)) {
      const feedAddress = chainlinkFeeds[t as keyof typeof chainlinkFeeds];

      const callResult = await starknetProvider.callContract({
        contractAddress: feedAddress,
        entrypoint: "latest_round_data",
      });

      // console.log(`Raw callResult for ${t}:`, callResult);

      // callResult is string[]
      const answer = BigInt(callResult[1]); // Assuming answer is at index 1
      const decimals = 8; // Confirm this by calling the decimals function if needed
      const price = Number(answer) / 10 ** decimals;

      console.log("PRICE", price);
      console.log("FIAT PRICE", fiatInUsd);
      

      tokenRates[`${t.toUpperCase()}/USD`] = price.toFixed(2);
      convertedAmount[t.toUpperCase()] = (fiatInUsd / price).toFixed(
        t === "eth" ? 6 : 10
      );     
      
      console.log("TOKEN RATES", tokenRates);      
      console.log("CONVERTED AMOUNT", convertedAmount);
    }
    

    // Payment currency and final amount
    const paymentCurrency = validatedData.token.toUpperCase();
    const finalAmount = convertedAmount[paymentCurrency];


      console.log("Final CONVERTED AMOUNT", finalAmount);

    // Structured response
    const responseData = {
      data: {
        amount_fiat: validatedData.fiat_amount.toString(),
        converted_amount: convertedAmount,
        conversion_rate: {
          source: {
            fiat: "CoinMarketCap",
            crypto: "Chainlink",
          },
          fiat: validatedData.fiat_currency,
          usd_rate: fiatPerUsd.toFixed(2),
          token_rates: tokenRates,
        },
        payment_currency: paymentCurrency,
        final_amount: finalAmount,
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Price fetch error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error 
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
