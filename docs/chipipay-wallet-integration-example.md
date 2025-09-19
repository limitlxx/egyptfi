# ChipiPay Invisible Wallet Integration Example

This document shows how to use the enhanced merchant registration services with ChipiPay invisible wallet integration.

## Complete Merchant Registration Flow

```typescript
import MerchantRegistrationService, { MerchantRegistrationData } from '@/services/merchantRegistrationService';
import ContractMerchantService from '@/services/contractMerchantService';
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from '@/lib/utils';

// Example: Complete merchant registration with invisible wallet
async function registerMerchantWithInvisibleWallet() {
  try {
    // Step 1: Prepare merchant data
    const merchantData: MerchantRegistrationData = {
      business_name: "My Business",
      business_email: "merchant@example.com",
      business_type: "retail",
      monthly_volume: "10000",
      authMethod: 'wallet',
      local_currency: 'USD',
      encryptKey: '1234', // User's PIN for wallet encryption
      externalUserId: 'user-123-from-auth-provider' // From your auth provider
    };

    // Step 2: Get authentication tokens
    const bearerToken = await getBearerTokenFromAuthProvider(); // Your JWT token
    const apiPublicKey = process.env.NEXT_PUBLIC_CHIPIPAY_API_KEY!; // Your ChipiPay public key
    const contractAddress = EGYPT_SEPOLIA_CONTRACT_ADDRESS;

    // Step 3: Complete registration (creates wallet + registers in DB + registers on contract)
    const result = await MerchantRegistrationService.registerMerchantWithInvisibleWallet(
      merchantData,
      bearerToken,
      apiPublicKey,
      contractAddress
    );

    if (result.success) {
      console.log('Registration successful!', {
        merchantId: result.merchant?.id,
        walletAddress: result.wallet?.publicKey,
        walletTxHash: result.walletTxHash,
        contractTxHash: result.contractRegistrationTxHash,
        apiKeys: result.apiKeys
      });

      // Store wallet data securely
      if (result.wallet) {
        MerchantRegistrationService.storeApiKeys(result.apiKeys!);
        MerchantRegistrationService.storeMerchantData(result.merchant);
        
        // Store wallet data (consider more secure storage in production)
        localStorage.setItem('merchant_wallet', JSON.stringify({
          publicKey: result.wallet.publicKey,
          encryptedPrivateKey: result.wallet.encryptedPrivateKey
        }));
      }

      return result;
    } else {
      console.error('Registration failed:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Example: Create wallet only (without full registration)
async function createWalletOnly() {
  try {
    const merchantData: MerchantRegistrationData = {
      business_name: "My Business",
      business_email: "merchant@example.com",
      business_type: "retail",
      monthly_volume: "10000",
      authMethod: 'wallet',
      encryptKey: '1234',
      externalUserId: 'user-123'
    };

    const bearerToken = await getBearerTokenFromAuthProvider();
    const apiPublicKey = process.env.NEXT_PUBLIC_CHIPIPAY_API_KEY!;

    const walletResult = await MerchantRegistrationService.createInvisibleWallet(
      merchantData,
      bearerToken,
      apiPublicKey
    );

    console.log('Wallet created:', {
      publicKey: walletResult.wallet.publicKey,
      txHash: walletResult.txHash
    });

    return walletResult;
  } catch (error) {
    console.error('Wallet creation failed:', error);
    throw error;
  }
}

// Example: Register on contract only (if you already have a wallet)
async function registerOnContractOnly() {
  try {
    const walletAddress = "0x123..."; // Your wallet address
    const encryptedPrivateKey = "encrypted:key:data"; // Your encrypted private key
    const bearerToken = await getBearerTokenFromAuthProvider();
    const contractAddress = EGYPT_SEPOLIA_CONTRACT_ADDRESS;

    const merchantData: MerchantRegistrationData = {
      business_name: "My Business",
      business_email: "merchant@example.com",
      business_type: "retail",
      monthly_volume: "10000",
      authMethod: 'wallet'
    };

    const txHash = await MerchantRegistrationService.registerMerchantOnContract(
      merchantData,
      walletAddress,
      encryptedPrivateKey,
      bearerToken,
      contractAddress
    );

    console.log('Contract registration successful:', txHash);
    return txHash;
  } catch (error) {
    console.error('Contract registration failed:', error);
    throw error;
  }
}

// Example: Using ContractMerchantService for advanced operations
async function advancedContractOperations() {
  try {
    const contractService = new ContractMerchantService(null, EGYPT_SEPOLIA_CONTRACT_ADDRESS);
    const bearerToken = await getBearerTokenFromAuthProvider();
    const encryptedPrivateKey = "encrypted:key:data";
    const walletPublicKey = "0x123..."; // Wallet public key
    const encryptKey = "1234"; // User's PIN

    // Update withdrawal address
    const updateTxHash = await contractService.updateWithdrawalAddress(
      encryptedPrivateKey,
      walletPublicKey,
      "0x456...", // New withdrawal address
      encryptKey,
      bearerToken
    );

    console.log('Withdrawal address updated:', updateTxHash);

    // Withdraw funds
    const withdrawTxHash = await contractService.withdrawFunds(
      encryptedPrivateKey,
      walletPublicKey,
      "1000000", // Amount in wei
      encryptKey,
      bearerToken
    );

    console.log('Funds withdrawn:', withdrawTxHash);

    return { updateTxHash, withdrawTxHash };
  } catch (error) {
    console.error('Contract operations failed:', error);
    throw error;
  }
}

// Helper function to get bearer token (implement based on your auth provider)
async function getBearerTokenFromAuthProvider(): Promise<string> {
  // This should return a valid JWT token from your auth provider
  // For example, if using Auth0, Clerk, Firebase Auth, etc.
  
  // Example implementation:
  // const { getToken } = useAuth(); // Your auth hook
  // return await getToken();
  
  throw new Error('Implement getBearerTokenFromAuthProvider based on your auth provider');
}

export {
  registerMerchantWithInvisibleWallet,
  createWalletOnly,
  registerOnContractOnly,
  advancedContractOperations
};
```

