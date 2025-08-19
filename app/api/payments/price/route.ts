// app/api/price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for query parameters
const PriceFetchSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  chain: z.enum(['ethereum', 'starknet', 'base', 'arbitrum', 'polygon']).optional(),
  fiat_amount: z.number().positive('Fiat amount must be positive'),
  fiat_currency: z.string().min(3, 'Fiat currency code must be at least 3 characters'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const chain = searchParams.get('chain');
    const fiat_amount = parseFloat(searchParams.get('fiat_amount') || '0');
    const fiat_currency = searchParams.get('fiat_currency');

    // Validate query parameters
    const validatedData = PriceFetchSchema.parse({
      token,
      chain,
      fiat_amount,
      fiat_currency,
    });

    // Map tokens to CoinGecko IDs (adjust based on chain if needed)
    const tokenToCoinGeckoId: Record<string, string> = {
      usdc: 'usd-coin',
      usdt: 'tether',
      dai: 'dai',
      eth: 'ethereum',
      matic: 'matic-network',
    };

    const coinGeckoId = tokenToCoinGeckoId[validatedData.token];
    if (!coinGeckoId) {
      return NextResponse.json(
        { error: 'Unsupported token' },
        { status: 400 }
      );
    }

    // Fetch price from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=${validatedData.fiat_currency.toLowerCase()}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch price from CoinGecko' },
        { status: 502 }
      );
    }

    const priceData = await response.json();
    const price = priceData[coinGeckoId][validatedData.fiat_currency.toLowerCase()];
    if (!price) {
      return NextResponse.json(
        { error: 'Price not available for this currency pair' },
        { status: 404 }
      );
    }

    // Calculate token amount
    const tokenAmount = validatedData.fiat_amount / price;

    return NextResponse.json({
      token: validatedData.token,
      chain: validatedData.chain || 'unknown',
      fiat_amount: validatedData.fiat_amount,
      fiat_currency: validatedData.fiat_currency,
      token_amount: tokenAmount.toFixed(validatedData.token === 'eth' ? 6 : 2),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Price fetch error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}