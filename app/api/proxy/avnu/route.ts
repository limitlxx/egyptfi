import { NextRequest, NextResponse } from 'next/server';

const AVNU_ENDPOINTS = {
  sepolia: 'https://sepolia.api.avnu.fi/paymaster/v1/accounts',
  mainnet: 'https://starknet.api.avnu.fi/paymaster/v1/accounts',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const network = searchParams.get('network') as 'sepolia' | 'mainnet' || 'sepolia';

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Address is required' },
      { status: 400 }
    );
  }

  try {
    const avnuUrl = `${AVNU_ENDPOINTS[network]}/${address}/compatible`;
    // console.log(`Proxying request to: ${avnuUrl}`);
    
    const response = await fetch(avnuUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`AVNU API responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error proxying AVNU API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check account compatibility',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}