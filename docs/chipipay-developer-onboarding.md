# ChipiPay Developer Onboarding Guide

## Welcome to ChipiPay Integration

This guide will help you get started with ChipiPay's invisible wallet integration, from initial setup to your first successful transaction.

## What is ChipiPay?

ChipiPay provides invisible wallet technology that allows users to interact with blockchain applications without the complexity of traditional wallet management. Key benefits include:

- **Invisible Wallets**: Automatically created during user registration
- **PIN-based Security**: Simple 4-8 digit PIN instead of complex private keys
- **SDK Integration**: Pre-built hooks for common blockchain operations
- **Seamless UX**: Users don't need to install wallet extensions or manage seed phrases

## Quick Start (5 minutes)

### Step 1: Register a Merchant Account

1. Visit the registration page
2. Enter your email and create a 4-8 digit PIN
3. Your invisible wallet will be created automatically
4. Save your API keys (testnet and mainnet)

### Step 2: Make Your First API Call

```bash
# Test your API key with a simple health check
curl -X GET https://your-domain.com/api/health \
  -H "Authorization: Bearer pk_test_your_api_key"
```

### Step 3: Check Your Wallet Balance

```bash
# Get your wallet information
curl -X GET https://your-domain.com/api/merchants/profile \
  -H "Authorization: Bearer pk_test_your_api_key"
```

### Step 4: Make Your First Transfer

```bash
# Transfer 0.001 ETH to another address
curl -X POST https://your-domain.com/api/merchants/wallet/transfer \
  -H "Authorization: Bearer pk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "123456",
    "recipient": "0x1234567890abcdef...",
    "amount": "0.001"
  }'
```

## Development Environment Setup

### Prerequisites

- Node.js 18+ or Python 3.8+
- Basic understanding of REST APIs
- Starknet testnet tokens for testing

### Environment Configuration

Create a `.env` file in your project:

```bash
# ChipiPay Configuration
CHIPIPAY_API_KEY_TESTNET=pk_test_your_testnet_key
CHIPIPAY_API_KEY_MAINNET=pk_prod_your_mainnet_key
CHIPIPAY_BASE_URL=https://your-domain.com/api

# Your Application Settings
MERCHANT_PIN=123456  # For testing only - never store in production
```

### SDK Installation

#### JavaScript/TypeScript
```bash
npm install axios
# or
yarn add axios
```

#### Python
```bash
pip install requests
```

## Core Concepts

### 1. Invisible Wallets

Unlike traditional wallets, invisible wallets:
- Are created automatically during registration
- Use PIN-based encryption instead of seed phrases
- Store encrypted private keys securely on the server
- Provide the same security as traditional wallets

### 2. PIN-based Authentication

Your PIN serves multiple purposes:
- Encrypts your wallet's private key
- Authenticates wallet operations
- Provides security without complexity

**PIN Requirements:**
- 4-8 digits long
- Alphanumeric characters allowed
- Should be unique and memorable

### 3. API Key Authentication

Two levels of authentication:
1. **API Key**: Identifies your merchant account
2. **PIN**: Authorizes wallet operations

```javascript
// Example: Both API key and PIN required for wallet operations
const headers = {
  'Authorization': 'Bearer pk_test_your_api_key',  // API Key
  'Content-Type': 'application/json'
};

const body = {
  'pin': '123456',  // PIN for wallet access
  'recipient': '0x...',
  'amount': '100.0'
};
```

## Common Integration Patterns

### 1. Simple Token Transfer

```javascript
async function transferTokens(recipient, amount) {
  try {
    const response = await fetch('/api/merchants/wallet/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHIPIPAY_API_KEY_TESTNET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: process.env.MERCHANT_PIN,
        recipient: recipient,
        amount: amount.toString()
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Transfer successful:', result.data.txHash);
      return result.data;
    } else {
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Transfer failed:', error.message);
    throw error;
  }
}
```

### 2. DeFi Integration (VESU Staking)

```javascript
async function stakeInVesu(amount, receiverWallet) {
  try {
    // First approve USDC spending
    await fetch('/api/merchants/wallet/approve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHIPIPAY_API_KEY_TESTNET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: process.env.MERCHANT_PIN,
        contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // USDC
        spender: '0xvesu_contract_address',
        amount: amount.toString()
      })
    });

    // Then stake the tokens
    const stakeResponse = await fetch('/api/merchants/wallet/stake-vesu-usdc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHIPIPAY_API_KEY_TESTNET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: process.env.MERCHANT_PIN,
        amount: amount.toString(),
        receiverWallet: receiverWallet
      })
    });

    const result = await stakeResponse.json();
    console.log('Staking successful:', result.data.txHash);
    return result.data;
  } catch (error) {
    console.error('Staking failed:', error.message);
    throw error;
  }
}
```

### 3. Generic Contract Interaction

