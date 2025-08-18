// app/api/auth/verify/route.ts
// app/api/auth/verify/route.ts
export const runtime = 'nodejs'; 

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

interface VerifyResponse {
  success: boolean;
  payload?: {
    merchantId: string;
    walletAddress: string;
    environment: 'testnet' | 'mainnet';
    iat?: number;
    exp?: number;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const payload = verifyJWT(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired JWT' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      payload,
    });
  } catch (error) {
    console.error('JWT verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify JWT',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}