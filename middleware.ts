import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect API routes that start with /api/merchants (except check, register, and login)
  if (request.nextUrl.pathname.startsWith('/api/merchants/') && 
      !request.nextUrl.pathname.includes('/check') && 
      !request.nextUrl.pathname.includes('/register') &&
      !request.nextUrl.pathname.includes('/login')) {      
    
    const apiKey = request.headers.get('x-api-key');
    const walletAddress = request.headers.get('x-wallet-address');
    const environment = request.headers.get('x-environment');
    
    // Basic header validation - detailed auth will be done in each API route
    if (!apiKey || !walletAddress || !environment) {
      return NextResponse.json(
        { error: 'API key, wallet address, and environment headers required' },
        { status: 401 }
      );
    }

    // Basic format validation
    if (!apiKey.startsWith('pk_test_') && !apiKey.startsWith('pk_live_')) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 }
      );
    }

    // Verify environment matches key prefix
    const expectedEnv = apiKey.startsWith('pk_test_') ? 'testnet' : 'mainnet';
    if (environment !== expectedEnv) {
      return NextResponse.json(
        { error: 'Environment mismatch with API key' },
        { status: 401 }
      );
    }

    // Pass through - each API route will do detailed authentication
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/merchants/:path*',
};