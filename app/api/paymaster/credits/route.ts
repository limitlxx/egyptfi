// app/api/paymaster/credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { felt252ToString } from '@/lib/felt252-utils'; // Import the utility function


export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_PAYMASTER_API;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Paymaster API key not configured' },
        { status: 500 }
      );
    }

    // Determine the correct paymaster URL based on environment 
    const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || 'https://sepolia.api.avnu.fi';
    const endpoint = `${paymasterUrl}/paymaster/v1/sponsor-activity`; 
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
         "Accept": "*/*",
        "Content-Type": "application/json", // Added Content-Type header
        "api-key": apiKey,
      },
      body: JSON.stringify({}), 
    }); 

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Paymaster API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      return NextResponse.json(
        { 
          error: `Paymaster API error: ${response.status} ${response.statusText}`,
          details: errorText 
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log("Data", response);
    
    
    console.log('Paymaster credits data:', {
      remainingCredits: data.remainingCredits,
      remainingStrkCredits: data.remainingStrkCredits,
      txCount: data.txCount,
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching paymaster credits:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch paymaster credits',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}