## React Component Example

```tsx
'use client'

import { useState } from 'react';
import { registerMerchantWithInvisibleWallet } from './examples';
import { MerchantRegistrationData } from '@/services/merchantRegistrationService';

export function MerchantRegistrationForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    business_name: '',
    business_email: '',
    business_type: 'retail',
    monthly_volume: '',
    encryptKey: '',
    externalUserId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const merchantData: MerchantRegistrationData = {
        ...formData,
        authMethod: 'wallet',
        local_currency: 'USD'
      };

      const registrationResult = await registerMerchantWithInvisibleWallet();
      setResult(registrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Register Merchant with Invisible Wallet</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Business Name</label>
          <input
            type="text"
            value={formData.business_name}
            onChange={(e) => setFormData({...formData, business_name: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Business Email</label>
          <input
            type="email"
            value={formData.business_email}
            onChange={(e) => setFormData({...formData, business_email: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Monthly Volume</label>
          <input
            type="number"
            value={formData.monthly_volume}
            onChange={(e) => setFormData({...formData, monthly_volume: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Wallet PIN (4+ digits)</label>
          <input
            type="password"
            value={formData.encryptKey}
            onChange={(e) => setFormData({...formData, encryptKey: e.target.value})}
            className="w-full p-2 border rounded-md"
            minLength={4}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">User ID</label>
          <input
            type="text"
            value={formData.externalUserId}
            onChange={(e) => setFormData({...formData, externalUserId: e.target.value})}
            className="w-full p-2 border rounded-md"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Registering...' : 'Register Merchant'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
          <h3 className="font-semibold">Registration Successful!</h3>
          <p>Wallet: {result.wallet?.publicKey}</p>
          <p>Wallet TX: {result.walletTxHash}</p>
          {result.contractRegistrationTxHash && (
            <p>Contract TX: {result.contractRegistrationTxHash}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Environment Variables Required

```env
# ChipiPay Configuration
NEXT_PUBLIC_CHIPIPAY_API_KEY=pk_prod_your_public_key_here
CHIPIPAY_URL=https://api.chipipay.com/v1

# Contract Addresses
NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS=0x0654d1ab73d517086e44028ba82647e46157657f4c77616ffd3c6cba589240a2
NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS=0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8
```

## Security Considerations

1. **PIN Security**: The `encryptKey` (PIN) should be collected client-side and never logged or stored in plain text.

2. **Private Key Storage**: The encrypted private key should be stored securely. Consider using:
   - Secure browser storage (with encryption)
   - Server-side encrypted storage
   - Hardware security modules for production

3. **Bearer Token**: Ensure your JWT tokens are properly validated and have appropriate expiration times.

4. **API Keys**: Keep your ChipiPay secret keys secure and never expose them client-side.

## Error Handling

The services include comprehensive error handling:

- Network timeouts and retries
- Authentication failures
- Contract call failures
- Wallet creation failures
- Database registration failures

Each method returns detailed error information to help with debugging and user feedback.