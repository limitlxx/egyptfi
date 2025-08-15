import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

export function middleware(request: NextRequest) {
  // Only protect API routes that start with /api/merchants (except check and register)
  if (request.nextUrl.pathname.startsWith('/api/merchants/') && 
      !request.nextUrl.pathname.includes('/check') && 
      !request.nextUrl.pathname.includes('/register')) {
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Add merchant info to headers for use in API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-merchant-id', payload.merchantId);
    requestHeaders.set('x-wallet-address', payload.walletAddress);
    requestHeaders.set('x-environment', payload.environment);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/merchants/:path*',
};