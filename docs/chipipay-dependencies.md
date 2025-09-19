# ChipiPay Integration Dependencies

To use the ChipiPay invisible wallet integration, you need to install the following dependencies:

## Required Dependencies

```bash
# Install crypto-js for encryption/decryption
npm install crypto-js
npm install --save-dev @types/crypto-js

# Install AVNU gasless SDK (deprecated but still safe to use)
npm install @avnu/gasless-sdk
```

## Already Installed

The following dependencies are already included in your project:

- `starknet` - StarkNet JavaScript SDK
- `@starknet-react/core` - React hooks for StarkNet
- `@starknet-react/chains` - StarkNet chain configurations

## Environment Variables

Make sure you have the following environment variables configured:

```env
# ChipiPay Configuration
NEXT_PUBLIC_CHIPIPAY_API_KEY=pk_prod_your_public_key_here
CHIPIPAY_URL=https://api.chipipay.com/v1

# StarkNet RPC Configuration
STARKNET_RPC_URL=https://starknet-mainnet.infura.io/v3/YOUR_PROJECT_ID

# Contract Addresses
NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS=0x0654d1ab73d517086e44028ba82647e46157657f4c77616ffd3c6cba589240a2
NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS=0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8
```

## Installation Command

Run this command to install all missing dependencies:

```bash
npm install crypto-js @avnu/gasless-sdk && npm install --save-dev @types/crypto-js
```

## Verification

After installation, you can verify the integration works by running the tests:

```bash
npm test -- __tests__/services/chipipay-wallet-integration.test.ts
```

## Notes

- The `@avnu/gasless-sdk` is deprecated but still safe to use according to ChipiPay documentation
- ChipiPay will update this feature in October 2025
- Make sure to replace `YOUR_PROJECT_ID` in the RPC URL with your actual Infura project ID
- For development, you can use the Sepolia testnet RPC URL instead