// app/api/price/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RpcProvider, constants } from "starknet";

// Validation schema for query parameters
const PriceFetchSchema = z.object({
  token: z.enum(["strk", "eth", "usdc"], {
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
    const fiatPerUsd =
      cmcData.data.USDC[0].quote[validatedData.fiat_currency].price;
    if (!fiatPerUsd) {
      return NextResponse.json(
        { error: "Price not available for this fiat currency" },
        { status: 404 }
      );
    }

    // Calculate fiat_amount in USD
    const fiatInUsd = validatedData.fiat_amount / fiatPerUsd;

    // Chainlink feeds on Starknet mainnet
    const chainlinkFeeds: Record<string, string> = {
      strk: "0x02d8f6b8c2af9c4e91838c638f91cd0576698fd40ec8de22bf8582e9d613c0ee",
      eth: "0x03042f2f43635eec2c0418ff45e77c42af55cbc764c167692b8ca4777476c2e",
      usdc: "0x033b091a8e0ed928c739d9a9b4e6c8e82661d93b1310e6b3b8cae5f31f05a0e",
    };

    const decimals = 8; // Standard for these feeds

    // Starknet provider
    const starknetProvider = new RpcProvider({
      nodeUrl: constants.NetworkName.SN_MAIN,
    });

    // Fetch token/USD rates from Chainlink
    const tokenRates: Record<string, string> = {};
    const convertedAmount: Record<string, string> = {};

    for (const t of Object.keys(chainlinkFeeds)) {
      const feedAddress = chainlinkFeeds[t as keyof typeof chainlinkFeeds];

      const callResult = await starknetProvider.callContract({
        contractAddress: feedAddress,
        entrypoint: "latest_round_data",
      });

      // Parse the answer (index 1 in result array, scaled by 10^8)
      const answer = BigInt(callResult.result[1]);
      const price = Number(answer) / 10 ** decimals;

      // Validate price
      if (price <= 0) {
        throw new Error(`Invalid price for ${t.toUpperCase()}/USD`);
      }

      tokenRates[`${t.toUpperCase()}/USD`] = price.toFixed(2);
      convertedAmount[t.toUpperCase()] = (fiatInUsd / price).toFixed(
        t === "eth" ? 6 : 2
      );
    }

    // Payment currency and final amount
    const paymentCurrency = validatedData.token.toUpperCase();
    const finalAmount = convertedAmount[paymentCurrency];

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
          details: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}