```javascript
async function callCustomContract(contractAddress, functionName, parameters) {
  try {
    const response = await fetch('/api/merchants/wallet/call-contract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHIPIPAY_API_KEY_TESTNET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: process.env.MERCHANT_PIN,
        contractAddress: contractAddress,
        entrypoint: functionName,
        calldata: parameters
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Contract call successful:', result.data.txHash);
      return result.data;
    } else {
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Contract call failed:', error.message);
    throw error;
  }
}

// Example: Mint NFT
await callCustomContract(
  '0xnft_contract_address',
  'mint',
  ['0xrecipient_address', '1'] // recipient, token_id
);
```

## Error Handling Best Practices

### 1. Implement Retry Logic

```javascript
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
    }
  }
}

// Usage
const result = await retryOperation(() => transferTokens(recipient, amount));
```

### 2. Handle Specific Error Codes

```javascript
function handleWalletError(error) {
  switch (error.code) {
    case 'INVALID_PIN':
      return 'Please check your PIN and try again';
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance for this transaction';
    case 'NETWORK_ERROR':
      return 'Network error, please try again later';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Too many requests, please wait before trying again';
    default:
      return 'An unexpected error occurred';
  }
}
```

### 3. Validate Parameters

```javascript
function validateTransferParams(recipient, amount) {
  if (!recipient || !recipient.startsWith('0x')) {
    throw new Error('Invalid recipient address');
  }
  
  if (!amount || parseFloat(amount) <= 0) {
    throw new Error('Invalid amount');
  }
  
  if (parseFloat(amount) > 1000000) {
    throw new Error('Amount too large');
  }
}
```

## Testing Your Integration

### 1. Unit Tests

```javascript
// Example Jest test
describe('ChipiPay Wallet Operations', () => {
  test('should transfer tokens successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        txHash: '0xabcdef...',
        recipient: '0x123...',
        amount: '100.0'
      }
    };

    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockResponse)
    });

    const result = await transferTokens('0x123...', 100);
    expect(result.txHash).toBe('0xabcdef...');
  });

  test('should handle insufficient balance error', async () => {
    const mockError = {
      success: false,
      error: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Not enough tokens'
      }
    };

    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockError)
    });

    await expect(transferTokens('0x123...', 1000000))
      .rejects.toThrow('Not enough tokens');
  });
});
```

### 2. Integration Tests

```javascript
// Test against testnet
describe('ChipiPay Integration Tests', () => {
  test('should complete full transfer flow', async () => {
    // This test requires testnet tokens
    const recipient = '0x1234567890abcdef...';
    const amount = '0.001';

    const result = await transferTokens(recipient, amount);
    
    expect(result.txHash).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(result.recipient).toBe(recipient);
    expect(result.amount).toBe(amount);
  });
});
```

## Production Deployment Checklist

### Security
- [ ] API keys stored securely (not in code)
- [ ] PINs never logged or stored in plain text
- [ ] HTTPS enabled for all API calls
- [ ] Rate limiting implemented
- [ ] Input validation on all parameters

### Monitoring
- [ ] Transaction success/failure rates tracked
- [ ] API response times monitored
- [ ] Error rates and types logged
- [ ] Alerts configured for critical failures

### Testing
- [ ] Unit tests cover all wallet operations
- [ ] Integration tests run against testnet
- [ ] Error scenarios tested
- [ ] Load testing completed

### Documentation
- [ ] API endpoints documented
- [ ] Error codes documented
- [ ] Integration examples provided
- [ ] Troubleshooting guide available

## Advanced Topics

### 1. Batch Operations

For multiple transactions, consider implementing batch operations:

```javascript
async function batchTransfer(transfers) {
  const results = [];
  
  for (const transfer of transfers) {
    try {
      const result = await transferTokens(transfer.recipient, transfer.amount);
      results.push({ success: true, ...result });
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
```

### 2. Transaction Status Monitoring

```javascript
async function waitForTransaction(txHash, maxWaitTime = 300000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check transaction status (implement based on your needs)
      const status = await checkTransactionStatus(txHash);
      
      if (status === 'confirmed') {
        return true;
      } else if (status === 'failed') {
        throw new Error('Transaction failed');
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error checking transaction status:', error);
    }
  }
  
  throw new Error('Transaction timeout');
}
```

### 3. Gas Optimization

```javascript
async function estimateGas(operation) {
  // Implement gas estimation logic
  // This helps users understand transaction costs
  return {
    estimatedGas: '0.001',
    gasPrice: '0.000000001',
    totalCost: '0.001001'
  };
}
```

## Support and Resources

### Documentation
- [API Reference](./chipipay-api-documentation.md)
- [Error Codes Reference](#error-handling)
- [Integration Examples](#integration-examples)

### Community
- GitHub Issues: Report bugs and request features
- Discord: Join our developer community
- Stack Overflow: Tag questions with `chipipay`

### Support
- Email: support@chipipay.com
- Response time: 24 hours for technical issues
- Include request ID for faster resolution

## Next Steps

1. **Complete the Quick Start**: Get your first transaction working
2. **Explore Examples**: Try the integration patterns
3. **Build Your Application**: Integrate ChipiPay into your project
4. **Test Thoroughly**: Use our testing guidelines
5. **Deploy to Production**: Follow our deployment checklist

Welcome to the ChipiPay ecosystem! We're excited to see what you'll build.