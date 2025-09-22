# Clerk Authentication Integration

This document explains how Clerk authentication is integrated with the EgyptFi onboarding process.

## Overview

The integration maintains your custom onboarding flow (email → PIN → wallet creation) while using Clerk for user authentication and session management.

## Setup

### 1. Database Migration

Run the database migration to add Clerk user ID support:

```bash
npm run migrate:clerk
```

This adds a `clerk_user_id` column to the merchants table.

### 2. Environment Variables

Ensure these Clerk environment variables are set in your `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Flow

### Signup Process

1. **Email Step**: User enters email
2. **PIN Step**: User creates 6-digit PIN
3. **Confirm Step**: User confirms PIN
4. **Email Verification Step**: User enters verification code sent to email
5. **Wallet Step**: 
   - Creates Clerk user account with verified email
   - Gets Clerk token and user ID
   - Registers merchant in your database
   - Creates crypto wallet with ChipiPay
   - Redirects to dashboard

### Authentication

- Uses Clerk's `useSignUp` hook for user creation
- Links Clerk user ID to merchant record
- Maintains your existing PIN-based wallet security
- Uses Clerk's session management for protected routes

## API Changes

### `/api/merchants/register`

Now accepts:
- `clerk_user_id`: Links merchant to Clerk user
- `business_email`: User's email from Clerk
- `pin`: For wallet encryption (not stored in Clerk)

### Protected Routes

Routes like `/dashboard` are now protected by Clerk middleware.

## Components

### SignupModal

- Uses `useSignUp` from Clerk
- Creates user account during final step
- Maintains custom PIN flow for wallet security

### Navbar

- Shows Clerk's SignIn/SignUp buttons when logged out
- Shows UserButton when logged in
- Custom "Sign Up" button opens your modal

## Security

- PIN is used only for wallet encryption, not Clerk authentication
- Clerk handles password requirements and security
- Your existing wallet security model is preserved
- API routes are protected by Clerk middleware

## Testing

After setup:

1. Try the signup flow from the homepage
2. Verify user creation in Clerk dashboard
3. Check merchant record has `clerk_user_id`
4. Test protected route access
5. Verify wallet creation works

## Troubleshooting

### Database Issues
- Ensure migration ran successfully
- Check `clerk_user_id` column exists in merchants table

### Authentication Issues
- Verify Clerk environment variables
- Check middleware configuration
- Ensure API routes have proper auth headers