# ChipiPay + Clerk Integration Guide

## Current Issue

ChipiPay production environment is rejecting Clerk test JWT tokens with error:
```
Invalid JWT token - Unauthorized (401)
```

## Root Cause

Your setup has:
- **Clerk**: Test environment (`pk_test_...`) 
- **ChipiPay**: Production environment (`pk_prod_...`)

ChipiPay production is not configured to accept JWT tokens from your Clerk test instance.

## Solutions

### Option 1: Configure ChipiPay Production (Recommended)

Contact ChipiPay support to configure your production environment to accept JWT tokens from:
- **JWKS Endpoint**: `https://valued-pony-49.clerk.accounts.dev/.well-known/jwks.json`
- **Issuer**: `https://valued-pony-49.clerk.accounts.dev`

### Option 2: Use ChipiPay Test Environment

Switch to ChipiPay test credentials for development:
```env
NEXT_PUBLIC_CHIPI_API_KEY=pk_test_your_test_key
CHIPI_SECRET_KEY=sk_test_your_test_secret
NEXT_PUBLIC_CHIPI_ENV=testnet
```

### Option 3: Hybrid Approach (Current Implementation)

Use Clerk for authentication but internal JWT for ChipiPay calls:
- ✅ Clerk handles user authentication and sessions
- ✅ Internal JWT used for ChipiPay API calls
- ✅ Maintains security and functionality

## Current Flow

1. **User Authentication**: Clerk handles signup/login
2. **Session Management**: Clerk manages user sessions
3. **Merchant Registration**: Links Clerk user to merchant record
4. **Wallet Creation**: Uses internal JWT for ChipiPay compatibility

## Testing

Run the signup flow:
1. Complete email verification
2. Check console logs for token usage
3. Verify wallet creation succeeds

## Production Deployment

For production:
1. Use Clerk production environment (`pk_live_...`)
2. Configure ChipiPay to accept Clerk production JWKS
3. Update environment variables accordingly

## Debug Information

Your Clerk token details:
- **Issuer**: `https://valued-pony-49.clerk.accounts.dev`
- **JWKS URL**: `https://valued-pony-49.clerk.accounts.dev/.well-known/jwks.json`
- **User ID**: `user_333I6HoTnwakeneSeikdPmlrstS`

ChipiPay needs to be configured to trust tokens from this issuer.